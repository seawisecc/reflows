import { NextResponse, type NextRequest } from "next/server";
import { segarkan_sesi } from "@/lib/supabase/proxy";
import { supabase_siap } from "@/lib/lingkungan";
import { boleh_tanpa_sesi } from "@/lib/jalur-terbuka";

export async function proxy(permintaan: NextRequest) {
  const jalur = permintaan.nextUrl.pathname;

  // Daftarnya beserta alasannya ada di src/lib/jalur-terbuka.ts, dipisah
  // ke sana supaya bisa diuji. Webhook WhatsApp yang ikut dialihkan ke
  // halaman masuk cuma akan dilihat gateway sebagai kegagalan, lalu
  // dikirim ulang terus-menerus.
  if (boleh_tanpa_sesi(jalur)) {
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
