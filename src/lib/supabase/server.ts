import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { kunci_publik_supabase, url_supabase } from "@/lib/lingkungan";

/**
 * Klien Supabase untuk Server Component dan Route Handler. Sesi dibaca dari
 * cookie, jadi setiap query otomatis jalan sebagai pengguna yang login dan
 * kena RLS. Jangan pernah memakai service role key di jalur ini.
 */
export async function klien_server() {
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
}
