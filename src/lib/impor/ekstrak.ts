import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SkemaEkstraksi, type HasilEkstraksi, type Sumber } from "./jenis";

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

const MODEL = "claude-opus-5";

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

  let jawaban;
  try {
    jawaban = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: INSTRUKSI,
      thinking: { type: "adaptive" },
      output_config: {
        format: zodOutputFormat(SkemaEkstraksi),
        // Ekstraksi tabel harga butuh ketelitian, tapi bukan penalaran berat.
        effort: "medium",
      },
      // Kalau permintaan ditolak penyaring keamanan, layanan ini mengulang
      // sendiri di model cadangan alih-alih gagal di depan pengguna.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
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
