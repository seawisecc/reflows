import type {
  BarisKontak,
  BarisPercakapan,
  Gudang,
  KonteksTenant,
} from "@/lib/penerimaan";
import type { StatusPercakapan } from "@/tipe";

export type PesanTersimpan = {
  id: string;
  tenant_id: string;
  percakapan_id: string;
  isi: string;
  wa_message_id: string | null;
  waktu: string;
};

export const TENANT_UJI: KonteksTenant = {
  tenant_id: "tenant-seawise",
  nomor_wa: "6281338291000",
  mode_balas: "hybrid",
  jam_mulai: "08:00",
  jam_selesai: "20:00",
  zona_waktu: "Asia/Makassar",
  pesan_di_luar_jam: "Terima kasih, di luar jam kerja. Dibalas besok pagi.",
};

/**
 * Penyimpanan di memori untuk menguji logika penerimaan tanpa database.
 * Sengaja meniru perilaku yang penting saja: kunci unik nomor per tenant,
 * satu percakapan per kontak, dan penolakan pesan dengan id yang sama.
 */
export function gudang_memori(tenant: KonteksTenant = TENANT_UJI) {
  const rahasia_benar = "rahasia-uji";
  const kontak = new Map<string, BarisKontak & { nomor: string; nama: string | null }>();
  const percakapan = new Map<string, BarisPercakapan & { kontak_id: string }>();
  const pesan: PesanTersimpan[] = [];
  let urut = 0;

  const gudang: Gudang = {
    async tenant_dari_rahasia(r) {
      return r === rahasia_benar ? tenant : null;
    },

    async pesan_sudah_ada(tenant_id, wa_message_id) {
      return pesan.some(
        (p) => p.tenant_id === tenant_id && p.wa_message_id === wa_message_id,
      );
    },

    async pastikan_kontak(_tenant_id, nomor, nama) {
      for (const k of kontak.values()) {
        if (k.nomor === nomor) {
          if (nama && !k.nama) k.nama = nama;
          return { id: k.id, opt_out_at: k.opt_out_at };
        }
      }
      urut += 1;
      const baru = { id: `kontak-${urut}`, nomor, nama, opt_out_at: null };
      kontak.set(baru.id, baru);
      return { id: baru.id, opt_out_at: null };
    },

    async pastikan_percakapan(_tenant_id, kontak_id) {
      for (const p of percakapan.values()) {
        if (p.kontak_id === kontak_id) return { ...p };
      }
      urut += 1;
      const baru = {
        id: `percakapan-${urut}`,
        kontak_id,
        status: "ai" as StatusPercakapan,
        luar_jam_dibalas_at: null,
      };
      percakapan.set(baru.id, baru);
      return { ...baru };
    },

    async catat_pesan_masuk(m) {
      urut += 1;
      const baris: PesanTersimpan = { id: `pesan-${urut}`, ...m };
      pesan.push(baris);
      return baris.id;
    },

    async tandai_opt_out(kontak_id, waktu) {
      const k = kontak.get(kontak_id);
      if (k) k.opt_out_at = waktu;
    },

    async ubah_status_percakapan(percakapan_id, status) {
      const p = percakapan.get(percakapan_id);
      if (p) p.status = status;
    },

    async catat_luar_jam_dibalas(percakapan_id, waktu) {
      const p = percakapan.get(percakapan_id);
      if (p) p.luar_jam_dibalas_at = waktu;
    },
  };

  return { gudang, rahasia_benar, kontak, percakapan, pesan };
}
