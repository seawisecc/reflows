/**
 * Definisi paket langganan.
 *
 * Ditaruh di kode, bukan di database, karena ini definisi produk bukan data
 * per pelanggan. Harga dan kuota sebuah paket sama untuk semua tenant yang
 * memakainya, dan menaruhnya di database berarti suatu saat ada tenant yang
 * paketnya diam-diam berbeda dari yang tertulis di brosur.
 *
 * Angkanya berasal dari hitungan di docs/keputusan-produk.md. Biaya AI yang
 * dipakai berhitung Rp 80 per balasan, dua kali lipat biaya terukur.
 */

export type NamaPaket = "mulai" | "tumbuh" | "penuh";

export type SifatPaket = {
  label: string;
  harga_bulanan: number;
  /** Balasan AI yang termasuk paket, per bulan kalender. */
  balasan_ai: number;
  /** Tarif per balasan setelah kuota habis. */
  tarif_kelebihan: number;
  nomor_whatsapp: number;
  /** null berarti tanpa batas. */
  impor_dokumen: number | null;
  pesan_kampanye: number;
  keterangan: string;
};

export const PAKET: Record<NamaPaket, SifatPaket> = {
  mulai: {
    label: "Mulai",
    harga_bulanan: 349_000,
    balasan_ai: 750,
    tarif_kelebihan: 300,
    nomor_whatsapp: 1,
    impor_dokumen: 5,
    pesan_kampanye: 0,
    keterangan: "Toko atau jasa yang chatnya belasan sehari",
  },
  tumbuh: {
    label: "Tumbuh",
    harga_bulanan: 749_000,
    balasan_ai: 2_500,
    tarif_kelebihan: 250,
    nomor_whatsapp: 1,
    impor_dokumen: 25,
    pesan_kampanye: 500,
    keterangan: "Bisnis yang chatnya puluhan sehari dan mulai mengejar prospek",
  },
  penuh: {
    label: "Penuh",
    harga_bulanan: 1_490_000,
    balasan_ai: 8_000,
    tarif_kelebihan: 200,
    nomor_whatsapp: 3,
    impor_dokumen: null,
    pesan_kampanye: 3_000,
    keterangan: "Bisnis dengan beberapa cabang atau beberapa nomor",
  },
};

export function paket_sah(nilai: unknown): nilai is NamaPaket {
  return typeof nilai === "string" && nilai in PAKET;
}

/** Ambang peringatan, dipasang sebelum kuota benar-benar habis. */
export const AMBANG_PERINGATAN = 0.8;

export type KeadaanKuota = {
  paket: NamaPaket;
  /** Balasan AI bulan ini, sudah termasuk yang jadi draf. */
  terpakai: number;
  /**
   * Berapa balasan kelebihan yang diizinkan tenant.
   * null berarti tanpa batas, 0 berarti berhenti tepat di kuota.
   */
  batas_kelebihan: number | null;
};

export type IzinKuota = {
  boleh: boolean;
  kuota: number;
  terpakai: number;
  sisa: number;
  /** Berapa balasan yang sudah lewat kuota. Nol selama masih di dalam. */
  kelebihan: number;
  /** Perkiraan tagihan kelebihan dalam rupiah. */
  biaya_kelebihan: number;
  /** 0 sampai 1 lebih. Dipakai bar di layar. */
  rasio: number;
  peringatan: boolean;
  sebab: string | null;
};

/**
 * Boleh menyusun satu balasan AI lagi atau tidak.
 *
 * Kuota yang habis tidak langsung mematikan AI, karena client yang tidak
 * dibalas lebih merugikan tenant daripada tagihan kelebihan yang wajar.
 * Yang membatasi justru angka yang dipasang tenant sendiri, supaya tidak
 * ada yang kaget di akhir bulan.
 */
export function izin_kuota(k: KeadaanKuota): IzinKuota {
  const sifat = PAKET[k.paket];
  const kuota = sifat.balasan_ai;
  const terpakai = Math.max(0, Math.floor(k.terpakai));
  const kelebihan = Math.max(0, terpakai - kuota);
  const sisa = Math.max(0, kuota - terpakai);
  const rasio = kuota > 0 ? terpakai / kuota : 0;

  const dasar: Omit<IzinKuota, "boleh" | "sebab"> = {
    kuota,
    terpakai,
    sisa,
    kelebihan,
    biaya_kelebihan: kelebihan * sifat.tarif_kelebihan,
    rasio,
    peringatan: rasio >= AMBANG_PERINGATAN,
  };

  // Dibandingkan dengan terpakai, bukan dengan kelebihan. Kelebihan bernilai
  // nol baik saat masih di dalam kuota maupun tepat saat habis, jadi
  // membandingkannya membuat AI berhenti satu balasan terlalu cepat.
  if (
    k.batas_kelebihan !== null &&
    terpakai >= kuota + k.batas_kelebihan
  ) {
    return {
      ...dasar,
      boleh: false,
      sebab:
        k.batas_kelebihan === 0
          ? `Kuota paket ${sifat.label} bulan ini sudah habis, ${terpakai} dari ${kuota} balasan. Batas kelebihan disetel nol, jadi AI berhenti membalas sampai bulan depan.`
          : `Kuota paket ${sifat.label} habis dan batas kelebihan ${k.batas_kelebihan} balasan juga sudah tercapai. AI berhenti membalas sampai batasnya dinaikkan.`,
    };
  }

  return { ...dasar, boleh: true, sebab: null };
}

/** Perkiraan tagihan bulan ini, pokok ditambah kelebihan. */
export function tagihan_bulan_ini(k: KeadaanKuota): number {
  const izin = izin_kuota(k);
  return PAKET[k.paket].harga_bulanan + izin.biaya_kelebihan;
}
