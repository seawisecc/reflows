import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MODEL, model_sah, type NamaModel } from "./model";
import type { ModeBalas, Pesan } from "@/tipe";

/**
 * Mesin balasan otomatis.
 *
 * Modelnya Haiku 4.5 karena jalur ini yang jalan ribuan kali sebulan, dan
 * itu yang menentukan biaya bulanan tenant. Ketelitian dijaga bukan dengan
 * model mahal, tapi dengan tiga hal lain: materi admin sebagai satu-satunya
 * sumber harga, ambang keyakinan yang bisa disetel, dan jalur eskalasi yang
 * selalu tersedia.
 */

const MODEL_BAWAAN: NamaModel = "claude-haiku-4-5";

/** Giliran terakhir yang dikirim ke model. Lebih dari ini jarang menambah. */
const MAKS_GILIRAN = 12;

const SkemaBalasan = z.object({
  balasan: z
    .string()
    .describe("Balasan untuk dikirim ke WhatsApp. Kosongkan kalau menyerah."),
  keyakinan: z
    .number()
    .describe(
      "Seberapa yakin balasan ini benar dan aman dikirim tanpa diperiksa manusia. 0 sampai 1.",
    ),
  butuh_manusia: z
    .boolean()
    .describe("true kalau pertanyaannya di luar kemampuanmu atau di luar materi."),
  alasan: z
    .string()
    .nullable()
    .describe("Kalau butuh_manusia true, sebutkan alasannya dalam satu kalimat."),
});

export type Jejak = {
  model: string;
  token_masuk: number;
  token_keluar: number;
  token_cache_baca: number;
  token_cache_tulis: number;
  latensi_ms: number;
};

export type KeputusanBalas =
  | { jenis: "kirim"; teks: string; keyakinan: number; jejak: Jejak }
  | {
      jenis: "draf";
      teks: string;
      keyakinan: number;
      alasan: string;
      jejak: Jejak;
    }
  | { jenis: "eskalasi"; alasan: string; jejak: Jejak | null }
  | { jenis: "gagal"; alasan: string };

function model_terpakai(): NamaModel {
  const dari_env = process.env.MODEL_BALASAN;
  return model_sah(dari_env) ? dari_env : MODEL_BAWAAN;
}

/** Riwayat percakapan jadi giliran user dan assistant yang dipahami model. */
function ke_giliran(pesan: Pesan[]): Anthropic.MessageParam[] {
  const giliran: Anthropic.MessageParam[] = [];
  for (const p of pesan.slice(-MAKS_GILIRAN)) {
    const peran = p.arah === "masuk" ? "user" : "assistant";
    const isi = p.isi.trim();
    if (!isi) continue;
    // Giliran berurutan dengan peran sama digabung, karena API menolak dua
    // giliran user beruntun dan client memang sering mengirim beberapa
    // pesan pendek berturut-turut.
    const terakhir = giliran[giliran.length - 1];
    if (terakhir?.role === peran && typeof terakhir.content === "string") {
      terakhir.content = `${terakhir.content}\n${isi}`;
    } else {
      giliran.push({ role: peran, content: isi });
    }
  }
  return giliran;
}

export async function susun_balasan(masukan: {
  instruksi: string;
  pesan: Pesan[];
  mode_balas: ModeBalas;
  ambang_keyakinan: number;
}): Promise<KeputusanBalas> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { jenis: "gagal", alasan: "ANTHROPIC_API_KEY belum diisi." };
  }

  const giliran = ke_giliran(masukan.pesan);
  if (giliran.length === 0 || giliran[giliran.length - 1]?.role !== "user") {
    return { jenis: "gagal", alasan: "Tidak ada pesan masuk yang perlu dibalas." };
  }

  const model = model_terpakai();
  const client = new Anthropic();
  const mulai = Date.now();

  let jawaban;
  try {
    jawaban = await client.messages.parse({
      model,
      max_tokens: 2000,
      // Instruksi ditandai untuk di-cache. Isinya sama untuk setiap balasan
      // tenant ini, jadi mulai balasan kedua bagian ini dibayar jauh lebih
      // murah. Bagian yang berubah, yaitu percakapannya, ada di messages
      // dan sengaja ditaruh setelah titik cache.
      system: [
        {
          type: "text",
          text: masukan.instruksi,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: { format: zodOutputFormat(SkemaBalasan) },
      messages: giliran,
    });
  } catch (e) {
    return {
      jenis: "gagal",
      alasan: `Gagal menghubungi Claude: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const jejak: Jejak = {
    model,
    token_masuk: jawaban.usage.input_tokens,
    token_keluar: jawaban.usage.output_tokens,
    token_cache_baca: jawaban.usage.cache_read_input_tokens ?? 0,
    token_cache_tulis: jawaban.usage.cache_creation_input_tokens ?? 0,
    latensi_ms: Date.now() - mulai,
  };

  if (jawaban.stop_reason === "refusal") {
    return {
      jenis: "eskalasi",
      alasan: "Claude menolak menjawab pesan ini.",
      jejak,
    };
  }

  const hasil = jawaban.parsed_output;
  if (!hasil) {
    return { jenis: "eskalasi", alasan: "Bentuk jawaban Claude tidak terbaca.", jejak };
  }

  const teks = hasil.balasan.trim();
  // Keyakinan dijepit ke rentang yang sah. Model kadang mengembalikan angka
  // di luar 0 sampai 1, dan nilai liar tidak boleh menembus ambang batas.
  const keyakinan = Math.min(1, Math.max(0, Number(hasil.keyakinan) || 0));

  if (hasil.butuh_manusia || !teks) {
    return {
      jenis: "eskalasi",
      alasan: hasil.alasan?.trim() || "AI menyerahkan percakapan ini ke manusia.",
      jejak,
    };
  }

  // Mode draf berarti tidak ada yang terkirim tanpa persetujuan, seyakin
  // apa pun modelnya.
  if (masukan.mode_balas === "draf") {
    return {
      jenis: "draf",
      teks,
      keyakinan,
      alasan: "Mode draf, semua balasan menunggu persetujuan",
      jejak,
    };
  }

  if (masukan.mode_balas === "otomatis" || keyakinan >= masukan.ambang_keyakinan) {
    return { jenis: "kirim", teks, keyakinan, jejak };
  }

  return {
    jenis: "draf",
    teks,
    keyakinan,
    alasan: `Keyakinan ${Math.round(keyakinan * 100)} persen, di bawah ambang ${Math.round(
      masukan.ambang_keyakinan * 100,
    )} persen`,
    jejak,
  };
}

export { MODEL as SIFAT_MODEL };
