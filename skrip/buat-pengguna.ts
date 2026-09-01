/**
 * Membuat akun masuk untuk satu tenant.
 *
 * Reflows tidak punya pendaftaran mandiri, karena setiap akun terikat ke
 * satu bisnis dan pemiliknyalah yang menentukan siapa boleh masuk.
 *
 * Pemakaian:
 *   npm run buat-pengguna -- email@bisnis.com "Nama Lengkap" [peran] [slug-tenant]
 *
 * peran: pemilik, admin, atau staf. Bawaannya admin.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

const PERAN_SAH = ["pemilik", "admin", "staf"] as const;

/** Sandi acak yang kuat, dipakai sekali lalu diganti sendiri pemiliknya. */
function sandi_acak(): string {
  return randomBytes(18).toString("base64url");
}

async function main() {
  muat_env();
  const [email, nama, peran_masuk = "admin", slug = "seawise"] = process.argv.slice(2);

  if (!email || !nama) {
    console.error(
      'Pemakaian: npm run buat-pengguna -- email@bisnis.com "Nama Lengkap" [peran] [slug-tenant]',
    );
    process.exit(1);
  }
  if (!(PERAN_SAH as readonly string[]).includes(peran_masuk)) {
    console.error(`Peran harus salah satu dari: ${PERAN_SAH.join(", ")}`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) {
    console.error("NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi.");
    process.exit(1);
  }
  const db = createClient(url, kunci, { auth: { persistSession: false } });

  const { data: tenant } = await db
    .from("tenants")
    .select("id, nama")
    .eq("slug", slug)
    .maybeSingle();

  if (!tenant) {
    console.error(`Tenant dengan slug "${slug}" belum ada. Jalankan dulu: npm run siapkan-tenant`);
    process.exit(1);
  }

  const { data: profil_ada } = await db
    .from("pengguna")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profil_ada) {
    console.log(`Pengguna ${email} sudah ada. Tidak ada yang diubah.`);
    console.log("Untuk mengganti sandinya, pakai menu Authentication di dasbor Supabase.");
    return;
  }

  const sandi = sandi_acak();
  const { data: akun, error: galat_akun } = await db.auth.admin.createUser({
    email,
    password: sandi,
    // Dikonfirmasi langsung, karena akunnya memang dibuatkan pemilik,
    // bukan hasil pendaftaran orang asing yang perlu diverifikasi.
    email_confirm: true,
  });

  if (galat_akun || !akun?.user) {
    console.error(`Gagal membuat akun: ${galat_akun?.message ?? "tanpa data"}`);
    process.exit(1);
  }

  const { error: galat_profil } = await db.from("pengguna").insert({
    id: akun.user.id,
    tenant_id: tenant.id,
    nama,
    email,
    peran: peran_masuk,
  });

  if (galat_profil) {
    // Akun auth sudah terbuat tapi profilnya gagal. Dibersihkan lagi supaya
    // tidak ada akun yang bisa masuk tapi tidak punya tenant.
    await db.auth.admin.deleteUser(akun.user.id);
    console.error(`Gagal membuat profil, akun dibatalkan: ${galat_profil.message}`);
    process.exit(1);
  }

  console.log(`\nAkun dibuat untuk ${tenant.nama}\n`);
  console.log(`  email   ${email}`);
  console.log(`  nama    ${nama}`);
  console.log(`  peran   ${peran_masuk}`);
  console.log(`  sandi   ${sandi}`);
  console.log(`\nSandi ini cuma ditampilkan sekali. Ganti setelah masuk pertama kali.\n`);
}

main().catch((e) => {
  console.error("\nGagal membuat pengguna:\n", e);
  process.exit(1);
});
