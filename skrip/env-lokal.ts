import { readFileSync } from "node:fs";

/**
 * Membaca .env.local untuk skrip yang jalan di luar Next.js.
 * Next memuat berkas ini sendiri, skrip biasa tidak.
 */
export function muat_env(berkas = ".env.local"): Record<string, string> {
  const isi: Record<string, string> = {};
  let mentah: string;
  try {
    mentah = readFileSync(berkas, "utf8");
  } catch {
    throw new Error(
      `${berkas} tidak ada. Salin .env.example jadi .env.local lalu isi.`,
    );
  }
  for (const baris of mentah.split("\n")) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith("#")) continue;
    const pisah = bersih.indexOf("=");
    if (pisah === -1) continue;
    isi[bersih.slice(0, pisah)] = bersih.slice(pisah + 1).trim();
  }
  for (const [k, v] of Object.entries(isi)) {
    if (!process.env[k]) process.env[k] = v;
  }
  return isi;
}
