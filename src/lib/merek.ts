/**
 * Bentuk logo Reflows, ditulis sekali di sini.
 *
 * Logonya dua gelembung chat yang menurun diagonal: yang di atas kiri
 * ekornya ke kiri (pesan masuk dari client), yang di bawah kanan ekornya
 * ke kanan (balasan yang keluar). Jadi lambangnya bukan hiasan, melainkan
 * satu percakapan yang mengalir, persis yang dikerjakan aplikasinya.
 *
 * Warnanya mengikuti aturan yang sudah berlaku di seluruh antarmuka:
 * manusia teal atau oranye, AI biru atau ungu. Gelembung masuk memakai
 * warna manusia, gelembung balasan memakai warna AI.
 *
 * Geometrinya di petak 32x32 dengan semua sisi bilangan bulat, supaya
 * tetap tajam saat dikecilkan jadi favicon 16 piksel. Angka pecahan
 * membuat tepinya buram justru di ukuran terkecil.
 */

export type Petak = { x: number; y: number; lebar: number; tinggi: number };

/** Sisi petak logo. Semua koordinat di bawah memakai satuan ini. */
export const PETAK_LOGO = 32;

/** Gelembung pesan masuk, ekornya menggantung ke kiri bawah. */
export const BENTUK_MASUK: Petak[] = [
  { x: 0, y: 0, lebar: 16, tinggi: 12 },
  { x: 3, y: 12, lebar: 6, tinggi: 4 },
];

/** Gelembung balasan, ekornya menggantung ke kanan bawah. */
export const BENTUK_BALAS: Petak[] = [
  { x: 16, y: 16, lebar: 16, tinggi: 12 },
  { x: 23, y: 28, lebar: 6, tinggi: 4 },
];

/**
 * Warna tetap untuk logo di luar halaman aplikasi (favicon, gambar Open
 * Graph, lampiran). Di dalam aplikasi logonya pakai CSS variable supaya
 * ikut berganti tema, lihat komponen Logo.
 */
export const WARNA_LOGO = {
  masuk: "#37e0c8",
  balas: "#5b8cff",
  dasar: "#0b1220",
  garis: "#2b3d5f",
  teks: "#e6edf7",
  redup: "#7f8fa8",
} as const;

/**
 * Logo sebagai teks SVG, dipakai berkas yang tidak bisa merender React,
 * misalnya data URI di dalam gambar Open Graph.
 */
export function svg_logo(opsi?: {
  masuk?: string;
  balas?: string;
  /** Warna alas. Kosong berarti latar tembus pandang. */
  alas?: string;
  /** Jarak alas ke tepi lambang, dalam satuan petak. */
  jarak?: number;
}): string {
  const masuk = opsi?.masuk ?? WARNA_LOGO.masuk;
  const balas = opsi?.balas ?? WARNA_LOGO.balas;
  const jarak = opsi?.jarak ?? 0;
  const sisi = PETAK_LOGO + jarak * 2;

  const kotak = (p: Petak, warna: string) =>
    `<rect x="${p.x + jarak}" y="${p.y + jarak}" width="${p.lebar}" height="${p.tinggi}" fill="${warna}"/>`;

  const alas = opsi?.alas
    ? `<rect width="${sisi}" height="${sisi}" fill="${opsi.alas}"/>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sisi} ${sisi}" width="${sisi}" height="${sisi}" shape-rendering="crispEdges">`,
    alas,
    ...BENTUK_MASUK.map((p) => kotak(p, masuk)),
    ...BENTUK_BALAS.map((p) => kotak(p, balas)),
    "</svg>",
  ].join("");
}
