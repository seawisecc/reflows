import "server-only";
import { cache } from "react";
import { klien_server } from "@/lib/supabase/server";
import { klien_layanan } from "@/lib/supabase/layanan";
import { supabase_siap } from "@/lib/lingkungan";
import type { ModeBalas } from "@/tipe";

export type Pengaturan = {
  tenant_id: string;
  gateway: string;
  nomor_wa: string | null;
  mode_balas: ModeBalas;
  ambang_keyakinan: number;
  jam_mulai: string;
  jam_selesai: string;
  zona_waktu: string;
  pesan_di_luar_jam: string | null;
  kuota_pesan_harian: number;
  /** Token tidak pernah dikirim ke browser, cuma kabar ada tidaknya. */
  ada_token: boolean;
  url_webhook: string | null;
  perangkat: {
    tersambung: boolean | null;
    nama: string | null;
    paket: string | null;
    kuota: number | null;
    kedaluwarsa: string | null;
    diperiksa_at: string | null;
  };
};

/**
 * Tenant milik pengguna yang sedang masuk, dibaca lewat klien bersesi.
 *
 * Ini gerbang untuk semua pembacaan yang setelahnya memakai service role.
 * Yang menolak akses harus Row Level Security, bukan perbandingan yang
 * ditulis tangan, supaya kalau kebijakannya salah suatu saat, salahnya
 * kelihatan alih-alih tertutupi.
 */
const tenant_saya = cache(async function tenant_saya(): Promise<string | null> {
  const db = await klien_server();
  const { data: sesi } = await db.auth.getClaims();
  const id = sesi?.claims?.sub;
  if (!id) return null;

  const { data } = await db
    .from("pengguna")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();
  return (data?.tenant_id as string | undefined) ?? null;
});

/** Potong jadi HH:MM. Postgres mengembalikan time sebagai HH:MM:SS. */
function jam_pendek(nilai: unknown): string {
  return String(nilai ?? "").slice(0, 5);
}

export async function ambil_pengaturan(
  asal_url: string,
): Promise<Pengaturan | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data } = await db
    .from("pengaturan_tenant")
    .select(
      "tenant_id, gateway, nomor_wa, mode_balas, ambang_keyakinan, jam_mulai, jam_selesai, zona_waktu, pesan_di_luar_jam, kuota_pesan_harian, perangkat_tersambung, perangkat_nama, perangkat_paket, perangkat_kuota, perangkat_kedaluwarsa, perangkat_diperiksa_at",
    )
    .maybeSingle();

  if (!data) return null;

  // Token dan rahasia webhook dicabut haknya dari peran authenticated, jadi
  // keduanya cuma bisa diambil lewat service role. Gerbangnya baris di atas:
  // kalau RLS tidak meloloskan pengaturan ini, kita tidak sampai ke sini.
  let ada_token = false;
  let url_webhook: string | null = null;
  const tenant_id = data.tenant_id as string;

  try {
    const layanan = klien_layanan();
    const { data: rahasia } = await layanan
      .from("pengaturan_tenant")
      .select("gateway_token_terenkripsi, rahasia_webhook")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    ada_token = Boolean(rahasia?.gateway_token_terenkripsi);
    if (rahasia?.rahasia_webhook) {
      url_webhook = `${asal_url}/api/wa/masuk/${rahasia.rahasia_webhook}`;
    }
  } catch {
    // Kunci service role belum disetel. Layar tetap bisa dibuka, cuma
    // bagian token dan URL webhooknya yang tidak muncul.
  }

  return {
    tenant_id,
    gateway: data.gateway as string,
    nomor_wa: data.nomor_wa as string | null,
    mode_balas: data.mode_balas as ModeBalas,
    ambang_keyakinan: Number(data.ambang_keyakinan),
    jam_mulai: jam_pendek(data.jam_mulai),
    jam_selesai: jam_pendek(data.jam_selesai),
    zona_waktu: data.zona_waktu as string,
    pesan_di_luar_jam: data.pesan_di_luar_jam as string | null,
    kuota_pesan_harian: Number(data.kuota_pesan_harian),
    ada_token,
    url_webhook,
    perangkat: {
      tersambung: data.perangkat_tersambung as boolean | null,
      nama: data.perangkat_nama as string | null,
      paket: data.perangkat_paket as string | null,
      kuota: data.perangkat_kuota === null ? null : Number(data.perangkat_kuota),
      kedaluwarsa: data.perangkat_kedaluwarsa as string | null,
      diperiksa_at: data.perangkat_diperiksa_at as string | null,
    },
  };
}

/** Status ringkas untuk bilah atas, tanpa menyentuh kolom rahasia. */
export const status_perangkat = cache(async function status_perangkat() {
  if (!supabase_siap()) return null;
  const db = await klien_server();
  const { data } = await db
    .from("pengaturan_tenant")
    .select("gateway, nomor_wa, perangkat_tersambung, perangkat_diperiksa_at")
    .maybeSingle();
  if (!data) return null;
  return {
    gateway: data.gateway as string,
    nomor_wa: data.nomor_wa as string | null,
    tersambung: data.perangkat_tersambung as boolean | null,
    diperiksa_at: data.perangkat_diperiksa_at as string | null,
  };
});

export { tenant_saya };
