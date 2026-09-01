import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Enkripsi token gateway sebelum masuk database.
 *
 * Kalau database bocor, token WhatsApp semua tenant ikut bocor, dan siapa
 * pun yang memegangnya bisa mengirim pesan atas nama bisnis mereka. Kunci
 * enkripsinya hidup di variabel lingkungan, bukan di database, jadi satu
 * kebocoran saja tidak cukup untuk membuka isinya.
 *
 * AES-256-GCM dipilih karena sekalian memverifikasi keutuhan data, jadi
 * ciphertext yang diubah orang akan ditolak, bukan diam-diam menghasilkan
 * token ngawur.
 */

const PANJANG_IV = 12; // ukuran nonce yang dianjurkan untuk GCM
const PANJANG_TAG = 16;

function kunci(): Buffer {
  const mentah = process.env.KUNCI_ENKRIPSI;
  if (!mentah) {
    throw new Error(
      "KUNCI_ENKRIPSI belum diisi. Salin .env.example jadi .env.local lalu lengkapi.",
    );
  }
  const buf = Buffer.from(mentah, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `KUNCI_ENKRIPSI harus 32 byte dalam base64, yang ada ${buf.length} byte.`,
    );
  }
  return buf;
}

export function enkripsi(teks_asli: string): string {
  const iv = randomBytes(PANJANG_IV);
  const sandi = createCipheriv("aes-256-gcm", kunci(), iv);
  const isi = Buffer.concat([sandi.update(teks_asli, "utf8"), sandi.final()]);
  return Buffer.concat([iv, sandi.getAuthTag(), isi]).toString("base64");
}

export function dekripsi(tersandi: string): string {
  const buf = Buffer.from(tersandi, "base64");
  if (buf.length <= PANJANG_IV + PANJANG_TAG) {
    throw new Error("Data tersandi terlalu pendek, kemungkinan rusak.");
  }
  const iv = buf.subarray(0, PANJANG_IV);
  const tag = buf.subarray(PANJANG_IV, PANJANG_IV + PANJANG_TAG);
  const isi = buf.subarray(PANJANG_IV + PANJANG_TAG);

  const buka = createDecipheriv("aes-256-gcm", kunci(), iv);
  buka.setAuthTag(tag);
  return Buffer.concat([buka.update(isi), buka.final()]).toString("utf8");
}

/** Dipakai di layar pengaturan supaya token bisa dikenali tanpa dibuka penuh. */
export function samarkan_token(token: string): string {
  if (token.length <= 8) return "*".repeat(token.length);
  return `${token.slice(0, 4)}${"*".repeat(token.length - 8)}${token.slice(-4)}`;
}
