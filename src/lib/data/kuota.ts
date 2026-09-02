import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import {
  izin_kuota,
  PAKET,
  paket_sah,
  tagihan_bulan_ini,
  type IzinKuota,
  type NamaPaket,
  type SifatPaket,
} from "@/lib/paket";

export type Kuota = IzinKuota & {
  paket: NamaPaket;
  sifat: SifatPaket;
  batas_kelebihan: number | null;
  sejak: string;
  tagihan: number;
};

/**
 * Kuota balasan AI bulan berjalan.
 *
 * Angkanya dihitung ulang dari tabel jalan_ai tiap kali diminta, bukan dari
 * penghitung yang disimpan sendiri. Penghitung tersimpan bisa melenceng
 * begitu ada satu jalur yang lupa menaikkannya, dan melencengnya baru
 * ketahuan saat menagih.
 */
export async function ambil_kuota(): Promise<Kuota | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data, error } = await db.rpc("kuota_bulan_ini");
  if (error || !data) return null;

  const m = data as unknown as Record<string, unknown>;
  if (!paket_sah(m.paket)) return null;

  const paket = m.paket as NamaPaket;
  const batas =
    m.batas_kelebihan === null || m.batas_kelebihan === undefined
      ? null
      : Number(m.batas_kelebihan);
  const keadaan = {
    paket,
    terpakai: Number(m.terpakai ?? 0),
    batas_kelebihan: batas,
  };

  return {
    ...izin_kuota(keadaan),
    paket,
    sifat: PAKET[paket],
    batas_kelebihan: batas,
    sejak: String(m.sejak ?? ""),
    tagihan: tagihan_bulan_ini(keadaan),
  };
}
