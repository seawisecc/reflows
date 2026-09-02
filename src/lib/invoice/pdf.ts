import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { hitung_invoice, type BarisHitung } from "./hitung";

/**
 * Menyusun PDF invoice.
 *
 * Memakai font bawaan PDF, bukan font yang disematkan. Alasannya bukan
 * ukuran berkas: font bawaan tidak perlu diunduh saat fungsi dingin, dan
 * invoice yang gagal terbit karena pengunduhan font timeout adalah cara
 * paling bodoh untuk mengecewakan client.
 *
 * Konsekuensinya teksnya harus muat di WinAnsi. Bahasa Indonesia memang
 * muat, tapi teks yang ditempel orang dari aplikasi lain sering membawa
 * tanda kutip melengkung dan tanda pisah panjang. Semuanya diganti di
 * aman(), bukan dibiarkan melempar galat di tengah penerbitan.
 */

const A4 = { lebar: 595.28, tinggi: 841.89 };
const TEPI = 48;
const LEBAR_ISI = A4.lebar - TEPI * 2;

const TINTA = rgb(0.11, 0.09, 0.06);
const REDUP = rgb(0.48, 0.42, 0.35);
const GARIS = rgb(0.85, 0.82, 0.78);
const SOROT = rgb(0.97, 0.96, 0.94);

/** Kolom tabel, diukur dari tepi kiri isi. */
const KOLOM = {
  deskripsi: 0,
  jumlah: LEBAR_ISI - 250,
  harga: LEBAR_ISI - 170,
  total: LEBAR_ISI,
};

/**
 * Karakter yang tidak ada di font bawaan PDF, beserta gantinya.
 *
 * Ditulis sebagai escape, bukan karakternya langsung, karena dua alasan.
 * Pertama, spasi tak terputus dan spasi lebar nol tidak kelihatan sama
 * sekali di editor, jadi tidak ada yang tahu barisnya benar atau tidak.
 * Kedua, npm run periksa-aksi melarang tanda pisah panjang di seluruh kode,
 * dan larangan itu tidak perlu dilemahkan cuma demi berkas ini.
 */
const PENGGANTI: Record<string, string> = {
  "\u2018": "'", // kutip tunggal buka
  "\u2019": "'", // kutip tunggal tutup, paling sering datang dari Word
  "\u201A": ",",
  "\u201C": '"', // kutip ganda buka
  "\u201D": '"', // kutip ganda tutup
  "\u2013": "-", // tanda pisah en
  "\u2014": "-", // tanda pisah em
  "\u2026": "...",
  "\u2022": "-", // bulatan daftar
  "\u00A0": " ", // spasi tak terputus
  "\u202F": " ", // spasi sempit tak terputus
  "\u2009": " ", // spasi tipis
  "\u200B": "", // spasi lebar nol
};


/** Membuang apa pun yang tidak bisa digambar font bawaan PDF. */
export function aman(teks: string): string {
  let hasil = "";
  for (const huruf of teks.normalize("NFC")) {
    if (PENGGANTI[huruf] !== undefined) {
      hasil += PENGGANTI[huruf];
      continue;
    }
    const kode = huruf.codePointAt(0) ?? 0;
    // WinAnsi menampung 0x20 sampai 0xFF, di luar itu tidak tergambar.
    hasil += kode >= 0x20 && kode <= 0xff ? huruf : "";
  }
  return hasil;
}

/**
 * Rupiah untuk PDF, ditulis sendiri dan tidak lewat Intl.
 *
 * Intl.NumberFormat menyisipkan spasi tak terputus setelah "Rp", dan
 * bentuknya berubah antar versi Node. Format invoice tidak boleh ikut
 * berubah hanya karena runtimenya diperbarui.
 */
