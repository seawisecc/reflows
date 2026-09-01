import type { HasilEkstraksi } from "@/lib/impor/jenis";

/**
 * Tipe dan nilai awal untuk formulir impor.
 *
 * Sengaja terpisah dari aksi.ts. Berkas dengan "use server" hanya boleh
 * mengekspor fungsi async, jadi konstanta apa pun yang ditaruh di sana akan
 * lolos build dan lolos lint, lalu meruntuhkan halaman saat dibuka.
 */

export type KeadaanImpor = {
  galat: string | null;
  label: string | null;
  hasil: HasilEkstraksi | null;
  biaya: { token_masuk: number; token_keluar: number } | null;
};

export const IMPOR_AWAL: KeadaanImpor = {
  galat: null,
  label: null,
  hasil: null,
  biaya: null,
};

export type KeadaanSimpan = { galat: string | null; pesan: string | null };

export const SIMPAN_AWAL: KeadaanSimpan = { galat: null, pesan: null };
