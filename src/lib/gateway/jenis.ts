/** Bentuk data yang dipakai aplikasi, lepas dari gateway mana pun yang dipakai. */

export type Lampiran = {
  url: string;
  nama: string | null;
  ekstensi: string | null;
};

export type PesanMasuk = {
  /** Nomor pengirim, sudah ternormalisasi ke bentuk 62xxx tanpa tanda baca. */
  nomor_pengirim: string;
  nama_pengirim: string | null;
  isi: string;
  /** Nomor perangkat penerima. Dipakai memastikan pesan memang untuk tenant ini. */
  nomor_perangkat: string;
  /** Id pesan dari gateway. Kunci anti-dobel kalau webhook dikirim dua kali. */
  wa_message_id: string | null;
  waktu: string;
  lampiran: Lampiran | null;
};

export type HasilKirim =
  | { ok: true; wa_message_id: string | null }
  | { ok: false; alasan: string };

export type PermintaanKirim = {
  ke: string;
  isi: string;
};

/**
 * Keadaan sambungan nomor WhatsApp.
 *
 * "perlu-scan" membawa gambar QR sebagai data URL siap pasang di tag img.
 * Fonnte mengembalikannya sebagai base64 telanjang tanpa awalan, jadi
 * awalannya ditambahkan di adapter, bukan dibebankan ke lapisan tampilan.
 */
export type HasilQr =
  | { keadaan: "perlu-scan"; gambar: string }
  | { keadaan: "tersambung" }
  | { keadaan: "gagal"; alasan: string };

/** Keadaan perangkat WhatsApp menurut gateway. */
export type ProfilPerangkat = {
  /** Nomor yang benar-benar tersambung, menurut gateway. */
  nomor: string | null;
  tersambung: boolean;
  nama: string | null;
  paket: string | null;
  kuota: number | null;
  kedaluwarsa: string | null;
};

export type HasilProfil =
  | { ok: true; profil: ProfilPerangkat }
  | { ok: false; alasan: string };

export interface Gateway {
  readonly nama: string;
  kirim(permintaan: PermintaanKirim): Promise<HasilKirim>;
  /**
   * Menerjemahkan muatan mentah webhook jadi PesanMasuk.
   * Mengembalikan null kalau muatannya bukan pesan teks masuk, misalnya
   * laporan status perangkat atau pesan dari grup.
   */
  baca_webhook(muatan: unknown): PesanMasuk | null;
  /**
   * Mengambil QR untuk menyambungkan nomor, atau melaporkan bahwa nomornya
   * sudah tersambung. Ini sekaligus jadi pemeriksa status: penyedia menolak
   * memberi QR untuk perangkat yang sudah hidup.
   */
  qr(): Promise<HasilQr>;
  /**
   * Keadaan perangkat: nomor mana yang tersambung, dan masih hidup atau
   * tidak. Dipakai menampilkan status di layar, dan sekaligus jadi sumber
   * kebenaran nomor pengirim, supaya nomor yang tersimpan tidak pernah
   * berbeda dari nomor yang benar-benar dipakai mengirim.
   */
  profil(): Promise<HasilProfil>;
}
