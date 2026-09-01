import type { ButirPengetahuan, Percakapan } from "@/tipe";

/**
 * Data contoh untuk Fase 0. Semuanya statis dan dihitung relatif terhadap
 * waktu render supaya stempel waktu tidak terlihat basi. Hilang begitu
 * Supabase dan gateway tersambung di Fase 1.
 */

const SEKARANG = Date.now();
const menit = (n: number) => new Date(SEKARANG - n * 60_000).toISOString();
const jam = (n: number) => menit(n * 60);
const hari = (n: number) => jam(n * 24);

export const PERCAKAPAN: Percakapan[] = [
  {
    id: "p1",
    status: "manual",
    belum_dibaca: 2,
    alasan_eskalasi: "Minta harga di luar daftar layanan",
    pesan_terakhir_at: menit(4),
    kontak: {
      id: "k1",
      nama: "Bu Ratna | Katering Sari Rasa",
      nomor_wa: "6281338291044",
      tag: ["prospek", "kuliner"],
      sumber: "chat-masuk",
      opt_out_at: null,
      dibuat_at: hari(2),
    },
    pesan: [
      {
        id: "m1",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Halo, saya lihat portofolio Seawise. Bikin website katering berapa ya?",
        status_kirim: "sampai",
        waktu: menit(18),
      },
      {
        id: "m2",
        arah: "keluar",
        pengirim: "ai",
        isi: "Halo Bu Ratna, terima kasih sudah menghubungi Seawise Studio. Untuk website katering, paket Company Profile kami mulai Rp 4.500.000 sudah termasuk 5 halaman, domain setahun, dan hosting setahun. Boleh tahu kira-kira butuh fitur pemesanan online juga atau cukup katalog menu?",
        status_kirim: "dibaca",
        keyakinan: 0.91,
        waktu: menit(17),
      },
      {
        id: "m3",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Butuh yang bisa pesan online, sekalian bayarnya langsung. Terus mau ada aplikasi kasirnya juga.",
        status_kirim: "sampai",
        waktu: menit(6),
      },
      {
        id: "m4",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Kalau sepaket bisa dapat harga berapa?",
        status_kirim: "sampai",
        waktu: menit(4),
      },
    ],
  },
  {
    id: "p2",
    status: "ai",
    belum_dibaca: 0,
    alasan_eskalasi: null,
    pesan_terakhir_at: menit(26),
    kontak: {
      id: "k2",
      nama: "Pak Gede | Bengkel Motor Dewata",
      nomor_wa: "6287861200377",
      tag: ["client", "otomotif"],
      sumber: "chat-masuk",
      opt_out_at: null,
      dibuat_at: hari(31),
    },
    pesan: [
      {
        id: "m5",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Mas, website saya kok belum bisa dibuka ya dari pagi?",
        status_kirim: "sampai",
        waktu: menit(28),
      },
      {
        id: "m6",
        arah: "keluar",
        pengirim: "ai",
        isi: "Halo Pak Gede, saya cek dulu ya. Sementara ini boleh dibantu buka lewat jaringan lain dulu Pak, kadang cache provider yang bermasalah. Kalau masih belum bisa juga, saya teruskan ke tim teknis kami hari ini juga.",
        status_kirim: "dibaca",
        keyakinan: 0.78,
        waktu: menit(27),
      },
      {
        id: "m7",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Oh iya sudah bisa. Makasih ya.",
        status_kirim: "sampai",
        waktu: menit(26),
      },
    ],
  },
  {
    id: "p3",
    status: "ai",
    belum_dibaca: 1,
    alasan_eskalasi: null,
    pesan_terakhir_at: jam(2),
    kontak: {
      id: "k3",
      nama: "Sinta | Klinik Sehatera",
      nomor_wa: "6285739110268",
      tag: ["prospek", "kesehatan"],
      sumber: "impor",
      opt_out_at: null,
      dibuat_at: hari(5),
    },
    pesan: [
      {
        id: "m8",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Kalau sistem antrean pasien bisa dibuatkan tidak?",
        status_kirim: "sampai",
        waktu: jam(2),
      },
    ],
  },
  {
    id: "p4",
    status: "selesai",
    belum_dibaca: 0,
    alasan_eskalasi: null,
    pesan_terakhir_at: hari(1),
    kontak: {
      id: "k4",
      nama: "Wayan | Toko Bangunan Merta",
      nomor_wa: "6281999042715",
      tag: ["client", "retail"],
      sumber: "chat-masuk",
      opt_out_at: null,
      dibuat_at: hari(64),
    },
    pesan: [
      {
        id: "m9",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Invoice bulan ini sudah saya transfer ya.",
        status_kirim: "sampai",
        waktu: hari(1),
      },
      {
        id: "m10",
        arah: "keluar",
        pengirim: "manusia",
        isi: "Siap Pak Wayan, sudah kami terima. Terima kasih banyak.",
        status_kirim: "dibaca",
        waktu: hari(1),
      },
    ],
  },
  {
    id: "p5",
    status: "manual",
    belum_dibaca: 3,
    alasan_eskalasi: "Kontak minta bicara dengan orang",
    pesan_terakhir_at: jam(5),
    kontak: {
      id: "k5",
      nama: "Dimas | Kopi Ruang Tengah",
      nomor_wa: "6281246770913",
      tag: ["prospek", "kuliner"],
      sumber: "kampanye",
      opt_out_at: null,
      dibuat_at: hari(9),
    },
    pesan: [
      {
        id: "m11",
        arah: "masuk",
        pengirim: "kontak",
        isi: "Bisa ngobrol langsung sama orangnya? Ada beberapa hal yang mau saya tanyakan.",
        status_kirim: "sampai",
        waktu: jam(5),
      },
    ],
  },
];

