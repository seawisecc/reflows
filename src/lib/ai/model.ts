/**
 * Kemampuan tiap model Claude yang dipakai Reflows.
 *
 * Ini bukan detail sepele. Model keluarga lama seperti Haiku 4.5 menolak
 * parameter adaptive thinking dan effort dengan galat 400, sedangkan model
 * baru justru menolak budget_tokens. Kalau permintaannya disusun seragam,
 * salah satu jalur pasti gagal, dan gagalnya di tengah percakapan client.
 */

export type NamaModel =
  | "claude-haiku-4-5"
  | "claude-sonnet-5"
  | "claude-opus-5";

export type SifatModel = {
  /** Mendukung thinking adaptif dan output_config.effort. */
  penalaran_adaptif: boolean;
  /**
   * Mendukung parameter fallbacks, yang membuat permintaan yang ditolak
   * penyaring keamanan diulang sendiri di model cadangan. Model keluarga
   * lama menolaknya dengan galat 400.
   */
  fallback_penolakan: boolean;
  harga_masuk_per_juta: number;
  harga_keluar_per_juta: number;
  label: string;
};

export const MODEL: Record<NamaModel, SifatModel> = {
  "claude-haiku-4-5": {
    penalaran_adaptif: false,
    fallback_penolakan: false,
    harga_masuk_per_juta: 1,
    harga_keluar_per_juta: 5,
    label: "Haiku 4.5, paling hemat",
  },
  "claude-sonnet-5": {
    penalaran_adaptif: true,
    fallback_penolakan: true,
    harga_masuk_per_juta: 2,
    harga_keluar_per_juta: 10,
    label: "Sonnet 5, menengah",
  },
  "claude-opus-5": {
    penalaran_adaptif: true,
    fallback_penolakan: true,
    harga_masuk_per_juta: 5,
    harga_keluar_per_juta: 25,
    label: "Opus 5, paling teliti",
  },
};

export function model_sah(nilai: unknown): nilai is NamaModel {
  return typeof nilai === "string" && nilai in MODEL;
}

/**
 * Menyusun bagian permintaan yang berbeda antar keluarga model.
 * Dipakai supaya pemanggil tidak perlu mengingat model mana butuh apa.
 */
export function opsi_penalaran(
  model: NamaModel,
  effort: "low" | "medium" | "high" = "medium",
): Record<string, unknown> {
  if (!MODEL[model].penalaran_adaptif) {
    // Model lama: tanpa thinking sama sekali. Menyalakannya butuh
    // budget_tokens, dan untuk pekerjaan sependek balasan chat itu cuma
    // menambah biaya tanpa menambah ketepatan.
    return {};
  }
  return {
    thinking: { type: "adaptive" as const },
    output_config_tambahan: { effort },
  };
}

export function hitung_biaya(
  model: NamaModel,
  token_masuk: number,
  token_keluar: number,
): number {
  const m = MODEL[model];
  return (
    (token_masuk * m.harga_masuk_per_juta + token_keluar * m.harga_keluar_per_juta) /
    1_000_000
  );
}
