/**
 * Nilai awal formulir invoice. Terpisah dari aksi.ts karena berkas
 * "use server" hanya boleh mengekspor fungsi async.
 */
export type KeadaanInvoice = {
  galat: string | null;
  pesan: string | null;
  id: string | null;
};

export const INVOICE_AWAL: KeadaanInvoice = {
  galat: null,
  pesan: null,
  id: null,
};
