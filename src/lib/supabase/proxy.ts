import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { kunci_publik_supabase, url_supabase } from "@/lib/lingkungan";

/**
 * Menyegarkan sesi Supabase di setiap permintaan.
 *
 * Token akses Supabase berumur pendek. Tanpa penyegaran di lapisan ini,
 * pengguna yang membuka dasbor setelah ditinggal sebentar akan terlempar
 * ke halaman masuk padahal sesinya masih sah.
 */
export async function segarkan_sesi(permintaan: NextRequest) {
  let jawaban = NextResponse.next({ request: permintaan });

  const db = createServerClient(url_supabase(), kunci_publik_supabase(), {
    cookies: {
      getAll() {
        return permintaan.cookies.getAll();
      },
      setAll(daftar) {
        for (const { name, value } of daftar) {
          permintaan.cookies.set(name, value);
        }
        jawaban = NextResponse.next({ request: permintaan });
        for (const { name, value, options } of daftar) {
          jawaban.cookies.set(name, value, options);
        }
      },
    },
  });

  // Jangan sisipkan apa pun antara pembuatan klien dan panggilan ini.
  // getClaims yang memicu penyegaran token dan penulisan ulang cookie.
  const { data } = await db.auth.getClaims();

  return { jawaban, pengguna: data?.claims ?? null };
}
