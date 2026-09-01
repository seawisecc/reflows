import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { PERCAKAPAN as CONTOH } from "@/lib/contoh-data";
import type { Percakapan, Pesan, StatusPercakapan } from "@/tipe";

/**
 * Semua query di berkas ini memakai klien bersesi, jadi Row Level Security
 * yang menyaring tenant. Tidak ada satu pun query yang menyebut tenant_id
 * sendiri: kalau disebut, dan suatu saat kebijakannya salah, kesalahannya
 * tersembunyi karena penyaringan ganda menutupinya.
 */

type BarisMentah = {
  id: string;
  status: StatusPercakapan;
  belum_dibaca: number;
  alasan_eskalasi: string | null;
  pesan_terakhir_at: string;
  kontak: {
    id: string;
    nama: string | null;
    nomor_wa: string;
    tag: string[] | null;
    sumber: string;
    opt_out_at: string | null;
    dibuat_at: string;
  } | null;
  pesan: {
    id: string;
    arah: "masuk" | "keluar";
    pengirim: "kontak" | "ai" | "manusia";
    isi: string;
    status_kirim: Pesan["status_kirim"];
    dibuat_at: string;
  }[];
};

const PILIHAN = `
  id, status, belum_dibaca, alasan_eskalasi, pesan_terakhir_at,
  kontak:kontak_id ( id, nama, nomor_wa, tag, sumber, opt_out_at, dibuat_at ),
  pesan ( id, arah, pengirim, isi, status_kirim, dibuat_at )
`;

function ke_percakapan(baris: BarisMentah): Percakapan | null {
  if (!baris.kontak) return null;
  return {
    id: baris.id,
    status: baris.status,
    belum_dibaca: baris.belum_dibaca,
    alasan_eskalasi: baris.alasan_eskalasi,
    pesan_terakhir_at: baris.pesan_terakhir_at,
    kontak: {
      id: baris.kontak.id,
      nama: baris.kontak.nama ?? `+${baris.kontak.nomor_wa}`,
      nomor_wa: baris.kontak.nomor_wa,
      tag: baris.kontak.tag ?? [],
      sumber: baris.kontak.sumber as Percakapan["kontak"]["sumber"],
      opt_out_at: baris.kontak.opt_out_at,
      dibuat_at: baris.kontak.dibuat_at,
    },
    pesan: [...baris.pesan]
      .sort((a, b) => a.dibuat_at.localeCompare(b.dibuat_at))
      .map((p) => ({
        id: p.id,
        arah: p.arah,
        pengirim: p.pengirim,
        isi: p.isi,
        status_kirim: p.status_kirim,
        waktu: p.dibuat_at,
      })),
  };
}

export type SumberData = "supabase" | "contoh";

export async function ambil_percakapan(): Promise<{
  daftar: Percakapan[];
  sumber: SumberData;
}> {
  // Tanpa Supabase, aplikasi tetap bisa dibuka dengan data contoh. Layar
  // yang kosong melompong lebih membingungkan daripada data yang jelas
  // ditandai sebagai contoh.
  if (!supabase_siap()) return { daftar: CONTOH, sumber: "contoh" };

  const db = await klien_server();
  const { data, error } = await db
    .from("percakapan")
    .select(PILIHAN)
    .order("pesan_terakhir_at", { ascending: false })
    .limit(100);

  if (error || !data) return { daftar: [], sumber: "supabase" };

  const daftar = (data as unknown as BarisMentah[])
    .map(ke_percakapan)
    .filter((p): p is Percakapan => p !== null);

  return { daftar, sumber: "supabase" };
}

export async function ambil_ringkasan() {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const awal_hari = new Date();
  awal_hari.setHours(0, 0, 0, 0);

  const [masuk, ai, manual, kontak_baru] = await Promise.all([
    db
      .from("pesan")
      .select("id", { count: "exact", head: true })
      .eq("arah", "masuk")
      .gte("dibuat_at", awal_hari.toISOString()),
    db
      .from("pesan")
      .select("id", { count: "exact", head: true })
      .eq("arah", "keluar")
      .eq("pengirim", "ai")
      .gte("dibuat_at", awal_hari.toISOString()),
    db
      .from("percakapan")
      .select("id", { count: "exact", head: true })
      .eq("status", "manual"),
    db
      .from("kontak")
      .select("id", { count: "exact", head: true })
      .gte("dibuat_at", new Date(Date.now() - 7 * 86400_000).toISOString()),
  ]);

  return {
    pesan_masuk_hari_ini: masuk.count ?? 0,
    dijawab_ai: ai.count ?? 0,
    butuh_kamu: manual.count ?? 0,
    kontak_baru_minggu_ini: kontak_baru.count ?? 0,
  };
}
