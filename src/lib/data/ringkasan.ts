import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { total_biaya_dolar, type PemakaianToken } from "@/lib/ai/biaya";

/**
 * Angka dasbor, semuanya dari database.
 *
 * Satu panggilan RPC menggantikan delapan query terpisah. Bukan sekadar
 * rapi: fungsi Vercel berjalan di Singapura dan database juga, tapi tiap
 * perjalanan bolak-balik tetap punya ongkos, dan delapan di antaranya
 * berderet menjadi jeda yang terasa saat halaman dibuka.
 */

/**
 * to_char di Postgres selalu memberi nama hari Inggris, tidak peduli locale
 * server. Diterjemahkan di sini, bukan dengan memaksa lc_time di database,
 * karena locale server itu milik seluruh project dan tidak boleh digeser
 * hanya demi label sebuah grafik.
 */
const NAMA_HARI: Record<string, string> = {
  Mon: "Sen",
  Tue: "Sel",
  Wed: "Rab",
  Thu: "Kam",
  Fri: "Jum",
  Sat: "Sab",
  Sun: "Min",
};

export type BarisAktivitasNyata = {
  tanggal: string;
  label: string;
  masuk: number;
  ai: number;
};

export type RingkasanNyata = {
  pesan_masuk_hari_ini: number;
  dijawab_ai: number;
  pesan_keluar_hari_ini: number;
  butuh_kamu: number;
  draf_menunggu: number;
  kontak_baru_minggu_ini: number;
  kontak_total: number;
  materi_aktif: number;
  waktu_balas_rata_detik: number;
  balasan_terhitung: number;
  biaya_bulan_ini_dolar: number;
  panggilan_bulan_ini: number;
  aktivitas: BarisAktivitasNyata[];
};

type Mentah = Omit<
  RingkasanNyata,
  "biaya_bulan_ini_dolar" | "panggilan_bulan_ini"
> & {
  token_bulan_ini: (PemakaianToken & { panggilan: number })[];
};

export async function ambil_ringkasan_nyata(
  zona = "Asia/Makassar",
): Promise<RingkasanNyata | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data, error } = await db.rpc("ringkasan_dasbor", { p_zona: zona });
  if (error || !data) return null;

  const m = data as unknown as Mentah;
  const token = m.token_bulan_ini ?? [];

  return {
    pesan_masuk_hari_ini: Number(m.pesan_masuk_hari_ini ?? 0),
    dijawab_ai: Number(m.dijawab_ai ?? 0),
    pesan_keluar_hari_ini: Number(m.pesan_keluar_hari_ini ?? 0),
    butuh_kamu: Number(m.butuh_kamu ?? 0),
    draf_menunggu: Number(m.draf_menunggu ?? 0),
    kontak_baru_minggu_ini: Number(m.kontak_baru_minggu_ini ?? 0),
    kontak_total: Number(m.kontak_total ?? 0),
    materi_aktif: Number(m.materi_aktif ?? 0),
    waktu_balas_rata_detik: Number(m.waktu_balas_rata_detik ?? 0),
    balasan_terhitung: Number(m.balasan_terhitung ?? 0),
    biaya_bulan_ini_dolar: total_biaya_dolar(
      token.map((t) => ({
        model: t.model,
        token_masuk: Number(t.token_masuk),
        token_keluar: Number(t.token_keluar),
        token_cache_baca: Number(t.token_cache_baca),
        token_cache_tulis: Number(t.token_cache_tulis),
      })),
    ),
    panggilan_bulan_ini: token.reduce((n, t) => n + Number(t.panggilan), 0),
    aktivitas: (m.aktivitas ?? []).map((a) => ({
      tanggal: a.tanggal,
      label: NAMA_HARI[a.label] ?? a.label,
      masuk: Number(a.masuk),
      ai: Number(a.ai),
    })),
  };
}
