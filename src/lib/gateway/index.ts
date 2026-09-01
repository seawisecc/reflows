import type { Gateway } from "./jenis";
import { gateway_fonnte } from "./fonnte";
import { gateway_mock } from "./mock";

export type { Gateway, HasilKirim, PesanMasuk, PermintaanKirim } from "./jenis";
export { normalkan_nomor, tampilkan_nomor, nomor_sama } from "./nomor";
export { gateway_mock } from "./mock";
export { gateway_fonnte, baca_webhook_fonnte } from "./fonnte";

/**
 * Memilih gateway berdasarkan pengaturan tenant. Tanpa token, apa pun
 * penyedianya, yang dipakai tetap yang tiruan. Lebih baik pesan tidak
 * terkirim ke mana-mana daripada meledak di tengah percakapan client.
 */
export function pilih_gateway(pengaturan: {
  gateway: string;
  token: string | null;
}): Gateway {
  if (pengaturan.gateway === "fonnte" && pengaturan.token) {
    return gateway_fonnte(pengaturan.token);
  }
  return gateway_mock();
}
