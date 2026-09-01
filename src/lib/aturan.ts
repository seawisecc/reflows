/**
 * Aturan yang menentukan perlakuan sebuah pesan masuk. Sengaja ditaruh di
 * fungsi murni tanpa akses database, supaya bisa diuji tanpa menyalakan
 * apa pun dan supaya perilakunya sama di webhook maupun di layar.
 */

const KATA_BERHENTI = [
  "stop",
  "berhenti",
  "unsub",
  "unsubscribe",
  "hapus",
  "jangan kirim",
  "jangan hubungi",
  "keluar",
];

const KATA_MINTA_ORANG = [
  "admin",
  "adminnya",
  "orangnya",
  "manusia",
  "cs",
  "customer service",
  "bicara langsung",
  "ngomong langsung",
  "telepon",
  "ditelepon",
  "wa langsung",
  "owner",
  "pemilik",
];

const KATA_SENSITIF = [
  "komplain",
  "keluhan",
  "refund",
  "uang kembali",
  "batal",
  "pembatalan",
  "hukum",
  "pengacara",
  "polisi",
  "penipuan",
  "menipu",
  "tipu",
  "somasi",
];

function rapikan(isi: string): string {
  return isi
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Permintaan berhenti hanya diakui kalau pesannya memang pendek dan isinya
 * perintah berhenti. "Stop dulu ya, saya mau tanya harga" bukan opt-out, dan
 * kalau salah tafsir kita kehilangan calon client tanpa pernah tahu.
 */
export function minta_berhenti(isi: string): boolean {
  const bersih = rapikan(isi);
  if (!bersih) return false;

  const jumlah_kata = bersih.split(" ").length;
  if (jumlah_kata > 4) return false;

  return KATA_BERHENTI.some(
    (k) => bersih === k || bersih.startsWith(`${k} `) || bersih.endsWith(` ${k}`),
  );
}

export type AlasanEskalasi =
  | { eskalasi: false }
  | { eskalasi: true; alasan: string };

export function perlu_eskalasi(isi: string): AlasanEskalasi {
  const bersih = rapikan(isi);

  const sensitif = KATA_SENSITIF.find((k) => bersih.includes(k));
  if (sensitif) {
    return { eskalasi: true, alasan: `Terdeteksi kata sensitif: ${sensitif}` };
  }

  const minta = KATA_MINTA_ORANG.find(
    (k) => bersih === k || bersih.includes(` ${k}`) || bersih.startsWith(`${k} `),
  );
  if (minta) {
    return { eskalasi: true, alasan: "Kontak minta bicara dengan orang" };
  }

  return { eskalasi: false };
}

/** Membaca jam dinding di zona waktu tenant, bukan zona waktu server. */
export function jam_lokal(sekarang: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(sekarang);
}

function ke_menit(jam: string): number | null {
  const cocok = /^(\d{1,2}):(\d{2})/.exec(jam.trim());
  if (!cocok) return null;
  const j = Number(cocok[1]);
  const m = Number(cocok[2]);
  if (j > 23 || m > 59) return null;
  return j * 60 + m;
}

/**
 * Jam aktif boleh melewati tengah malam, misalnya 20.00 sampai 08.00 untuk
 * bisnis yang ramainya malam. Karena itu pembandingannya tidak bisa sekadar
 * mulai <= sekarang < selesai.
 */
export function dalam_jam_aktif(
  sekarang: Date,
  jam_mulai: string,
  jam_selesai: string,
  zona = "Asia/Makassar",
): boolean {
  const mulai = ke_menit(jam_mulai);
  const selesai = ke_menit(jam_selesai);
  const kini = ke_menit(jam_lokal(sekarang, zona));
  if (mulai === null || selesai === null || kini === null) return true;

  if (mulai === selesai) return true; // dianggap buka sehari penuh
  if (mulai < selesai) return kini >= mulai && kini < selesai;
  return kini >= mulai || kini < selesai;
}
