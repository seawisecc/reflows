/**
 * Jalur yang boleh dibuka tanpa sesi pengguna.
 *
 * Dipisah dari src/proxy.ts supaya bisa diuji. Fungsi ini adalah gerbang
 * seluruh aplikasi: satu kesalahan di sini membuka semua halaman pelanggan
 * ke internet, dan tidak ada galat yang muncul saat itu terjadi.
 *
 * Ditulis satu per satu, bukan dengan aturan menyeluruh semacam "semua
 * /api", supaya jalur baru tidak diam-diam ikut terbuka.
 */

/**
 * Terbuka berikut seluruh anaknya.
 *
 * Dua yang pertama menjaga dirinya sendiri: webhook lewat rahasia 64
 * karakter di jalurnya, antrean kampanye lewat header rahasia yang
 * dibandingkan dengan timingSafeEqual. Dua yang terakhir gambar merek yang
 * memang harus bisa diambil crawler.
 */
const TERBUKA_BESERTA_ANAK = [
  "/masuk",
  "/api/wa",
  "/api/kampanye",
  "/opengraph-image",
  "/apple-icon",
];

/**
 * Terbuka persis, anaknya tidak ikut. Sekarang cuma halaman depan.
 *
 * Halaman depan sebenarnya aman juga kalau ditaruh di daftar atas, tapi
 * amannya bergantung pada satu detail yang mudah hilang: pencocokan di
 * bawah menempelkan garis miring, jadi awalan untuk "/" menjadi "//" dan
 * tidak cocok dengan "/dasbor". Menyederhanakan pencocokan itu jadi
 * startsWith(t) saja akan membuka seluruh aplikasi tanpa sesi, tanpa galat
 * apa pun yang muncul.
 *
 * Daftar terpisah ini membuat maksudnya tertulis, bukan bergantung pada
 * penggabungan teks yang kebetulan menolong.
 */
const TERBUKA_PERSIS = ["/"];

export function boleh_tanpa_sesi(jalur: string): boolean {
  if (TERBUKA_PERSIS.includes(jalur)) return true;
  return TERBUKA_BESERTA_ANAK.some(
    (t) => jalur === t || jalur.startsWith(`${t}/`),
  );
}
