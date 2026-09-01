/**
 * Memeriksa keadaan database Supabase yang sungguhan, bukan yang lokal.
 *
 * Pesan "Finished supabase db push" cuma berarti perintahnya selesai, bukan
 * berarti skemanya benar-benar terpasang seperti yang diharapkan. Skrip ini
 * menanyakannya langsung ke database.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function muat_env(berkas = ".env.local"): Record<string, string> {
  const isi: Record<string, string> = {};
  for (const baris of readFileSync(berkas, "utf8").split("\n")) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith("#")) continue;
    const pisah = bersih.indexOf("=");
    if (pisah === -1) continue;
    isi[bersih.slice(0, pisah)] = bersih.slice(pisah + 1).trim();
  }
  return isi;
}

/**
 * Membaca peran yang tertulis di dalam kunci Supabase.
 *
 * Kunci anon dan kunci service role bentuknya mirip dan panjangnya sama,
 * jadi gampang tertukar saat menyalin dari dasbor. Kalau tertukar, gejalanya
 * berupa deretan "permission denied" yang menyesatkan, seolah-olah skemanya
 * yang salah. Diperiksa di awal supaya salahnya kelihatan langsung.
 */
function peran_kunci(kunci: string): string | null {
  if (kunci.startsWith("sb_secret_")) return "service_role";
  if (kunci.startsWith("sb_publishable_")) return "anon";
  const bagian = kunci.split(".");
  if (bagian.length !== 3) return null;
  try {
    const isi = bagian[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const muatan = JSON.parse(
      Buffer.from(isi + "=".repeat((4 - (isi.length % 4)) % 4), "base64").toString(),
    );
    return typeof muatan.role === "string" ? muatan.role : null;
  } catch {
    return null;
  }
}

const TABEL = [
  "tenants",
  "pengguna",
  "pengaturan_tenant",
  "pengetahuan",
  "kontak",
  "percakapan",
  "pesan",
  "jalan_ai",
  "log_audit",
];

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
  const env = muat_env();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci_layanan = env.SUPABASE_SERVICE_ROLE_KEY;
  const kunci_publik = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !kunci_layanan || !kunci_publik) {
    console.error("Kunci Supabase belum lengkap di .env.local");
    process.exit(1);
  }

  console.log(`\nMemeriksa ${url}\n`);

  console.log("Kunci");
  const peran_layanan = peran_kunci(kunci_layanan);
  const peran_publik = peran_kunci(kunci_publik);
  periksa(
    "SUPABASE_SERVICE_ROLE_KEY memang kunci service role",
    peran_layanan === "service_role",
    `perannya terbaca ${peran_layanan ?? "tidak dikenali"}. Ambil di Project Settings, menu API Keys, baris service_role, lalu klik Reveal`,
  );
  periksa(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY memang kunci publik",
    peran_publik === "anon",
    `perannya terbaca ${peran_publik ?? "tidak dikenali"}`,
  );
  periksa(
    "dua kunci itu tidak sama",
    kunci_layanan !== kunci_publik,
    "keduanya persis sama, kemungkinan salah tempel",
  );

  if (peran_layanan !== "service_role") {
    console.error(
      "\nBerhenti di sini. Tanpa kunci service role yang benar, sisa pemeriksaan",
    );
    console.error("cuma akan menghasilkan permission denied yang menyesatkan.\n");
    console.log(`${lulus} lulus, ${gagal} gagal\n`);
    process.exit(1);
  }
  const layanan = createClient(url, kunci_layanan, {
    auth: { persistSession: false },
  });
  const publik = createClient(url, kunci_publik, {
    auth: { persistSession: false },
  });

  console.log("Tabel terpasang");
  for (const t of TABEL) {
    const { error } = await layanan.from(t).select("*").limit(1);
    periksa(`tabel ${t} ada`, !error, error?.message);
  }

  console.log("\nRow Level Security terhadap kunci publik");
  // Tanpa login, kebijakan RLS tidak boleh meloloskan satu baris pun.
  for (const t of ["tenants", "kontak", "percakapan", "pesan"]) {
    const { data, error } = await publik.from(t).select("*").limit(1);
    // Tertutup boleh lewat dua jalan: hak akses ditolak, atau kebijakan RLS
    // tidak meloloskan baris apa pun. Yang tidak boleh cuma satu, yaitu ada
    // baris yang terbaca tanpa login.
    periksa(
      `${t} tertutup untuk pengunjung yang belum login`,
      Boolean(error) || (data?.length ?? 0) === 0,
      `terbaca ${data?.length ?? 0} baris`,
    );
  }

  console.log("\nKolom rahasia");
  const { error: galat_token } = await publik
    .from("pengaturan_tenant")
    .select("gateway_token_terenkripsi")
    .limit(1);
  periksa(
    "token gateway tidak bisa diminta lewat kunci publik",
    Boolean(galat_token),
    "kolom seharusnya ditolak, bukan dikembalikan",
  );

  console.log("\nNilai bawaan rahasia webhook");
  const slug = `uji-${Date.now()}`;
  const { data: tenant, error: galat_tenant } = await layanan
    .from("tenants")
    .insert({ nama: "Tenant Uji Sementara", slug })
    .select("id")
    .single();

  if (galat_tenant || !tenant) {
    periksa("bisa menyisipkan tenant uji", false, galat_tenant?.message);
  } else {
    const { data: pengaturan } = await layanan
      .from("pengaturan_tenant")
      .insert({ tenant_id: tenant.id })
      .select("rahasia_webhook, mode_balas, jam_mulai, kuota_pesan_harian")
      .single();

    periksa(
      "rahasia webhook terisi otomatis 64 karakter heksadesimal",
      /^[0-9a-f]{64}$/.test(String(pengaturan?.rahasia_webhook)),
      `nilai: ${String(pengaturan?.rahasia_webhook).slice(0, 12)}...`,
    );
    periksa(
      "nilai bawaan pengaturan sesuai keputusan produk",
      pengaturan?.mode_balas === "hybrid" &&
        String(pengaturan?.jam_mulai).startsWith("08:00") &&
        pengaturan?.kuota_pesan_harian === 300,
      `mode=${pengaturan?.mode_balas} jam=${pengaturan?.jam_mulai} kuota=${pengaturan?.kuota_pesan_harian}`,
    );

    // Bersihkan lagi supaya database produksi tidak ketinggalan sampah uji.
    await layanan.from("tenants").delete().eq("id", tenant.id);
    const { data: sisa } = await layanan
      .from("tenants")
      .select("id")
      .eq("slug", slug);
    periksa("tenant uji terhapus lagi", (sisa?.length ?? 0) === 0);
  }

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nPemeriksaan berhenti dengan galat:\n", e);
  process.exit(1);
});
