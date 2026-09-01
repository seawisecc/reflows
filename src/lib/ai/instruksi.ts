import type { ButirPengetahuan } from "@/tipe";

/**
 * Menyusun instruksi tetap untuk AI dari materi admin tenant.
 *
 * Hasilnya sengaja stabil: urutannya pasti, tidak ada stempel waktu, tidak
 * ada nomor acak. Bagian ini dikirim sebagai awalan yang di-cache, dan cache
 * itu batal begitu satu byte pun berubah. Kalau di sini ada tanggal hari ini,
 * cache tidak akan pernah kena dan tiap balasan dibayar penuh.
 */

const PERAN = `Kamu admin sebuah bisnis kecil di Indonesia, membalas chat WhatsApp
dari calon client dan client. Kamu bukan robot penjawab, kamu orang yang
tahu betul layanan bisnis ini.

Aturan yang tidak boleh dilanggar:

1. Harga hanya boleh disebut kalau angkanya ada di daftar layanan di bawah.
   Kalau ditanya harga sesuatu yang tidak ada di daftar, jangan menebak dan
   jangan mengarang kisaran. Serahkan ke manusia.
2. Jangan pernah memberi diskon, potongan, atau janji khusus.
3. Jangan menyebut tanggal serah terima yang pasti. Rentang waktu yang
   tertulis di daftar layanan boleh disebut.
4. Jangan menerima pekerjaan di luar daftar layanan.
5. Jangan mengaku sebagai AI, dan jangan pula mengaku sebagai manusia
   tertentu. Cukup bicara sebagai admin bisnis ini.
5b. Kalau kontak minta bicara dengan orang, minta ditelepon, minta bertemu,
   atau minta dihubungkan ke pemilik, jangan menyanggupi sendiri. Serahkan ke
   manusia, karena kamu tidak bisa menjadwalkan apa pun. Menjanjikan
   panggilan yang tidak pernah terjadi lebih buruk daripada menunggu.
6. Balas dalam bahasa Indonesia, mengikuti gaya bahasa yang ditentukan.
7. Jangan menyalin kalimat di bawah mentah-mentah. Susun ulang sesuai
   pertanyaannya.

Kalau ragu sedikit saja, lebih baik serahkan ke manusia. Salah menjawab satu
calon client lebih mahal daripada membalas agak lambat.`;

const TANPA_MATERI = `Bisnis ini belum mengisi daftar layanan maupun harga.
Karena itu kamu belum bisa menjawab apa pun soal layanan atau harga. Serahkan
semua pertanyaan ke manusia.`;

function bagian(
  judul: string,
  butir: ButirPengetahuan[],
  tulis: (b: ButirPengetahuan) => string,
): string {
  if (butir.length === 0) return "";
  return `\n## ${judul}\n\n${butir.map(tulis).join("\n")}\n`;
}

const RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function susun_instruksi(
  nama_bisnis: string,
  pengetahuan: ButirPengetahuan[],
): string {
  const aktif = pengetahuan.filter((p) => p.aktif);
  // Urutan dikunci supaya awalan yang di-cache tidak berubah hanya karena
  // database mengembalikan baris dengan urutan berbeda.
  const urut = (a: ButirPengetahuan, b: ButirPengetahuan) =>
    a.judul.localeCompare(b.judul, "id");

  const layanan = aktif.filter((p) => p.tipe === "layanan").sort(urut);
  const faq = aktif.filter((p) => p.tipe === "faq").sort(urut);
  const gaya = aktif.filter((p) => p.tipe === "gaya").sort(urut);
  const catatan = aktif.filter((p) => p.tipe === "catatan").sort(urut);

  if (layanan.length === 0 && faq.length === 0) {
    return `${PERAN}\n\n# Bisnis: ${nama_bisnis}\n\n${TANPA_MATERI}`;
  }

  return [
    PERAN,
    `\n# Bisnis: ${nama_bisnis}`,
    bagian("Layanan dan harga", layanan, (b) =>
      `- ${b.judul}${b.harga !== null ? ` | ${RUPIAH.format(b.harga)}` : " | harga belum ditentukan, serahkan ke manusia kalau ditanya"}\n  ${b.isi}`,
    ),
    bagian("Pertanyaan yang sering masuk", faq, (b) =>
      `- Tanya: ${b.judul}\n  Jawab: ${b.isi}`,
    ),
    bagian("Gaya bahasa", gaya, (b) => `- ${b.isi}`),
    bagian("Pagar pembatas", catatan, (b) => `- ${b.isi}`),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}
