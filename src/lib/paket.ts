/**
 * Definisi paket langganan.
 *
 * Ditaruh di kode, bukan di database, karena ini definisi produk bukan data
 * per pelanggan. Harga dan kuota sebuah paket sama untuk semua tenant yang
 * memakainya, dan menaruhnya di database berarti suatu saat ada tenant yang
 * paketnya diam-diam berbeda dari yang tertulis di brosur.
 *
 * Angkanya berasal dari hitungan di docs/keputusan-produk.md.
 *
 * Sejak 3 September 2026 gateway WhatsApp ikut ditanggung Seawise dan
 * dimasukkan ke harga paket, tidak lagi dibeli sendiri oleh tenant. Itu
 * membalik keputusan sebelumnya, dan alasannya ada di docs. Akibatnya biaya
 * per tenant naik satu paket Fonnte Master, dan harga paket ikut naik.
 */

/**
 * Biaya model per balasan yang dipakai menghitung paket, dalam rupiah.
 * Dua kali lipat biaya terukur, jadi kalau nyatanya lebih murah marjinnya
 * lebih besar, bukan lebih kecil.
 */
export const BIAYA_AI_PER_BALASAN = 80;

/**
 * Biaya gateway per nomor per bulan, ditanggung Seawise.
 *
 * Paket Master Fonnte, yang paling murah tanpa tulisan "Sent via
 * fonnte.com" di tiap pesan keluar. Paketnya berlaku per device, bukan per
 * akun, jadi satu akun Fonnte yang menampung banyak nomor tetap membayar
 * sebanyak nomornya. Kutipan dokumentasi Fonnte ada di docs.
 */
export const BIAYA_GATEWAY_PER_NOMOR = 175_000;

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
    harga_bulanan: 499_000,
    balasan_ai: 750,
    tarif_kelebihan: 300,
    nomor_whatsapp: 1,
    impor_dokumen: 5,
    pesan_kampanye: 0,
    keterangan: "Toko atau jasa yang chatnya belasan sehari",
  },
  tumbuh: {
    label: "Tumbuh",
    harga_bulanan: 949_000,
    balasan_ai: 2_500,
    tarif_kelebihan: 250,
    nomor_whatsapp: 1,
    impor_dokumen: 25,
    pesan_kampanye: 500,
    keterangan: "Bisnis yang chatnya puluhan sehari dan mulai mengejar prospek",
  },
  penuh: {
    label: "Penuh",
    harga_bulanan: 1_690_000,
    balasan_ai: 8_000,
    tarif_kelebihan: 200,
    // Satu, bukan tiga. Reflows menyimpan tepat satu kredensial gateway per
    // tenant, dan webhooknya menolak pesan dari nomor perangkat lain. Angka
    // di sini pernah tiga, dan itu janji yang tidak bisa ditepati mesin.
    // Dinaikkan lagi kalau dukungan banyak nomor sudah benar-benar ada.
    nomor_whatsapp: 1,
    impor_dokumen: null,
    pesan_kampanye: 3_000,
    keterangan: "Bisnis dengan chat padat dan kampanye rutin",
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

/**
 * Biaya penuh satu tenant sebulan kalau kuotanya dipakai habis, dalam
 * rupiah. Model ditambah gateway. Tidak termasuk biaya tetap Seawise
 * seperti Supabase dan Vercel, yang dibagi bersama semua tenant.
 */
export function biaya_penuh(paket: NamaPaket): number {
  const sifat = PAKET[paket];
  return (
    sifat.balasan_ai * BIAYA_AI_PER_BALASAN +
    sifat.nomor_whatsapp * BIAYA_GATEWAY_PER_NOMOR
  );
}

/** Marjin saat kuotanya terpakai habis. Ini keadaan terburuknya, karena
 *  kuota yang tidak terpakai habis berarti biayanya lebih kecil. */
export function marjin_penuh(paket: NamaPaket): number {
  return PAKET[paket].harga_bulanan - biaya_penuh(paket);
}
