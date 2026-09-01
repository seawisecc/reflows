import "server-only";
import { cache } from "react";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import type { PeranPengguna } from "@/tipe";

export type ProfilPengguna = {
  id: string;
  nama: string;
  email: string;
  peran: PeranPengguna;
  tenant_nama: string;
};

/**
 * Profil pengguna yang sedang masuk, beserta nama bisnisnya.
 * Di-cache per permintaan karena bilah atas dan halaman sama-sama memakainya.
 */
export const profil_saya = cache(async function profil_saya(): Promise<ProfilPengguna | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data: sesi } = await db.auth.getClaims();
  const id = sesi?.claims?.sub;
  if (!id) return null;

  const { data } = await db
    .from("pengguna")
    .select("id, nama, email, peran, tenants:tenant_id ( nama )")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;

  const tenant = data.tenants as unknown as { nama: string } | null;
  return {
    id: data.id as string,
    nama: data.nama as string,
    email: data.email as string,
    peran: data.peran as PeranPengguna,
    tenant_nama: tenant?.nama ?? "Bisnis kamu",
  };
});
