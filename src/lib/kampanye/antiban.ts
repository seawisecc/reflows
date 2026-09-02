import { dalam_jam_aktif } from "@/lib/aturan";

/**
 * Rem-rem mesin kampanye keluar.
 *
 * Semuanya fungsi murni tanpa akses database, karena aturan ini dipakai di
 * dua tempat: antrean yang benar-benar mengirim, dan layar yang menjelaskan
 * kenapa kampanye sedang diam. Kalau keduanya menghitung sendiri-sendiri,
 * suatu saat layar akan bilang "sedang mengirim" sementara antreannya sudah
 * berhenti berjam-jam, dan tidak ada yang tahu mana yang benar.
 *
 * Nomor WhatsApp yang diblokir tidak bisa dibanding. Percakapan client yang
 * sedang berjalan ikut mati bersamanya. Karena itu setiap fungsi di sini
 * defaultnya menolak mengirim, bukan mengizinkan.
 */

/** Naik 30 persen sehari dari batas awal, berhenti di batas maksimum. */
export const LAJU_WARMUP = 1.3;

/**
 * Berapa pesan yang boleh keluar pada hari ke-n sebuah kampanye.
 *
 * Nomor baru yang langsung mengirim ratusan pesan adalah cara tercepat kena
 * blokir. Dari 20 pesan di hari pertama, kenaikan 30 persen sehari sampai
 * di 150 pada hari kesembilan. Cukup pelan untuk terlihat seperti orang
 * yang makin sibuk, bukan seperti mesin yang baru dinyalakan.
 */
export function batas_hari_ke(
  awal: number,
  maks: number,
  hari: number,
): number {
  const n = Math.max(1, Math.floor(hari));
  const tumbuh = Math.round(awal * Math.pow(LAJU_WARMUP, n - 1));
  return Math.max(1, Math.min(maks, tumbuh));
}

/**
 * Jeda sebelum pesan berikutnya, dalam detik.
 *
 * Yang disimpan rentang, bukan satu angka, karena interval tetap adalah
 * pola paling gampang dikenali sebagai robot. Sumber acaknya bisa disuntik
 * supaya bisa diuji tanpa hasil yang berubah-ubah.
 */
export function jeda_acak(
  min_detik: number,
  maks_detik: number,
  acak: () => number = Math.random,
): number {
  const bawah = Math.max(1, Math.floor(min_detik));
  const atas = Math.max(bawah, Math.floor(maks_detik));
  return bawah + Math.floor(acak() * (atas - bawah + 1));
}

/** Sidik jari stabil dari sebuah teks. Bukan kriptografi, cuma penyebar. */
function sidik(teks: string): number {
  let n = 2166136261;
  for (let i = 0; i < teks.length; i++) {
    n ^= teks.charCodeAt(i);
    n = Math.imul(n, 16777619);
  }
  return n >>> 0;
}

/**
 * Memilih satu tulisan dari beberapa varian.
 *
 * Dipilih dari sidik jari kuncinya, bukan diacak, karena dua hal. Pertama,
 * satu sasaran harus selalu menerima varian yang sama kalau pengirimannya
 * diulang setelah gagal, kalau tidak dia menerima dua kalimat berbeda untuk
 * maksud yang sama. Kedua, hasilnya bisa diuji.
 */
export function pilih_varian(varian: string[], kunci: string): string {
  const bersih = varian.map((v) => v.trim()).filter(Boolean);
  if (bersih.length === 0) return "";
  return bersih[sidik(kunci) % bersih.length];
}

export type IsianPesan = {
  nama: string | null;
  bisnis: string;
};

/** Dipakai kalau kontak belum punya nama. Netral dan lazim di Indonesia. */
export const SAPAAN_CADANGAN = "Kak";

/**
 * Mengisi templat dengan data kontak.
 *
 * Penanda yang tidak dikenali dibuang, bukan dibiarkan. Mengirim
 * "Halo {{nama_depan}}" ke calon client jauh lebih memalukan daripada
 * mengirim kalimat yang kehilangan satu kata.
 */
export function susun_pesan(templat: string, isian: IsianPesan): string {
  const nilai: Record<string, string> = {
    nama: isian.nama?.trim() || SAPAAN_CADANGAN,
    bisnis: isian.bisnis.trim(),
  };

  return templat
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, kunci: string) =>
      nilai[kunci.toLowerCase()] ?? "",
    )
    // Sisa spasi ganda dan spasi sebelum tanda baca dirapikan, supaya
    // penanda yang terbuang tidak meninggalkan bekas.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

export type KeadaanRem = {
  /** Sasaran yang sudah menerima minimal satu pesan. */
  tersentuh: number;
  /** Sasaran yang membalas. */
  dibalas: number;
  rem_min_terkirim: number;
  rem_rasio_balas: number;
};

