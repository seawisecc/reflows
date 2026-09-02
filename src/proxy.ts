import { NextResponse, type NextRequest } from "next/server";
import { segarkan_sesi } from "@/lib/supabase/proxy";
import { supabase_siap } from "@/lib/lingkungan";

/**
 * Jalur yang boleh dibuka tanpa sesi pengguna.
 *
 * Ditulis satu per satu, bukan dengan aturan menyeluruh semacam "semua
 * /api", supaya jalur baru tidak diam-diam ikut terbuka. Dua yang ada di
 * sini menjaga dirinya sendiri: webhook lewat rahasia 64 karakter di
 * jalurnya, antrean kampanye lewat header rahasia yang dibandingkan dengan
 * timingSafeEqual.
 */
const TERBUKA = ["/masuk", "/api/wa", "/api/kampanye"];

export async function proxy(permintaan: NextRequest) {
  const jalur = permintaan.nextUrl.pathname;

  // Webhook WhatsApp tidak punya sesi pengguna dan memang tidak boleh
  // dialihkan ke halaman masuk. Gateway cuma akan melihat pengalihan itu
  // sebagai kegagalan lalu mengirim ulang terus-menerus.
  if (TERBUKA.some((t) => jalur === t || jalur.startsWith(`${t}/`))) {
    return NextResponse.next();
  }

  // Selama Supabase belum disetel, aplikasi jalan dengan data contoh.
  // Memaksa login di keadaan itu cuma membuat aplikasi tidak bisa dibuka.
  if (!supabase_siap()) return NextResponse.next();

  const { jawaban, pengguna } = await segarkan_sesi(permintaan);

  if (!pengguna) {
    const tujuan = permintaan.nextUrl.clone();
    tujuan.pathname = "/masuk";
    tujuan.searchParams.set("lanjut", jalur);
    return NextResponse.redirect(tujuan);
  }

  return jawaban;
}

export const config = {
  matcher: [
    /*
     * Semua jalur kecuali berkas statis dan gambar. Berkas statis tidak
     * butuh sesi, dan memeriksanya cuma menambah kerja di setiap muat.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