export function rupiah_pdf(nilai: number): string {
  const bulat = Math.round(Number.isFinite(nilai) ? nilai : 0);
  const tanda = bulat < 0 ? "-" : "";
  const angka = Math.abs(bulat)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${tanda}Rp ${angka}`;
}

/** "2 September 2026". Ditulis sendiri, alasannya sama dengan rupiah. */
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function tanggal_pdf(iso: string): string {
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!cocok) return iso;
  const bulan = BULAN[Number(cocok[2]) - 1] ?? cocok[2];
  return `${Number(cocok[3])} ${bulan} ${cocok[1]}`;
}

/** Jumlah baris ditulis tanpa desimal kalau memang bulat. */
export function jumlah_pdf(nilai: number): string {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

/** Memotong teks jadi beberapa baris yang muat di lebar tertentu. */
function bungkus(
  teks: string,
  font: PDFFont,
  ukuran: number,
  lebar: number,
): string[] {
  const kata = aman(teks).split(/\s+/).filter(Boolean);
  if (kata.length === 0) return [""];

  const baris: string[] = [];
  let kini = "";
  for (const k of kata) {
    const calon = kini ? `${kini} ${k}` : k;
    if (font.widthOfTextAtSize(calon, ukuran) <= lebar) {
      kini = calon;
      continue;
    }
    if (kini) baris.push(kini);
    // Satu kata yang sendirian pun kepanjangan, misalnya URL. Dipotong per
    // huruf, karena membiarkannya menembus tepi merusak seluruh tabelnya.
    if (font.widthOfTextAtSize(k, ukuran) > lebar) {
      let potong = "";
      for (const huruf of k) {
        if (font.widthOfTextAtSize(potong + huruf, ukuran) > lebar) {
          baris.push(potong);
          potong = huruf;
        } else {
          potong += huruf;
        }
      }
      kini = potong;
    } else {
      kini = k;
    }
  }
  if (kini) baris.push(kini);
  return baris;
}

export type DataInvoice = {
  nomor: string;
  terbit_at: string;
  jatuh_tempo_at: string;
  penerbit_nama: string;
  penerbit_alamat: string | null;
  penerbit_nomor_wa: string | null;
  klien_nama: string;
  klien_nomor_wa: string;
  bank_nama: string | null;
  bank_rekening: string | null;
  bank_atas_nama: string | null;
  catatan: string | null;
  diskon: number;
  ppn_persen: number;
  baris: (BarisHitung & { deskripsi: string })[];
};

export async function susun_pdf_invoice(data: DataInvoice): Promise<Uint8Array> {
  const dok = await PDFDocument.create();
  dok.setTitle(aman(`Invoice ${data.nomor}`));
  dok.setProducer("Reflows");
  dok.setCreator("Reflows");

  const biasa = await dok.embedFont(StandardFonts.Helvetica);
  const tebal = await dok.embedFont(StandardFonts.HelveticaBold);

  let halaman = dok.addPage([A4.lebar, A4.tinggi]);
  let y = A4.tinggi - TEPI;

  const tulis = (
    teks: string,
    x: number,
    ukuran: number,
    font: PDFFont,
    warna = TINTA,
  ) => {
    halaman.drawText(aman(teks), { x: TEPI + x, y, size: ukuran, font, color: warna });
  };

  const tulis_kanan = (
    teks: string,
    x: number,
    ukuran: number,
    font: PDFFont,
    warna = TINTA,
  ) => {
    const bersih = aman(teks);
    const lebar = font.widthOfTextAtSize(bersih, ukuran);
    halaman.drawText(bersih, {
      x: TEPI + x - lebar,
      y,
      size: ukuran,
      font,
      color: warna,
    });
  };

  const garis = (tebal_garis = 1, warna = GARIS) => {
    halaman.drawLine({
      start: { x: TEPI, y },
      end: { x: TEPI + LEBAR_ISI, y },
      thickness: tebal_garis,
      color: warna,
    });
  };

  // ---------- Kepala ----------
  tulis(data.penerbit_nama, 0, 18, tebal);
  tulis_kanan("INVOICE", KOLOM.total, 18, tebal, REDUP);
  y -= 18;
  tulis_kanan(data.nomor, KOLOM.total, 10, biasa, REDUP);

  if (data.penerbit_alamat) {
    for (const b of bungkus(data.penerbit_alamat, biasa, 9, 260)) {
      y -= 12;
      tulis(b, 0, 9, biasa, REDUP);
    }
  }
  if (data.penerbit_nomor_wa) {
    y -= 12;
    tulis(`WhatsApp ${data.penerbit_nomor_wa}`, 0, 9, biasa, REDUP);
  }

  y -= 28;
  garis(1.5, TINTA);

  // ---------- Ditagihkan kepada ----------
  y -= 22;
  tulis("DITAGIHKAN KEPADA", 0, 8, tebal, REDUP);
  tulis_kanan("TANGGAL TERBIT", KOLOM.harga, 8, tebal, REDUP);
  tulis_kanan("JATUH TEMPO", KOLOM.total, 8, tebal, REDUP);

  y -= 15;
  tulis(data.klien_nama, 0, 11, tebal);
  tulis_kanan(tanggal_pdf(data.terbit_at), KOLOM.harga, 10, biasa);
  tulis_kanan(tanggal_pdf(data.jatuh_tempo_at), KOLOM.total, 10, tebal);

  y -= 13;
  tulis(data.klien_nomor_wa, 0, 9, biasa, REDUP);

  // ---------- Kepala tabel ----------
  y -= 30;
  halaman.drawRectangle({
    x: TEPI,
    y: y - 6,
    width: LEBAR_ISI,
    height: 22,
    color: SOROT,
  });
  y += 2;
  tulis("DESKRIPSI", 6, 8, tebal, REDUP);
  tulis_kanan("JUMLAH", KOLOM.jumlah, 8, tebal, REDUP);
  tulis_kanan("HARGA", KOLOM.harga, 8, tebal, REDUP);
  tulis_kanan("TOTAL", KOLOM.total - 6, 8, tebal, REDUP);
  y -= 18;

  const halaman_baru = () => {
    halaman = dok.addPage([A4.lebar, A4.tinggi]);
    y = A4.tinggi - TEPI;
    tulis(`${data.penerbit_nama} | Invoice ${data.nomor}`, 0, 9, biasa, REDUP);
    y -= 18;
  };

  // ---------- Baris ----------
  const lebar_deskripsi = KOLOM.jumlah - 70;
  for (const b of data.baris) {
    const potongan = bungkus(b.deskripsi, biasa, 10, lebar_deskripsi);
    const tinggi_baris = Math.max(20, potongan.length * 13 + 8);

    // Sisakan ruang untuk blok total supaya tidak terpotong di kaki halaman.
    if (y - tinggi_baris < TEPI + 160) halaman_baru();

    const y_awal = y;
    potongan.forEach((teks, i) => {
      y = y_awal - i * 13;
      tulis(teks, 6, 10, biasa);
    });

    y = y_awal;
    tulis_kanan(jumlah_pdf(b.jumlah), KOLOM.jumlah, 10, biasa);
    tulis_kanan(rupiah_pdf(b.harga_satuan), KOLOM.harga, 10, biasa);
    tulis_kanan(
      rupiah_pdf(Math.round(b.jumlah * b.harga_satuan)),
      KOLOM.total - 6,
      10,
      biasa,
    );

    y = y_awal - (potongan.length - 1) * 13 - 10;
    garis();
    y -= 14;
  }

  // ---------- Total ----------
  const h = hitung_invoice({
    baris: data.baris,
    diskon: data.diskon,
    ppn_persen: data.ppn_persen,
  });

  const rincian: [string, string, boolean][] = [
    ["Subtotal", rupiah_pdf(h.subtotal), false],
  ];
  if (h.diskon > 0) rincian.push(["Diskon", `-${rupiah_pdf(h.diskon)}`, false]);
  if (h.ppn_persen > 0) {
    rincian.push([`PPN ${jumlah_pdf(h.ppn_persen)}%`, rupiah_pdf(h.nilai_ppn), false]);
  }

  y -= 6;
  for (const [label, nilai] of rincian) {
    tulis_kanan(label, KOLOM.harga, 10, biasa, REDUP);
    tulis_kanan(nilai, KOLOM.total - 6, 10, biasa);
    y -= 16;
  }

  // Kotak total digambar 28 poin tinggi dari y - 8, jadi puncaknya ada di
  // y + 20. Tanpa turun dulu, puncak itu menimpa baris rincian terakhir.
  y -= 14;
  halaman.drawRectangle({
    x: TEPI + KOLOM.jumlah - 40,
    y: y - 8,
    width: LEBAR_ISI - KOLOM.jumlah + 40,
    height: 28,
    color: SOROT,
  });
  y += 2;
  tulis_kanan("TOTAL TAGIHAN", KOLOM.harga, 10, tebal);
  tulis_kanan(rupiah_pdf(h.total), KOLOM.total - 6, 13, tebal);
  y -= 42;

  // ---------- Pembayaran ----------
  if (data.bank_nama || data.bank_rekening) {
    if (y < TEPI + 90) halaman_baru();
    tulis("CARA PEMBAYARAN", 0, 8, tebal, REDUP);
    y -= 15;
    tulis(
      [data.bank_nama, data.bank_rekening].filter(Boolean).join("  "),
      0,
      11,
      tebal,
    );
    if (data.bank_atas_nama) {
      y -= 13;
      tulis(`atas nama ${data.bank_atas_nama}`, 0, 9, biasa, REDUP);
    }
    y -= 24;
  }

  // ---------- Catatan ----------
  if (data.catatan) {
    if (y < TEPI + 70) halaman_baru();
    tulis("CATATAN", 0, 8, tebal, REDUP);
    y -= 14;
    for (const b of bungkus(data.catatan, biasa, 9, LEBAR_ISI)) {
      tulis(b, 0, 9, biasa, REDUP);
      y -= 12;
    }
  }

  // ---------- Kaki ----------
  for (const [i, hal] of dok.getPages().entries()) {
    const teks_kaki = aman(
      `Halaman ${i + 1} dari ${dok.getPageCount()}  |  Dibuat dengan Reflows`,
    );
    hal.drawText(teks_kaki, {
      x: TEPI,
      y: TEPI - 18,
      size: 8,
      font: biasa,
      color: REDUP,
    });
  }

  return dok.save();
}
