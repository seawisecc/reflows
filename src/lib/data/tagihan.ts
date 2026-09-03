import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { baca_periode, label_periode } from "@/lib/tagihan";

export type TagihanLangganan = {
  id: string;
  periode: string;
  label: string;
  status: "draf" | "terkirim" | "lunas" | "batal";
  paket: string;
  harga_pokok: number;
  kuota: number;
  terpakai: number;
  kelebihan: number;
  tarif_kelebihan: number;
  biaya_kelebihan: number;
  total: number;
  bank_nama: string | null;
  bank_rekening: string | null;
  bank_atas_nama: string | null;
  dibayar_at: string | null;
};

/**
 * Tagihan langganan tenant yang sedang login.
 *
 * Lewat klien bersesi, jadi yang menyaring RLS. Tabelnya memang tidak punya
 * kebijakan tulis sama sekali, jadi halaman ini hanya bisa menampilkan.
 * Menerbitkan dan melunasi dikerjakan Seawise lewat npm run tagihan.
 */
export async function ambil_tagihan(
  batas = 12,
): Promise<TagihanLangganan[] | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data, error } = await db
    .from("tagihan_langganan")
    .select(
      "id, periode, status, paket, harga_pokok, kuota, terpakai, kelebihan, tarif_kelebihan, biaya_kelebihan, total, bank_nama, bank_rekening, bank_atas_nama, dibayar_at",
    )
    .order("periode", { ascending: false })
    .limit(batas);

  if (error || !data) return null;

  return data.map((b) => {
    const periode = String(b.periode);
    const p = baca_periode(periode);
    return {
      id: b.id as string,
      periode,
      label: p ? label_periode(p) : periode,
      status: b.status as TagihanLangganan["status"],
      paket: b.paket as string,
      harga_pokok: Number(b.harga_pokok),
      kuota: Number(b.kuota),
      terpakai: Number(b.terpakai),
      kelebihan: Number(b.kelebihan),
      tarif_kelebihan: Number(b.tarif_kelebihan),
      biaya_kelebihan: Number(b.biaya_kelebihan),
      total: Number(b.total),
      bank_nama: (b.bank_nama as string | null) ?? null,
      bank_rekening: (b.bank_rekening as string | null) ?? null,
      bank_atas_nama: (b.bank_atas_nama as string | null) ?? null,
      dibayar_at: (b.dibayar_at as string | null) ?? null,
    };
  });
}
