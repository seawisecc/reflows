import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { PERCAKAPAN as CONTOH } from "@/lib/contoh-data";
import type { Kontak, SumberKontak, StatusPercakapan } from "@/tipe";

export type BarisKontak = Kontak & {
  jumlah_pesan: number;
  pesan_terakhir_at: string | null;
  status: StatusPercakapan | null;
};

type Mentah = {
  id: string;
  nama: string | null;
  nomor_wa: string;
  tag: string[] | null;
  sumber: string;
  opt_out_at: string | null;
  dibuat_at: string;
  percakapan: {
    status: StatusPercakapan;
    pesan_terakhir_at: string;
    pesan: { count: number }[];
  }[];
};

/**
 * Daftar kontak nyata.
 *
 * Jumlah pesan diminta sebagai agregat lewat pesan(count), bukan dengan
 * menarik semua barisnya lalu dihitung di aplikasi. Untuk seratus kontak
 * yang masing-masing punya puluhan pesan, bedanya beberapa kilobyte dengan
 * beberapa megabyte yang dikirim melintasi jaringan tiap kali halaman dibuka.
 */
export async function ambil_kontak(): Promise<{
  daftar: BarisKontak[];
  sumber: "supabase" | "contoh";
}> {
  if (!supabase_siap()) {
    return {
      daftar: CONTOH.map((p) => ({
        ...p.kontak,
        jumlah_pesan: p.pesan.length,
        pesan_terakhir_at: p.pesan_terakhir_at,
        status: p.status,
      })),
      sumber: "contoh",
    };
  }

  const db = await klien_server();
  const { data, error } = await db
    .from("kontak")
    .select(
      `id, nama, nomor_wa, tag, sumber, opt_out_at, dibuat_at,
       percakapan ( status, pesan_terakhir_at, pesan (count) )`,
    )
    .order("dibuat_at", { ascending: false })
    .limit(500);

  if (error || !data) return { daftar: [], sumber: "supabase" };

  const daftar = (data as unknown as Mentah[]).map((k) => {
    const utas = k.percakapan?.[0] ?? null;
    return {
      id: k.id,
      nama: k.nama ?? `+${k.nomor_wa}`,
      nomor_wa: k.nomor_wa,
      tag: k.tag ?? [],
      sumber: k.sumber as SumberKontak,
      opt_out_at: k.opt_out_at,
      dibuat_at: k.dibuat_at,
      jumlah_pesan: utas?.pesan?.[0]?.count ?? 0,
      pesan_terakhir_at: utas?.pesan_terakhir_at ?? null,
      status: utas?.status ?? null,
    };
  });

  // Yang paling baru bicara ada di atas. Kontak yang belum pernah punya
  // percakapan jatuh ke bawah, diurut dari yang paling baru ditambahkan.
  daftar.sort((a, b) =>
    (b.pesan_terakhir_at ?? b.dibuat_at).localeCompare(
      a.pesan_terakhir_at ?? a.dibuat_at,
    ),
  );

  return { daftar, sumber: "supabase" };
}
