import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { klien_layanan } from "@/lib/supabase/layanan";
import { jalankan_antrean } from "@/lib/kampanye/antrean";

/** Gateway dan enkripsi token butuh node:crypto, jadi bukan Edge. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Satu putaran mengirim paling banyak satu pesan per kampanye, jadi tidak
 * pernah lama. Batasnya dipasang rendah supaya panggilan yang macet karena
 * gateway tidak menjawab berhenti sendiri sebelum cron berikutnya datang.
 */
export const maxDuration = 45;

/**
 * Antrean kampanye keluar.
 *
 * Dipanggil pg_cron di Supabase setiap menit, bukan Vercel Cron. Alasannya
 * bukan teknis semata: antrean ini tidak boleh ikut mati kalau paket Vercel
 * berubah, dan menaruh penjadwalnya di sebelah datanya membuat satu hal
 * lebih sedikit yang bisa lepas tanpa ketahuan.
 *
 * Logikanya sendiri tetap di sini, di TypeScript, bukan di Edge Function
 * Deno. Aturan anti-ban, adapter gateway, dan normalisasi nomor sudah
 * ditulis sekali di src/lib. Menyalinnya ke bahasa kedua berarti suatu saat
 * dua salinan itu berbeda, dan yang berbeda adalah rem.
 */
function rahasia_cocok(diberikan: string | null): boolean {
  const benar = process.env.RAHASIA_CRON;
  if (!benar || !diberikan) return false;

  // Panjang yang berbeda langsung ditolak, karena timingSafeEqual melempar
  // kalau panjangnya tidak sama dan galatnya sendiri membocorkan panjang.
  const a = Buffer.from(diberikan);
  const b = Buffer.from(benar);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function jalan(permintaan: Request) {
  if (!rahasia_cocok(permintaan.headers.get("x-rahasia-cron"))) {
    // Tidak menjelaskan apa pun. Jalur ini terbuka di internet.
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const db = klien_layanan();
  const hasil = await jalankan_antrean(db);

  return NextResponse.json({
    ok: true,
    diperiksa: hasil.length,
    terkirim: hasil.filter((h) => h.terkirim).length,
    rincian: hasil,
  });
}

export async function POST(permintaan: Request) {
  return jalan(permintaan);
}

/** Sebagian penjadwal cuma bisa GET. Rahasianya tetap di header. */
export async function GET(permintaan: Request) {
  return jalan(permintaan);
}
