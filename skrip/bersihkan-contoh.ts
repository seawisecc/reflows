/**
 * Menghapus kontak percobaan beserta percakapan dan pesannya.
 *
 * Nomor 62812345000x sengaja dipakai sebagai penanda data percobaan.
 * Kontak sungguhan tidak akan pernah memakai nomor berurutan seperti itu.
 */
import { createClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

const AWALAN_CONTOH = "62812345000";

async function main() {
  muat_env();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: kontak } = await db
    .from("kontak")
    .select("id, nama, nomor_wa")
    .like("nomor_wa", `${AWALAN_CONTOH}%`);

  if (!kontak?.length) {
    console.log("Tidak ada kontak percobaan yang perlu dihapus.");
    return;
  }

  for (const k of kontak) {
    // Percakapan dan pesan ikut terhapus lewat cascade di skema.
    await db.from("kontak").delete().eq("id", k.id);
    console.log(`  dihapus  ${k.nama} (+${k.nomor_wa})`);
  }
  console.log(`\n${kontak.length} kontak percobaan dihapus.\n`);
}

main().catch((e) => {
  console.error("\nGagal membersihkan:\n", e);
  process.exit(1);
});
