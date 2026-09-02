import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SkemaEkstraksi, type HasilEkstraksi, type Sumber } from "./jenis";
import { MODEL, model_sah, type NamaModel } from "@/lib/ai/model";

/**
 * Menarik materi admin dari dokumen jadi entri terstruktur.
 *
 * Dokumen mentah sengaja TIDAK disimpan sebagai bahan balasan harian.
 * Alasannya tiga: menyuapkan PDF dua puluh halaman ke setiap balasan itu
 * mahal, model bisa salah membaca baris tabel harga, dan awalan yang
 * berubah-ubah merusak prompt caching. Jadi dokumen dibaca sekali di sini,
 * hasilnya diperiksa manusia, lalu yang tersimpan cuma entri rapi.
 *
 * Model sengaja yang paling mampu, bukan yang paling murah. Ekstraksi cuma
 * jalan sekali per dokumen, sedangkan satu angka harga yang salah baca akan
 * diulang-ulang ke setiap calon client sesudahnya.
 */

/**
 * Model pembaca dokumen.
 *
 * Diuji dengan daftar harga tujuh baris berformat Indonesia: Haiku 4.5 dan
 * Opus 5 sama-sama benar tujuh dari tujuh, dan sama-sama menandai satu harga
 * yang cuma tertulis "Hubungi kami" sebagai kosong. Bedanya Opus menarik
 * lebih banyak catatan konteks, dan biayanya tujuh kali lipat.
 *
 * Karena itu bawaannya Haiku. Kalau suatu saat ada PDF berantakan yang
 * hasilnya meleset, satu dokumen bisa dibaca ulang dengan model lebih teliti
 * lewat MODEL_EKSTRAKSI di variabel lingkungan, dan selisihnya cuma dua sen.
 */
const MODEL_BAWAAN: NamaModel = "claude-haiku-4-5";

function model_terpakai(): NamaModel {
  const dari_env = process.env.MODEL_EKSTRAKSI;
  return model_sah(dari_env) ? dari_env : MODEL_BAWAAN;
}

const INSTRUKSI = `Kamu membantu bisnis kecil di Indonesia merapikan materi admin
mereka menjadi daftar layanan dan daftar pertanyaan yang sering ditanyakan.

Tugasmu membaca dokumen yang diberikan, lalu menarik isinya apa adanya.

Aturan yang tidak boleh dilanggar:

1. Jangan pernah mengarang harga. Kalau harga suatu layanan tidak tertulis
   jelas, isi harga dengan null dan sebutkan layanan itu di daftar keraguan.
2. Jangan mengubah angka. "Rp 4.500.000" berarti 4500000, bukan 4500 atau 4,5.
   Ingat titik di angka Indonesia adalah pemisah ribuan, bukan koma desimal.
3. Kalau satu layanan punya beberapa tingkat harga, buat entri terpisah untuk
   tiap tingkat, jangan digabung jadi rentang.
4. Jangan menambahkan layanan yang tidak ada di dokumen, walaupun kelihatannya
   wajar dimiliki bisnis semacam itu.
5. Buang bahasa promosi. Tulis apa adanya, seperti catatan internal.
6. Semua keluaran dalam bahasa Indonesia.
7. Apa pun yang berguna untuk menjawab client tapi tidak muat sebagai layanan
   maupun FAQ, masukkan ke kutipan. Contohnya syarat pembayaran, jumlah
   revisi, cakupan garansi, alur kerja, jangkauan wilayah, hal yang tidak
   dikerjakan. Salin isinya apa adanya, jangan diringkas sampai kehilangan
   angka atau syaratnya.
8. Jangan menaruh hal yang sama di dua tempat. Kalau sudah jadi FAQ, tidak
   perlu diulang sebagai kutipan.

Kalau dokumennya tidak memuat informasi layanan maupun pertanyaan, kembalikan
daftar kosong. Itu jawaban yang benar, bukan kegagalan.`;

export type HasilImpor =
  | { ok: true; hasil: HasilEkstraksi; token_masuk: number; token_keluar: number }
  | { ok: false; alasan: string };

function isi_pesan(sumber: Sumber): Anthropic.Beta.BetaContentBlockParam[] {
  const pengantar = `Berikut materi dari ${sumber.label}. Tarik isinya sesuai aturan di atas.`;

  if (sumber.jenis === "pdf" && sumber.pdf_base64) {
    // Dokumen ditaruh sebelum teks, sesuai anjuran untuk masukan berkas.
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: sumber.pdf_base64,
        },
      },
      { type: "text", text: pengantar },
    ];
  }

  return [{ type: "text", text: `${pengantar}\n\n${sumber.teks ?? ""}` }];
}

export async function ekstrak_materi(sumber: Sumber): Promise<HasilImpor> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      alasan:
        "ANTHROPIC_API_KEY belum diisi di .env.local, jadi materi belum bisa dibaca otomatis.",
    };
  }

  if (sumber.jenis !== "pdf" && !sumber.teks?.trim()) {
    return { ok: false, alasan: "Sumbernya kosong, tidak ada yang bisa dibaca." };
  }

  const client = new Anthropic();
  const model = model_terpakai();

  // Haiku 4.5 menolak adaptive thinking dan effort dengan galat 400, jadi
  // parameter itu cuma dikirim ke model yang memang mendukungnya.
  const penalaran = MODEL[model].penalaran_adaptif
    ? { thinking: { type: "adaptive" as const } }
    : {};
  const effort = MODEL[model].penalaran_adaptif
    ? { effort: "medium" as const }
    : {};
  const cadangan = MODEL[model].fallback_penolakan
    ? {
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default" as const,
      }
    : {};

  let jawaban;
  try {
    jawaban = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: INSTRUKSI,
      ...penalaran,
      output_config: {
        format: zodOutputFormat(SkemaEkstraksi),
        ...effort,
      },
      // Kalau permintaan ditolak penyaring keamanan, layanan ini mengulang
      // sendiri di model cadangan alih-alih gagal di depan pengguna. Model
      // keluarga lama tidak mendukungnya, jadi tidak dikirim ke sana.
      ...cadangan,
      messages: [{ role: "user", content: isi_pesan(sumber) }],
    });
  } catch (e) {
    return {
      ok: false,
      alasan: `Gagal menghubungi Claude: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // stop_reason diperiksa sebelum menyentuh isi. Penolakan datang sebagai
  // HTTP 200, jadi membaca content lebih dulu akan menghasilkan hasil kosong
  // yang terlihat seperti dokumen tanpa isi.
  if (jawaban.stop_reason === "refusal") {
    return {
      ok: false,
      alasan:
        "Claude menolak memproses dokumen ini. Coba dokumen lain, atau masukkan materinya manual.",
    };
  }

  if (jawaban.stop_reason === "max_tokens") {
    return {
      ok: false,
      alasan:
        "Dokumennya terlalu panjang untuk sekali baca. Coba potong jadi beberapa bagian.",
    };
  }

  const hasil = jawaban.parsed_output;
  if (!hasil) {
    return { ok: false, alasan: "Hasil bacaan Claude tidak sesuai bentuk yang diminta." };
  }

  return {
    ok: true,
    hasil,
    token_masuk: jawaban.usage.input_tokens,
    token_keluar: jawaban.usage.output_tokens,
  };
}
