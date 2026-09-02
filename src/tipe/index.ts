/** Tipe domain Reflows. Sengaja dipisah dari tipe hasil generate Supabase
 *  supaya lapisan UI tidak ikut berubah setiap kali skema digeser. */

export type PeranPengguna = "pemilik" | "admin" | "staf";

export type ModeBalas = "hybrid" | "draf" | "otomatis";

export type StatusPercakapan = "ai" | "manual" | "selesai";

export type ArahPesan = "masuk" | "keluar";

export type PengirimPesan = "kontak" | "ai" | "manusia" | "kampanye";

export type StatusKirim = "antre" | "terkirim" | "sampai" | "dibaca" | "gagal";

export type TipePengetahuan =
  | "layanan"
  | "faq"
  | "gaya"
  | "catatan"
  | "dokumen";

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

export type StatusKampanye =
  | "draf"
  | "jalan"
  | "jeda"
  | "selesai"
  | "dihentikan";

export type StatusSasaran = "antre" | "selesai" | "berhenti" | "gagal";

export interface LangkahKampanye {
  id: string;
  urutan: number;
  tunda_hari: number;
  varian: string[];
}

export interface Kampanye {
  id: string;
  nama: string;
  status: StatusKampanye;
  saringan_tag: string[];
  jeda_min_detik: number;
  jeda_maks_detik: number;
  batas_harian_awal: number;
  batas_harian_maks: number;
  rem_min_terkirim: number;
  rem_rasio_balas: number;
  rem_alasan: string | null;
  mulai_at: string | null;
  boleh_kirim_lagi_at: string | null;
  dibuat_at: string;
  langkah: LangkahKampanye[];
}

/** Hitungan mentah satu kampanye, dari fungsi keadaan_kampanye di database. */
export interface AngkaKampanye {
  sasaran_total: number;
  antre: number;
  selesai: number;
  berhenti: number;
  gagal: number;
  dibalas: number;
  tersentuh: number;
  pesan_terkirim: number;
  terkirim_hari_ini: number;
  kuota_terpakai_hari_ini: number;
  kuota_harian: number;
  hari_ke: number;
}
