import { PAKET, type NamaPaket } from "./paket";
import { angka, rupiah } from "./utils";

/**
 * Isi halaman depan yang berasal dari definisi produk, bukan dari tangan.
 *
 * Angka paket dibaca dari PAKET, tabel yang sama yang dipakai mesin untuk
 * memaksakan kuota. Menulis ulang angkanya di halaman jualan berarti suatu
 * saat brosur menjanjikan 1.000 balasan sementara mesin berhenti di 750,
 * dan yang menanggung selisihnya pelanggan yang sudah bayar.
 */

export const URUTAN_PAKET: NamaPaket[] = ["mulai", "tumbuh", "penuh"];

/** Paket yang ditonjolkan di layar. Bukan yang termurah, bukan yang termahal. */
export const PAKET_DISARANKAN: NamaPaket = "tumbuh";

export type BarisPaket = { label: string; nilai: string };

export function rincian_paket(nama: NamaPaket): BarisPaket[] {
  const p = PAKET[nama];

  return [
    { label: "Balasan AI", nilai: `${angka(p.balasan_ai)} per bulan` },
    {
      label: "Lewat kuota",
      nilai: `${rupiah(p.tarif_kelebihan)} per balasan`,
    },
    {
      label: "Nomor WhatsApp",
      nilai: p.nomor_whatsapp === 1 ? "1 nomor" : `${p.nomor_whatsapp} nomor`,
    },
    {
      label: "Impor dokumen",
      nilai:
        p.impor_dokumen === null
          ? "Tanpa batas"
          : `${angka(p.impor_dokumen)} per bulan`,
    },
    {
      label: "Pesan kampanye",
      nilai:
        p.pesan_kampanye === 0
          ? "Tidak termasuk"
          : `${angka(p.pesan_kampanye)} per bulan`,
    },
  ];
}

/**
 * Urutan keputusan mesin balasan, persis seperti yang dijalankan kode.
 *
 * Ditulis di sini supaya halaman depan menjelaskan mesin yang sebenarnya,
 * bukan mesin yang enak dijual. Kalau urutannya berubah di kode, kalimat
 * di sini ikut salah, jadi keduanya harus diubah bersamaan.
 */
export const LANGKAH_MESIN: {
  pelaku: "kontak" | "ai" | "manusia";
  judul: string;
  isi: string;
}[] = [
  {
    pelaku: "kontak",
    judul: "Chat masuk",
    isi: "Pesan client tercatat lebih dulu, sebelum apa pun diputuskan. Ini tidak pernah dilewati, bahkan saat layanannya sedang kamu jeda.",
  },
  {
    pelaku: "manusia",
    judul: "Minta berhenti",
    isi: "Kontak yang membalas STOP ditutup permanen dan tidak akan masuk kampanye mana pun lagi.",
  },
  {
    pelaku: "manusia",
    judul: "Kena aturan eskalasi",
    isi: "Tanya harga di luar materi, minta bicara dengan orang, menyebut komplain atau refund, atau chatnya sudah berputar terlalu lama. AI tidak dipanggil sama sekali, langsung giliran kamu.",
  },
  {
    pelaku: "ai",
    judul: "AI menyusun balasan",
    isi: "Sumbernya materi yang kamu isi sendiri, bukan tebakan. Harga yang tidak ada di materi tidak akan pernah dikarang.",
  },
  {
    pelaku: "ai",
    judul: "Yakin, langsung dikirim",
    isi: "Balasan keluar sendiri ke WhatsApp client tanpa menunggu kamu.",
  },
  {
    pelaku: "manusia",
    judul: "Ragu, jadi draf",
    isi: "Balasannya menunggu di inbox untuk kamu setujui atau perbaiki. Ambang keyakinannya kamu yang tentukan.",
  },
];

export const KEMAMPUAN: { judul: string; isi: string }[] = [
  {
    judul: "Materi dari dokumen yang sudah ada",
    isi: "Daftar harga PDF, halaman situs, atau spreadsheet dibaca sekali lalu jadi entri terstruktur. Hasil bacaannya kamu tinjau dulu, dan harga yang tidak tertulis jelas dikembalikan kosong, bukan ditebak.",
  },
  {
    judul: "Kampanye yang isinya justru rem",
    isi: "Mulai 20 pesan sehari lalu naik bertahap, jeda acak 40 sampai 120 detik, kalimat bervariasi, dan sequence berhenti sendiri begitu orangnya membalas. Nomor baru yang langsung mengirim ratusan pesan adalah cara tercepat kena blokir.",
  },
  {
    judul: "Invoice PDF lewat WhatsApp",
    isi: "Disusun dari daftar layanan, jadi PDF, lalu terkirim ke chat client beserta ringkasan tagihannya. Angkanya disalin saat diterbitkan, jadi menaikkan harga bulan depan tidak mengubah invoice yang sudah dibayar.",
  },
  {
    judul: "Biaya yang kelihatan sepanjang bulan",
    isi: "Jumlah balasan dan biaya modelnya terbaca tiap saat, dengan peringatan di 80 persen kuota. Kamu juga bisa memasang batas sendiri supaya AI berhenti alih-alih menambah tagihan.",
  },
];

export const YANG_DISIAPKAN: { judul: string; isi: string }[] = [
  {
    judul: "Nomor WhatsApp bisnis",
    isi: "Nomor yang memang dipakai melayani client. Menyambungkannya cukup memindai QR di halaman Pengaturan.",
  },
  {
    judul: "Akun gateway sendiri",
    isi: "Reflows mengirim lewat Fonnte, dan akunnya atas nama kamu, bukan atas nama kami. Paket gratisnya cukup untuk mencoba, tapi menempelkan tulisan Sent via fonnte.com di setiap pesan keluar, jadi untuk dipakai ke client sungguhan perlu naik paket.",
  },
  {
    judul: "Materi yang mau dijawab AI",
    isi: "Layanan, harga, dan pertanyaan yang sering masuk. Boleh diketik satu per satu, boleh diimpor dari dokumen yang sudah ada.",
  },
];
