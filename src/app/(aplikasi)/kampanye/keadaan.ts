/**
 * Nilai awal formulir kampanye. Terpisah dari aksi.ts karena berkas
 * "use server" hanya boleh mengekspor fungsi async.
 */
export type KeadaanKampanye = {
  galat: string | null;
  pesan: string | null;
  /** Diisi setelah kampanye baru dibuat, supaya layar bisa berpindah. */
  id: string | null;
};

export const KAMPANYE_AWAL: KeadaanKampanye = {
  galat: null,
  pesan: null,
  id: null,
};
