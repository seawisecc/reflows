import type { Gateway, HasilKirim, HasilQr, PermintaanKirim } from "./jenis";
import { baca_webhook_fonnte } from "./fonnte";
import { normalkan_nomor } from "./nomor";

export type PesanTercatat = PermintaanKirim & {
  wa_message_id: string;
  waktu: string;
};

/**
 * Gateway tiruan. Tidak menghubungi jaringan sama sekali, cuma mencatat apa
 * yang seharusnya terkirim. Dipakai untuk pengembangan dan pengujian supaya
 * tidak ada pesan nyasar ke nomor orang saat menggarap fitur.
 *
 * Bentuk muatan webhooknya sengaja sama dengan Fonnte, jadi jalur penerimaan
 * yang diuji di sini adalah jalur yang sama yang dipakai di produksi.
 */
export function gateway_mock(): Gateway & { terkirim: PesanTercatat[] } {
  const terkirim: PesanTercatat[] = [];
  let urutan = 0;

  return {
    nama: "mock",
    terkirim,

    async kirim({ ke, isi }: PermintaanKirim): Promise<HasilKirim> {
      const tujuan = normalkan_nomor(ke);
      if (!tujuan) return { ok: false, alasan: `Nomor tujuan tidak sah: ${ke}` };
      if (!isi.trim()) return { ok: false, alasan: "Isi pesan kosong" };

      urutan += 1;
      const catatan: PesanTercatat = {
        ke: tujuan,
        isi,
        wa_message_id: `mock-${urutan}`,
        waktu: new Date().toISOString(),
      };
      terkirim.push(catatan);
      return { ok: true, wa_message_id: catatan.wa_message_id };
    },

    baca_webhook: baca_webhook_fonnte,

    async qr(): Promise<HasilQr> {
      // Gateway tiruan selalu mengaku tersambung, supaya layar pengaturan
      // bisa dikerjakan dan diuji tanpa akun Fonnte sama sekali.
      return { keadaan: "tersambung" };
    },
  };
}