export type HasilRem = { rem: false } | { rem: true; alasan: string };

/**
 * Rem otomatis kalau rasio balasan anjlok.
 *
 * Penyebutnya sasaran yang sudah tersentuh, bukan seluruh daftar. Kalau
 * seluruh daftar yang dipakai, rasionya nol di awal dan rem menyala sebelum
 * satu pesan pun sempat dibalas.
 *
 * Rem baru boleh menyala setelah ambang jumlah tercapai. Dua dari tiga
 * orang tidak membalas itu wajar; dua dari tiga di sepuluh pesan pertama
 * belum berarti apa-apa.
 */
export function perlu_direm(keadaan: KeadaanRem): HasilRem {
  if (keadaan.tersentuh < keadaan.rem_min_terkirim) return { rem: false };

  const rasio = keadaan.dibalas / keadaan.tersentuh;
  if (rasio >= keadaan.rem_rasio_balas) return { rem: false };

  return {
    rem: true,
    alasan:
      `Rasio balasan ${(rasio * 100).toFixed(1)} persen dari ${keadaan.tersentuh} ` +
      `kontak, di bawah ambang ${(keadaan.rem_rasio_balas * 100).toFixed(0)} persen. ` +
      `Kampanye dijeda sendiri supaya nomor tidak dilaporkan.`,
  };
}

export type SebabDiam =
  | "status"
  | "antrean-kosong"
  | "luar-jam"
  | "jeda"
  | "batas-harian"
  | "kuota-tenant"
  | "tanpa-langkah";

export type KeputusanKirim =
  | { kirim: true; batas_hari_ini: number }
  | { kirim: false; jenis: SebabDiam; sebab: string; batas_hari_ini: number };

export type KeadaanKirim = {
  status: string;
  sekarang: Date;
  jam_mulai: string;
  jam_selesai: string;
  zona_waktu: string;
  boleh_kirim_lagi_at: string | null;
  batas_harian_awal: number;
  batas_harian_maks: number;
  hari_ke: number;
  terkirim_hari_ini: number;
  antre: number;
  jumlah_langkah: number;
  /** Sisa kuota harian tenant, dibagi bersama balasan AI. */
  sisa_kuota_tenant: number;
};

/**
 * Boleh mengirim satu pesan sekarang atau tidak, beserta alasannya.
 *
 * Urutan pemeriksaannya disengaja: yang paling murah dan paling menentukan
 * lebih dulu, supaya alasan yang ditampilkan ke pemilik selalu alasan yang
 * paling pokok. Kampanye yang dijeda dan sekaligus di luar jam kerja lebih
 * berguna dilaporkan sebagai "dijeda", karena itu yang bisa dia ubah.
 */
export function boleh_kirim(k: KeadaanKirim): KeputusanKirim {
  const batas = batas_hari_ke(
    k.batas_harian_awal,
    k.batas_harian_maks,
    k.hari_ke,
  );
  const tolak = (jenis: SebabDiam, sebab: string): KeputusanKirim => ({
    kirim: false,
    jenis,
    sebab,
    batas_hari_ini: batas,
  });

  if (k.status !== "jalan") {
    return tolak("status", `Kampanye sedang berstatus ${k.status}.`);
  }
  if (k.jumlah_langkah === 0) {
    return tolak("tanpa-langkah", "Kampanye ini belum punya satu langkah pun.");
  }
  if (k.antre <= 0) {
    return tolak("antrean-kosong", "Tidak ada sasaran yang jatuh tempo.");
  }
  if (
    !dalam_jam_aktif(k.sekarang, k.jam_mulai, k.jam_selesai, k.zona_waktu)
  ) {
    return tolak(
      "luar-jam",
      `Di luar jam aktif ${k.jam_mulai} sampai ${k.jam_selesai}.`,
    );
  }
  if (k.boleh_kirim_lagi_at) {
    const boleh = new Date(k.boleh_kirim_lagi_at).getTime();
    if (Number.isFinite(boleh) && k.sekarang.getTime() < boleh) {
      const sisa = Math.ceil((boleh - k.sekarang.getTime()) / 1000);
      return tolak("jeda", `Menunggu jeda antar pesan, ${sisa} detik lagi.`);
    }
  }
  if (k.terkirim_hari_ini >= batas) {
    return tolak(
      "batas-harian",
      `Batas hari ini sudah tercapai, ${k.terkirim_hari_ini} dari ${batas} pesan.`,
    );
  }
  if (k.sisa_kuota_tenant <= 0) {
    return tolak(
      "kuota-tenant",
      "Kuota kirim harian nomor ini sudah habis, dipakai bersama balasan AI.",
    );
  }

  return { kirim: true, batas_hari_ini: batas };
}
