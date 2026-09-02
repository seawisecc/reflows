/**
 * Menyalakan dan mematikan layanan sebuah tenant dari sisi Seawise.
 *
 * Ini saklar yang berbeda dari jeda milik tenant. Tenant menjeda sendiri
 * lewat halaman Pengaturan, dan bisa menyalakannya lagi kapan saja. Yang di
 * sini suspensi, dipakai kalau langganannya berhenti, dan tenant memang
 * tidak boleh bisa melepasnya sendiri.
 *
 * Berdiri sebagai skrip, bukan layar, karena antarmuka pemilik platform
 * baru digarap di Fase 5. Skrip ini juga sengaja tidak menghapus apa pun:
 * yang berubah cuma satu kolom boolean.
 *
 *   npm run tenant-aktif seawise           lihat keadaannya
 *   npm run tenant-aktif seawise off       suspensi
 *   npm run tenant-aktif seawise on        aktifkan lagi
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

type Isi = {
  slug: string;
  nama: string;
  aktif: boolean;
  dijeda_at: string | null;
  jumlah: { kontak: number; percakapan: number; pesan: number; materi: number };
};

async function keadaan(db: SupabaseClient, slug: string): Promise<Isi | null> {
  const { data: t } = await db
    .from("tenants")
    .select("id, nama, slug, aktif")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) return null;

  const id = t.id as string;
  const hitung = async (tabel: string) => {
    const { count } = await db
      .from(tabel)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", id);
    return count ?? 0;
  };

  const { data: p } = await db
    .from("pengaturan_tenant")
    .select("dijeda_at")
    .eq("tenant_id", id)
    .maybeSingle();

  return {
    slug: t.slug as string,
    nama: t.nama as string,
    aktif: t.aktif as boolean,
    dijeda_at: (p?.dijeda_at as string | null) ?? null,
    jumlah: {
      kontak: await hitung("kontak"),
      percakapan: await hitung("percakapan"),
      pesan: await hitung("pesan"),
      materi: await hitung("pengetahuan"),
    },
  };
}

function laporkan(i: Isi) {
  const jenis = !i.aktif ? "DISUSPENSI" : i.dijeda_at ? "DIJEDA SENDIRI" : "BERJALAN";
  console.log(`\n  ${i.nama} (${i.slug})`);
  console.log(`  Keadaan       ${jenis}`);
  if (i.dijeda_at) console.log(`  Dijeda sejak  ${i.dijeda_at}`);
  console.log(`  Kontak        ${i.jumlah.kontak}`);
  console.log(`  Percakapan    ${i.jumlah.percakapan}`);
  console.log(`  Pesan         ${i.jumlah.pesan}`);
  console.log(`  Materi admin  ${i.jumlah.materi}`);
  console.log("");
}

async function main() {
  const env = muat_env();
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [slug, perintah] = process.argv.slice(2);

  if (!slug) {
    const { data } = await db
      .from("tenants")
      .select("slug, nama, aktif")
      .order("nama");
    console.log("\nTenant yang ada:\n");
    for (const t of data ?? []) {
      console.log(
        `  ${String(t.slug).padEnd(20)} ${t.aktif ? "aktif" : "DISUSPENSI"}  ${t.nama}`,
      );
    }
    console.log("\nPakai: npm run tenant-aktif <slug> [on|off]\n");
    return;
  }

  const sebelum = await keadaan(db, slug);
  if (!sebelum) {
    console.error(`\nTenant dengan slug "${slug}" tidak ada.\n`);
    process.exit(1);
  }

  if (!perintah) {
    laporkan(sebelum);
    return;
  }

  if (perintah !== "on" && perintah !== "off") {
    console.error(`\nPerintah "${perintah}" tidak dikenal. Yang ada: on, off.\n`);
    process.exit(1);
  }

  const mau_aktif = perintah === "on";
  if (sebelum.aktif === mau_aktif) {
    console.log(
      `\n  ${sebelum.nama} memang sudah ${mau_aktif ? "aktif" : "disuspensi"}. Tidak ada yang diubah.`,
    );
    laporkan(sebelum);
    return;
  }

  const { error } = await db
    .from("tenants")
    .update({ aktif: mau_aktif })
    .eq("slug", slug);
  if (error) {
    console.error(`\nGagal mengubah: ${error.message}\n`);
    process.exit(1);
  }

  const sesudah = await keadaan(db, slug);
  console.log(
    `\n  ${mau_aktif ? "Diaktifkan" : "Disuspensi"}. Tidak ada satu baris pun yang dihapus.`,
  );
  laporkan(sesudah!);

  // Angka sesudah dibandingkan dengan sebelum, bukan cuma ditampilkan.
  // Suspensi yang diam-diam menghapus data adalah kegagalan paling mahal
  // yang bisa terjadi di skrip ini, dan harus ketahuan di sini juga.
  const berubah = (["kontak", "percakapan", "pesan", "materi"] as const).filter(
    (k) => sebelum.jumlah[k] !== sesudah!.jumlah[k],
  );
  if (berubah.length > 0) {
    console.error(
      `  PERINGATAN: jumlah ${berubah.join(", ")} berubah. Seharusnya tidak.\n`,
    );
    process.exit(1);
  }
  console.log("  Semua jumlah data sama persis seperti sebelum diubah.\n");
}

main().catch((e) => {
  console.error(`\nGagal:\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
