import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { url_supabase } from "@/lib/lingkungan";

/**
 * Klien service role. MELEWATI semua Row Level Security.
 *
 * Hanya boleh dipakai di jalur yang memang tidak punya sesi pengguna, yaitu
 * webhook WhatsApp: Fonnte tidak login sebagai siapa pun, jadi tidak ada
 * auth.uid() yang bisa dipakai kebijakan RLS. Konsekuensinya setiap query di
 * jalur ini wajib menyaring tenant_id sendiri, karena tidak ada lagi jaring
 * pengaman di bawahnya.
 *
 * Jangan pernah dipanggil dari Server Component halaman. Untuk itu pakai
 * klien_server() yang membawa sesi pengguna dan tetap kena RLS.
 */
export function klien_layanan(): SupabaseClient {
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!kunci) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diisi. Ambil di Project Settings, menu API.",
    );
  }
  return createClient(url_supabase(), kunci, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
