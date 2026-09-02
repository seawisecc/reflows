/**
 * Menentukan apa yang boleh jalan saat layanan sebuah tenant dimatikan.
 *
 * Fungsi murni tanpa akses database, karena keputusannya dipakai di empat
 * tempat: webhook yang menerima chat, antrean kampanye, tombol kirim di
 * inbox, dan spanduk di layar. Kalau masing-masing menghitung sendiri,
 * suatu saat layar bilang "berjalan normal" sementara webhook sudah diam.
 */

export type KeadaanLayanan = {
  /** tenants.aktif. Saklar milik Seawise, tenant tidak bisa mengubahnya. */
  aktif: boolean;
  /** pengaturan_tenant.dijeda_at. Saklar milik tenant sendiri. */
  dijeda_at: string | null;
};

export type JenisLayanan = "menyala" | "dijeda" | "disuspensi";

export type IzinLayanan = {
  jenis: JenisLayanan;
  /** Semua otomasi hidup. */
  menyala: boolean;
  /** AI boleh menyusun dan mengirim balasan. */
  balas_ai: boolean;
  /** Antrean kampanye boleh mengirim. */
  kampanye: boolean;
  /** Manusia boleh mengetik balasan sendiri dari inbox. */
  kirim_manual: boolean;
  /** Pesan masuk tetap dicatat. Selalu true, dan memang disengaja. */
  catat_pesan_masuk: boolean;
  sebab: string | null;
};

/**
 * Suspensi dan jeda sengaja berbeda dalam satu hal: kirim manual.
 *
 * Tenant yang menjeda sendiri biasanya mau memegang chatnya sendiri dulu,
 * misalnya karena sedang promo dan jawabannya belum masuk materi. Mematikan
 * tombol kirimnya di situ malah memaksa dia pindah ke aplikasi WhatsApp
 * biasa, dan riwayatnya jadi terbelah dua.
 *
 * Suspensi dari Seawise beda perkara. Di situ layanannya memang berhenti,
 * jadi tidak ada satu pun pesan yang boleh keluar lewat Reflows.
 */
export function izin_layanan(k: KeadaanLayanan): IzinLayanan {
  if (!k.aktif) {
    return {
      jenis: "disuspensi",
      menyala: false,
      balas_ai: false,
      kampanye: false,
      kirim_manual: false,
      catat_pesan_masuk: true,
      sebab:
        "Layanan sedang disuspensi. Data kamu tetap utuh, tapi tidak ada pesan yang bisa dikirim sampai langganannya diaktifkan lagi.",
    };
  }

  if (k.dijeda_at) {
    return {
      jenis: "dijeda",
      menyala: false,
      balas_ai: false,
      kampanye: false,
      kirim_manual: true,
      catat_pesan_masuk: true,
      sebab:
        "Otomasi sedang kamu jeda. Chat yang masuk tetap tercatat, tapi AI tidak membalas dan kampanye tidak mengirim.",
    };
  }

  return {
    jenis: "menyala",
    menyala: true,
    balas_ai: true,
    kampanye: true,
    kirim_manual: true,
    catat_pesan_masuk: true,
    sebab: null,
  };
}

/**
 * Berapa lama sudah dijeda, untuk ditampilkan di spanduk.
 * Null kalau memang sedang berjalan.
 */
export function lama_dijeda(
  dijeda_at: string | null,
  sekarang = new Date(),
): number | null {
  if (!dijeda_at) return null;
  const mulai = new Date(dijeda_at).getTime();
  if (!Number.isFinite(mulai)) return null;
  return Math.max(0, Math.floor((sekarang.getTime() - mulai) / 86400_000));
}
