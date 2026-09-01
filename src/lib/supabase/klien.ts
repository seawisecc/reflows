import { createBrowserClient } from "@supabase/ssr";
import { kunci_publik_supabase, url_supabase } from "@/lib/lingkungan";

/** Klien Supabase untuk komponen yang jalan di browser. */
export function klien_browser() {
  return createBrowserClient(url_supabase(), kunci_publik_supabase());
}