export const PENGETAHUAN: ButirPengetahuan[] = [
  {
    id: "b1",
    tipe: "layanan",
    judul: "Website Company Profile",
    isi: "5 halaman, desain custom, responsif, domain dan hosting setahun. Pengerjaan 10 sampai 14 hari kerja.",
    harga: 4_500_000,
    aktif: true,
  },
  {
    id: "b2",
    tipe: "layanan",
    judul: "Website Toko Online",
    isi: "Katalog produk, keranjang, pembayaran Midtrans, ongkir otomatis. Pengerjaan 3 sampai 4 minggu.",
    harga: 9_500_000,
    aktif: true,
  },
  {
    id: "b3",
    tipe: "layanan",
    judul: "Aplikasi ERP per modul",
    isi: "Kasir, stok, keuangan, atau kepegawaian. Harga per modul, bisa dicicil per tahap.",
    harga: 12_000_000,
    aktif: true,
  },
  {
    id: "b4",
    tipe: "layanan",
    judul: "Perawatan bulanan",
    isi: "Backup mingguan, pembaruan keamanan, dan revisi konten ringan maksimal 4 kali sebulan.",
    harga: 500_000,
    aktif: true,
  },
  {
    id: "b5",
    tipe: "faq",
    judul: "Berapa lama pengerjaannya?",
    isi: "Company profile 10 sampai 14 hari kerja. Toko online 3 sampai 4 minggu. ERP tergantung jumlah modul, dibahas saat rapat awal.",
    harga: null,
    aktif: true,
  },
  {
    id: "b6",
    tipe: "faq",
    judul: "Sistem pembayarannya bagaimana?",
    isi: "DP 50 persen di awal, sisanya saat serah terima. Untuk proyek di atas 20 juta bisa dibagi tiga termin.",
    harga: null,
    aktif: true,
  },
  {
    id: "b7",
    tipe: "faq",
    judul: "Apakah bisa revisi?",
    isi: "Bisa, 3 kali revisi desain gratis di tahap mockup. Revisi setelah pengembangan dimulai dihitung terpisah.",
    harga: null,
    aktif: true,
  },
  {
    id: "b8",
    tipe: "gaya",
    judul: "Gaya bahasa balasan",
    isi: "Santai tapi sopan, panggil calon client dengan Bapak atau Ibu. Jangan pakai istilah teknis tanpa penjelasan. Balasan maksimal 4 kalimat, selalu tutup dengan satu pertanyaan supaya percakapan jalan terus.",
    harga: null,
    aktif: true,
  },
  {
    id: "b9",
    tipe: "catatan",
    judul: "Yang tidak boleh dijanjikan AI",
    isi: "Jangan pernah memberi diskon, jangan menyebut tanggal serah terima yang pasti, dan jangan menerima proyek di luar daftar layanan. Semua itu eskalasi ke manusia.",
    harga: null,
    aktif: true,
  },
];

/** Angka ringkasan untuk dasbor. Nanti diganti agregat dari database. */
export const RINGKASAN = {
  pesan_masuk_hari_ini: 47,
  dijawab_ai: 38,
  butuh_kamu: 6,
  draf_menunggu: 3,
  waktu_balas_rata_detik: 42,
  kontak_baru_minggu_ini: 12,
  biaya_ai_bulan_ini: 2.41,
  kuota_pesan_harian: 300,
  pesan_terpakai_hari_ini: 47,
};

export const AKTIVITAS_7_HARI = [
  { hari: "Sen", masuk: 34, ai: 28, manusia: 6 },
  { hari: "Sel", masuk: 41, ai: 33, manusia: 8 },
  { hari: "Rab", masuk: 29, ai: 25, manusia: 4 },
  { hari: "Kam", masuk: 52, ai: 44, manusia: 8 },
  { hari: "Jum", masuk: 48, ai: 41, manusia: 7 },
  { hari: "Sab", masuk: 22, ai: 20, manusia: 2 },
  { hari: "Min", masuk: 47, ai: 38, manusia: 9 },
];
