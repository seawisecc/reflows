import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { PENGETAHUAN as CONTOH } from "@/lib/contoh-data";
import type { ButirPengetahuan, TipePengetahuan } from "@/tipe";

export async function ambil_pengetahuan(): Promise<{
  daftar: ButirPengetahuan[];
  sumber: "supabase" | "contoh";
}> {
  if (!supabase_siap()) return { daftar: CONTOH, sumber: "contoh" };

  const db = await klien_server();
  const { data, error } = await db
    .from("pengetahuan")
    .select("id, tipe, judul, isi, harga, aktif, urutan")
    .order("tipe")
    .order("urutan")
    .order("judul");

  if (error || !data) return { daftar: [], sumber: "supabase" };

  return {
    daftar: data.map((b) => ({
      id: b.id as string,
      tipe: b.tipe as TipePengetahuan,
      judul: b.judul as string,
      isi: b.isi as string,
      harga: b.harga === null ? null : Number(b.harga),
      aktif: b.aktif as boolean,
    })),
    sumber: "supabase",
  };
}
