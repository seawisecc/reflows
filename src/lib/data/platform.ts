import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { biaya_dolar, kurs_dolar } from "@/lib/ai/biaya";
import { izin_kuota, PAKET, paket_sah, type NamaPaket } from "@/lib/paket";
import { izin_layanan, type JenisLayanan } from "@/lib/layanan";

export type BarisPlatform = {
  id: string;
  nama: string;
  slug: string;
  paket: NamaPaket | null;
  jenis_layanan: JenisLayanan;
  nomor_wa: string | null;
  tersambung: boolean | null;
  kontak: number;
  percakapan: number;
  butuh_manusia: number;
  pesan_bulan_ini: number;
  balasan_ai: number;
  kuota: number;
  kelebihan: number;
  /** Biaya model bulan ini, dalam rupiah. */
  biaya_ai: number;
  /** Yang ditagihkan ke tenant bulan ini, pokok plus kelebihan. */
  tagihan: number;
  marjin: number;
  terakhir_aktif: string | null;
  dibuat_at: string;
};

export type RingkasanPlatform = {
  tenant: BarisPlatform[];
  total: {
    tenant: number;
    aktif: number;
    balasan_ai: number;
    biaya_ai: number;
    tagihan: number;
    marjin: number;
  };
};

/**
 * Rekap lintas tenant.
 *
 * Tidak ada pemeriksaan peran di sini, dan itu disengaja. Fungsi SQL-nya
 * security invoker, jadi RLS yang menyaring: pemakai biasa cuma melihat
 * tenantnya sendiri, super admin melihat semuanya. Menambahkan pemeriksaan
 * peran di TypeScript cuma menciptakan gerbang kedua yang suatu saat akan
 * berbeda pendapat dengan gerbang pertama.
 */
export async function ambil_ringkasan_platform(): Promise<RingkasanPlatform | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data, error } = await db.rpc("ringkasan_platform");
  if (error || !data) return null;

  const kurs = kurs_dolar();
  const mentah = data as unknown as Record<string, unknown>[];

  const tenant: BarisPlatform[] = mentah.map((b) => {
    const paket = paket_sah(b.paket) ? (b.paket as NamaPaket) : null;
    const balasan_ai = Number(b.balasan_ai ?? 0);

    const biaya_ai =
      biaya_dolar({
        model: "claude-haiku-4-5",
        token_masuk: Number(b.token_masuk ?? 0),
        token_keluar: Number(b.token_keluar ?? 0),
        token_cache_baca: 0,
        token_cache_tulis: 0,
      }) * kurs;

    const izin = paket
      ? izin_kuota({
          paket,
          terpakai: balasan_ai,
          batas_kelebihan:
            b.batas_kelebihan === null || b.batas_kelebihan === undefined
              ? null
              : Number(b.batas_kelebihan),
        })
      : null;

    const tagihan = paket
      ? PAKET[paket].harga_bulanan + (izin?.biaya_kelebihan ?? 0)
      : 0;

    return {
      id: b.id as string,
      nama: b.nama as string,
      slug: b.slug as string,
      paket,
      jenis_layanan: izin_layanan({
        aktif: b.aktif === true,
        dijeda_at: (b.dijeda_at as string | null) ?? null,
      }).jenis,
      nomor_wa: (b.nomor_wa as string | null) ?? null,
      tersambung: (b.perangkat_tersambung as boolean | null) ?? null,
      kontak: Number(b.kontak ?? 0),
      percakapan: Number(b.percakapan ?? 0),
      butuh_manusia: Number(b.butuh_manusia ?? 0),
      pesan_bulan_ini: Number(b.pesan_bulan_ini ?? 0),
      balasan_ai,
      kuota: izin?.kuota ?? 0,
      kelebihan: izin?.kelebihan ?? 0,
      biaya_ai: Math.round(biaya_ai),
      tagihan,
      marjin: tagihan - Math.round(biaya_ai),
      terakhir_aktif: (b.terakhir_aktif as string | null) ?? null,
      dibuat_at: b.dibuat_at as string,
    };
  });

  return {
    tenant,
    total: {
      tenant: tenant.length,
      aktif: tenant.filter((t) => t.jenis_layanan === "menyala").length,
      balasan_ai: tenant.reduce((n, t) => n + t.balasan_ai, 0),
      biaya_ai: tenant.reduce((n, t) => n + t.biaya_ai, 0),
      tagihan: tenant.reduce((n, t) => n + t.tagihan, 0),
      marjin: tenant.reduce((n, t) => n + t.marjin, 0),
    },
  };
}
