/** Tipe domain Reflows. Sengaja dipisah dari tipe hasil generate Supabase
 *  supaya lapisan UI tidak ikut berubah setiap kali skema digeser. */

export type PeranPengguna = "pemilik" | "admin" | "staf";

export type ModeBalas = "hybrid" | "draf" | "otomatis";

export type StatusPercakapan = "ai" | "manual" | "selesai";

export type ArahPesan = "masuk" | "keluar";

export type PengirimPesan = "kontak" | "ai" | "manusia";

export type StatusKirim = "antre" | "terkirim" | "sampai" | "dibaca" | "gagal";

export type TipePengetahuan = "layanan" | "faq" | "gaya" | "catatan";

export type SumberKontak = "chat-masuk" | "impor" | "manual" | "kampanye";

export interface Kontak {
  id: string;
  nama: string;
  nomor_wa: string;
  tag: string[];
  sumber: SumberKontak;
  opt_out_at: string | null;
  dibuat_at: string;
}

export interface Pesan {
  id: string;
  arah: ArahPesan;
  pengirim: PengirimPesan;
  isi: string;
  status_kirim: StatusKirim;
  /** Hanya untuk pesan yang dibuat AI. Dipakai menyetel ambang eskalasi. */
  keyakinan?: number;
  waktu: string;
}

export interface Percakapan {
  id: string;
  kontak: Kontak;
  status: StatusPercakapan;
  belum_dibaca: number;
  alasan_eskalasi: string | null;
  pesan_terakhir_at: string;
  pesan: Pesan[];
}

export interface ButirPengetahuan {
  id: string;
  tipe: TipePengetahuan;
  judul: string;
  isi: string;
  harga: number | null;
  aktif: boolean;
}
