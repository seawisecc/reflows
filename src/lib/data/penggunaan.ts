import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { biaya_dolar, type PemakaianToken } from "@/lib/ai/biaya";

/**
 * Pemakaian AI, untuk halaman Penggunaan.
 *
 * Tabel jalan_ai sudah mencatat token sejak mesin balasan menyala, tapi
 * belum pernah dibaca satu layar pun. Padahal ini satu-satunya angka yang
 * menentukan untung ruginya sebuah paket langganan.
 */

export type PemakaianModel = PemakaianToken & {
  panggilan: number;
  biaya_dolar: number;
};

export type PemakaianHarian = {
  tanggal: string;
  panggilan: number;
  biaya_dolar: number;
};

export type Penggunaan = {
  hari: number;
  panggilan: number;
  eskalasi: number;
  keyakinan_rata: number;
  latensi_tengah_ms: number;
  biaya_dolar: number;
  per_model: PemakaianModel[];
  per_hari: PemakaianHarian[];
};

function ke_pemakaian(baris: Record<string, unknown>): PemakaianToken {
  return {
    model: String(baris.model ?? ""),
    token_masuk: Number(baris.token_masuk ?? 0),
    token_keluar: Number(baris.token_keluar ?? 0),
    token_cache_baca: Number(baris.token_cache_baca ?? 0),
    token_cache_tulis: Number(baris.token_cache_tulis ?? 0),
  };
}

export async function ambil_penggunaan(
  hari = 30,
  zona = "Asia/Makassar",
): Promise<Penggunaan | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data, error } = await db.rpc("penggunaan_ai", {
    p_hari: hari,
    p_zona: zona,
  });
  if (error || !data) return null;

  const m = data as unknown as Record<string, unknown>;
  const model_mentah = (m.per_model ?? []) as Record<string, unknown>[];
  const hari_mentah = (m.per_hari ?? []) as Record<string, unknown>[];

  const per_model: PemakaianModel[] = model_mentah.map((b) => {
    const pakai = ke_pemakaian(b);
    return {
      ...pakai,
      panggilan: Number(b.panggilan ?? 0),
      biaya_dolar: biaya_dolar(pakai),
    };
  });

  // Rekap harian tidak dipecah per model di SQL, karena satu tenant praktis
  // selalu memakai satu model. Kalau nanti tidak lagi begitu, biaya harian
  // di sini akan meleset dan tabel per model yang jadi acuan.
  const per_hari: PemakaianHarian[] = hari_mentah.map((b) => ({
    tanggal: String(b.tanggal ?? ""),
    panggilan: Number(b.panggilan ?? 0),
    biaya_dolar: biaya_dolar({
      ...ke_pemakaian(b),
      model: per_model[0]?.model ?? "claude-haiku-4-5",
    }),
  }));

  return {
    hari,
    panggilan: Number(m.panggilan ?? 0),
    eskalasi: Number(m.eskalasi ?? 0),
    keyakinan_rata: Number(m.keyakinan_rata ?? 0),
    latensi_tengah_ms: Number(m.latensi_tengah_ms ?? 0),
    biaya_dolar: per_model.reduce((n, p) => n + p.biaya_dolar, 0),
    per_model,
    per_hari,
  };
}
