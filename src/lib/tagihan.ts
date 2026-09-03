import { izin_kuota, PAKET, type NamaPaket } from "./paket";

/**
 * Aritmetika tagihan langganan, Seawise menagih tenant.
 *
 * Fungsi murni, tanpa database, karena angka tagihan adalah hal terakhir
 * yang boleh salah diam-diam. Yang memanggilnya skrip service role, dan
 * hasilnya disalin utuh ke baris tagihan, tidak menunjuk ke PAKET. Kalau
 * menunjuk, menaikkan harga paket bulan depan akan diam-diam mengubah
 * tagihan yang sudah dibayar bulan lalu.
 */

export type Periode = { tahun: number; bulan: number };

export type RincianTagihan = {
  paket: NamaPaket;
  harga_pokok: number;
  kuota: number;
  terpakai: number;
  kelebihan: number;
  tarif_kelebihan: number;
  biaya_kelebihan: number;
  total: number;
};

/**
 * Bulan berjalan menurut zona waktu tenant, bukan zona server.
 *
 * Skrip bisa dijalankan dari mana saja, dan server Vercel berjalan di UTC.
 * Tanggal 1 pukul 07.00 WITA masih tanggal 31 di UTC, jadi memakai zona
 * server berarti menagih bulan yang salah tepat di hari penagihan.
 */
export function bulan_di_zona(saat: Date, zona: string): Periode {
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(saat);

  const ambil = (jenis: string) =>
    Number(bagian.find((b) => b.type === jenis)?.value ?? "0");

  return { tahun: ambil("year"), bulan: ambil("month") };
}

export function periode_sebelumnya(p: Periode): Periode {
  return p.bulan === 1
    ? { tahun: p.tahun - 1, bulan: 12 }
    : { tahun: p.tahun, bulan: p.bulan - 1 };
}

/** Bentuk yang masuk kolom date di database, selalu tanggal 1. */
export function teks_periode(p: Periode): string {
  return `${p.tahun}-${String(p.bulan).padStart(2, "0")}-01`;
}

export function baca_periode(teks: string): Periode | null {
  const cocok = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(teks.trim());
  if (!cocok) return null;
  const bulan = Number(cocok[2]);
  if (bulan < 1 || bulan > 12) return null;
  return { tahun: Number(cocok[1]), bulan };
}

// Nama bulan ditulis sendiri, tidak lewat Intl, dengan alasan yang sama
// seperti tanggal di PDF invoice: keluaran Intl berubah antar versi Node,
// dan angka yang tampil di tagihan tidak boleh ikut berubah cuma karena
// runtimenya diperbarui.
const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function label_periode(p: Periode): string {
  return `${NAMA_BULAN[p.bulan - 1]} ${p.tahun}`;
}

/**
 * Menyusun angka satu tagihan.
 *
 * Batas kelebihan sengaja dilewatkan sebagai tanpa batas. Batas itu urusan
 * rem pemakaian di tengah bulan, sedangkan di sini bulannya sudah lewat dan
 * yang dihitung adalah apa yang benar-benar terpakai. Memakai batasnya di
 * sini berarti pemakaian yang lolos rem tidak ikut tertagih.
 */
export function susun_tagihan(
  paket: NamaPaket,
  terpakai: number,
): RincianTagihan {
  const sifat = PAKET[paket];
  const izin = izin_kuota({ paket, terpakai, batas_kelebihan: null });

  return {
    paket,
    harga_pokok: sifat.harga_bulanan,
    kuota: izin.kuota,
    terpakai: izin.terpakai,
    kelebihan: izin.kelebihan,
    tarif_kelebihan: sifat.tarif_kelebihan,
    biaya_kelebihan: izin.biaya_kelebihan,
    total: sifat.harga_bulanan + izin.biaya_kelebihan,
  };
}
