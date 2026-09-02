import { MODEL, model_sah, type NamaModel } from "./model";

/**
 * Menghitung biaya nyata satu pemakaian model, termasuk cache.
 *
 * hitung_biaya() di model.ts sengaja dibiarkan sederhana karena dipakai
 * memperkirakan sebelum memanggil. Yang di sini untuk menagih: token cache
 * punya tarif sendiri, dan mengabaikannya membuat laporan biaya selalu
 * terlihat lebih murah daripada tagihan Anthropic yang sungguhan.
 *
 * Tarif cache mengikuti aturan Anthropic: menulis cache 1,25 kali harga
 * token masuk biasa, membacanya 0,1 kali. Menulis lebih mahal sekali,
 * membaca jauh lebih murah berkali-kali sesudahnya.
 */
const KALI_TULIS_CACHE = 1.25;
const KALI_BACA_CACHE = 0.1;

export type PemakaianToken = {
  model: string;
  token_masuk: number;
  token_keluar: number;
  token_cache_baca: number;
  token_cache_tulis: number;
};

/** Model yang dipakai kalau catatannya menyebut nama yang tidak dikenal. */
const CADANGAN: NamaModel = "claude-haiku-4-5";

/** Biaya dalam dolar. */
export function biaya_dolar(pakai: PemakaianToken): number {
  const nama = model_sah(pakai.model) ? pakai.model : CADANGAN;
  const m = MODEL[nama];
  const per_juta = (jumlah: number, tarif: number) => (jumlah * tarif) / 1_000_000;

  return (
    per_juta(pakai.token_masuk, m.harga_masuk_per_juta) +
    per_juta(pakai.token_keluar, m.harga_keluar_per_juta) +
    per_juta(pakai.token_cache_tulis, m.harga_masuk_per_juta * KALI_TULIS_CACHE) +
    per_juta(pakai.token_cache_baca, m.harga_masuk_per_juta * KALI_BACA_CACHE)
  );
}

export function total_biaya_dolar(daftar: PemakaianToken[]): number {
  return daftar.reduce((jumlah, p) => jumlah + biaya_dolar(p), 0);
}

/**
 * Kurs dipakai hanya untuk menampilkan perkiraan rupiah di layar. Ditaruh di
 * variabel lingkungan supaya bisa disesuaikan tanpa deploy ulang, dan tidak
 * pernah dipakai menghitung tagihan.
 */
export function kurs_dolar(): number {
  const dari_env = Number(process.env.KURS_USD_IDR);
  return Number.isFinite(dari_env) && dari_env > 0 ? dari_env : 16_500;
}
