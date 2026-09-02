/**
 * Nilai awal keadaan formulir kontak.
 *
 * Ditaruh di berkas terpisah karena berkas "use server" hanya boleh
 * mengekspor fungsi async. Konstanta di sana lolos TypeScript dan lolos
 * ESLint, lalu meruntuhkan halaman saat dibuka di produksi.
 */
export type KeadaanKontak = {
  galat: string | null;
  pesan: string | null;
};

export const KONTAK_AWAL: KeadaanKontak = { galat: null, pesan: null };
