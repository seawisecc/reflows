/**
 * Pembacaan variabel lingkungan yang gagal keras dan cepat. Lebih baik
 * aplikasi menolak start daripada jalan setengah lalu error di produksi
 * saat ada client yang chat.
 */
function wajib(nama: string, nilai: string | undefined) {
  if (!nilai) {
    throw new Error(
      `Variabel lingkungan ${nama} belum diisi. Salin .env.example jadi .env.local lalu lengkapi.`,
    );
  }
  return nilai;
}

export function url_supabase() {
  return wajib(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function kunci_publik_supabase() {
  return wajib(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/** Ada tidaknya konfigurasi Supabase, untuk memutuskan pakai data contoh. */
export function supabase_siap() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Alamat publik aplikasi, dipakai menyusun URL mutlak untuk metadata Open
 * Graph. Bisa ditimpa lewat URL_APLIKASI supaya deployment lain, misalnya
 * project Supabase kedua untuk pratinjau, tidak menunjuk ke produksi.
 */
export function alamat_aplikasi() {
  return process.env.URL_APLIKASI ?? "https://reflows.seawise.id";
}

/**
 * Nomor WhatsApp untuk calon pelanggan di halaman depan.
 *
 * Kosong berarti tombol chatnya tidak muncul sama sekali. Halaman jualan
 * yang menampilkan nomor karangan lebih buruk daripada halaman yang cuma
 * menyuruh masuk, karena orang benar-benar akan mengetik ke nomor itu.
 */
export function kontak_whatsapp(): string | null {
  const nomor = (process.env.NEXT_PUBLIC_KONTAK_WA ?? "").replace(/\D/g, "");
  return nomor.length >= 9 ? nomor : null;
}
