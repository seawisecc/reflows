/**
 * Memastikan sesi pengguna dan Row Level Security bekerja sama seperti yang
 * diharapkan, dengan akun sungguhan di Supabase sungguhan.
 *
 * Uji skema lokal sudah membuktikan kebijakannya benar di tingkat SQL.
 * Yang belum terbukti adalah apakah sesi dari Supabase Auth benar-benar
 * mengisi auth.uid() yang dipakai kebijakan itu.
 *
 * Pemakaian: npm run uji-auth -- email@bisnis.com "sandi"
 */
import { createClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

let lulus = 0;
let gagal = 0;

function periksa(nama: string, syarat: boolean, catatan = "") {
  if (syarat) {
    lulus++;
    console.log(`  lulus  ${nama}`);
  } else {
    gagal++;
    console.error(`  GAGAL  ${nama}${catatan ? ` | ${catatan}` : ""}`);
  }
}

async function main() {
  muat_env();
  const [email, sandi] = process.argv.slice(2);
  if (!email || !sandi) {
    console.error('Pemakaian: npm run uji-auth -- email@bisnis.com "sandi"');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publik = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const layanan = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  console.log(`\nMenguji sesi pengguna di ${url}\n`);

  const db = createClient(url, publik, { auth: { persistSession: false } });

  console.log("Masuk");
  const { data: sesi, error: galat_masuk } = await db.auth.signInWithPassword({
    email,
    password: sandi,
  });
  periksa("akun bisa masuk", !galat_masuk && Boolean(sesi.session), galat_masuk?.message);
  if (!sesi.session) {
    console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
    process.exit(1);
  }

  console.log("\nProfil dan tenant");
  const { data: profil } = await db
    .from("pengguna")
    .select("id, nama, email, peran, tenants:tenant_id ( nama, slug )")
    .eq("id", sesi.session.user.id)
    .maybeSingle();
  periksa("profil pengguna terbaca lewat RLS", Boolean(profil), "tidak ada baris");
  const tenant = profil?.tenants as unknown as { nama: string; slug: string } | null;
  periksa("profil terhubung ke tenant", tenant?.slug === "seawise", `slug ${tenant?.slug}`);

  console.log("\nApa yang boleh dilihat");
  const { data: tenants } = await db.from("tenants").select("slug");
  periksa(
    "hanya melihat tenant sendiri",
    tenants?.length === 1 && tenants[0]?.slug === "seawise",
    `terlihat ${tenants?.length} tenant`,
  );

  const { data: pengetahuan } = await db.from("pengetahuan").select("id, tipe");
  periksa(
    "materi admin terbaca",
    (pengetahuan?.length ?? 0) === 9,
    `terbaca ${pengetahuan?.length} butir`,
  );

  console.log("\nApa yang tidak boleh dilihat");
  const { error: galat_token } = await db
    .from("pengaturan_tenant")
    .select("gateway_token_terenkripsi")
    .limit(1);
  periksa("token gateway tetap tertutup walau sudah masuk", Boolean(galat_token));

  const { error: galat_rahasia } = await db
    .from("pengaturan_tenant")
    .select("rahasia_webhook")
    .limit(1);
  periksa("rahasia webhook tetap tertutup walau sudah masuk", Boolean(galat_rahasia));

  const { data: pengaturan } = await db
    .from("pengaturan_tenant")
    .select("mode_balas, jam_mulai, kuota_pesan_harian");
  periksa(
    "kolom pengaturan lain tetap terbaca",
    pengaturan?.length === 1 && pengaturan[0]?.mode_balas === "hybrid",
    JSON.stringify(pengaturan),
  );

  console.log("\nIsolasi terhadap tenant lain");
  const admin = createClient(url, layanan, { auth: { persistSession: false } });
  const slug_lain = `uji-tetangga-${Date.now()}`;
  const { data: tetangga } = await admin
    .from("tenants")
    .insert({ nama: "Tenant Tetangga", slug: slug_lain })
    .select("id")
    .single();
  await admin
    .from("kontak")
    .insert({ tenant_id: tetangga!.id, nomor_wa: "628555000999", nama: "Rahasia Tetangga" });

  const { data: kontak_terlihat } = await db.from("kontak").select("nomor_wa");
  periksa(
    "kontak tenant lain tidak ikut terlihat",
    !(kontak_terlihat ?? []).some((k) => k.nomor_wa === "628555000999"),
    `terlihat ${kontak_terlihat?.length} kontak`,
  );

  const { error: galat_sisip } = await db
    .from("kontak")
    .insert({ tenant_id: tetangga!.id, nomor_wa: "628555000111", nama: "Sisipan nakal" });
  periksa(
    "menulis ke tenant lain ditolak",
    Boolean(galat_sisip),
    "penyisipan seharusnya gagal",
  );

  await admin.from("tenants").delete().eq("id", tetangga!.id);
  await db.auth.signOut();

  console.log("\nSetelah keluar");
  const { data: setelah_keluar } = await db.from("tenants").select("slug");
  periksa(
    "tidak ada yang terbaca setelah keluar",
    (setelah_keluar?.length ?? 0) === 0,
    `terbaca ${setelah_keluar?.length}`,
  );

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nUji auth berhenti dengan galat:\n", e);
  process.exit(1);
});
