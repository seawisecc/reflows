import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { kunci_publik_supabase, url_supabase } from "@/lib/lingkungan";

/**
 * Klien Supabase untuk Server Component dan Route Handler. Sesi dibaca dari
 * cookie, jadi setiap query otomatis jalan sebagai pengguna yang login dan
 * kena RLS. Jangan pernah memakai service role key di jalur ini.
 *
 * Dibungkus cache() supaya satu permintaan cuma punya satu klien.
 *
 * Ini bukan sekadar hemat. Refresh token Supabase berputar: sekali dipakai,
 * yang lama batal. Kalau satu halaman membuat empat klien dan token aksesnya
 * kebetulan sudah kedaluwarsa, keempatnya menyegarkan berbarengan dengan
 * refresh token yang sama. Satu menang, sisanya ditolak, dan sesi pengguna
 * ikut hangus di tengah jalan. Satu klien bersama menghilangkan balapan itu.
 */
export const klien_server = cache(async function klien_server() {
  const toples = await cookies();

  return createServerClient(url_supabase(), kunci_publik_supabase(), {
    cookies: {
      getAll() {
        return toples.getAll();
      },
      setAll(daftar) {
        try {
          for (const { name, value, options } of daftar) {
            toples.set(name, value, options);
          }
        } catch {
          // Dipanggil dari Server Component, di mana cookie tidak boleh
          // ditulis. Middleware yang menyegarkan sesi, jadi ini aman diabaikan.
        }
      },
    },
  });
});
