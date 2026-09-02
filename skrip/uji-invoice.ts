/**
 * Uji jalur invoice dari ujung ke ujung terhadap Supabase sungguhan.
 *
 * Uji unit sudah menutup aritmetikanya dengan fungsi murni. Yang belum
 * terbukti adalah perkara yang cuma muncul di jalur nyata: penomoran yang
 * mengunci baris, PDF yang benar-benar tersimpan di Storage, tautan
 * bertanda tangan yang benar-benar bisa diunduh, dan bucket yang memang
 * tertutup untuk kunci publik.
 *
 * Pengirimannya ke WhatsApp TIDAK diuji di sini. Mengirim berarti ada pesan
 * sungguhan keluar dari nomor bisnis tenant, dan itu keputusan pemiliknya,
 * bukan keputusan skrip uji.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";
import { susun_pdf_invoice } from "../src/lib/invoice/pdf";
import { hitung_invoice, jatuh_tempo } from "../src/lib/invoice/hitung";

const NOMOR_UJI = "9993000001";
const PENANDA = "UJI OTOMATIS, JANGAN DIPAKAI";
const BUCKET = "invoice";

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

async function bersihkan(db: SupabaseClient, tenant_id: string) {
  const { data: inv } = await db
    .from("invoice")
    .select("id, berkas_path")
    .eq("tenant_id", tenant_id)
    .eq("catatan", PENANDA);

  for (const i of inv ?? []) {
    if (i.berkas_path) await db.storage.from(BUCKET).remove([i.berkas_path as string]);
    await db.from("invoice").delete().eq("id", i.id as string);
  }

  await db.from("kontak").delete().eq("tenant_id", tenant_id).eq("nomor_wa", NOMOR_UJI);
}

async function main() {
  const env = muat_env();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) throw new Error("Supabase belum diisi di .env.local.");

  const db = createClient(url, kunci, { auth: { persistSession: false } });
  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("slug", "seawise")
    .single();
  const tenant_id = tenant!.id as string;

  console.log(`\nMenguji invoice terhadap ${url}\n`);
  await bersihkan(db, tenant_id);

  periksa(
    "nomor kontak uji memakai kode negara 999",
    NOMOR_UJI.startsWith("999"),
    `nomor: ${NOMOR_UJI}`,
  );

  const { data: kontak } = await db
    .from("kontak")
    .insert({
      tenant_id,
      nomor_wa: NOMOR_UJI,
      nama: "Klien Uji Invoice",
      sumber: "manual",
    })
    .select("id")
    .single();

  // ---- Penomoran ----
  console.log("\nPenomoran");
  const { data: nomor_a } = await db.rpc("nomor_invoice_berikutnya", {
    p_tenant_id: tenant_id,
  });
  const { data: nomor_b } = await db.rpc("nomor_invoice_berikutnya", {
    p_tenant_id: tenant_id,
  });
  periksa(
    "dua nomor berturut-turut tidak pernah sama",
    Boolean(nomor_a) && Boolean(nomor_b) && nomor_a !== nomor_b,
    `${nomor_a} dan ${nomor_b}`,
  );
  periksa(
    "bentuk nomornya INV/tahun/urut",
    /^INV\/\d{4}\/\d{4}$/.test(String(nomor_a)),
    `nilai: ${nomor_a}`,
  );

  // ---- Menyimpan invoice ----
  console.log("\nMenyimpan invoice");
  const baris = [
    { deskripsi: "Website Company Profile", jumlah: 1, harga_satuan: 4_500_000 },
    { deskripsi: "Halaman tambahan", jumlah: 3, harga_satuan: 350_000 },
  ];
  const h = hitung_invoice({ baris, diskon: 500_000, ppn_persen: 11 });
  const terbit = new Date().toISOString().slice(0, 10);

  const { data: inv, error: galat_inv } = await db
    .from("invoice")
    .insert({
      tenant_id,
      kontak_id: kontak!.id,
      nomor: nomor_b as string,
      penerbit_nama: "Seawise Studio",
      klien_nama: "Klien Uji Invoice",
      klien_nomor_wa: `+${NOMOR_UJI}`,
      terbit_at: terbit,
      jatuh_tempo_at: jatuh_tempo(terbit, 7),
      diskon: h.diskon,
      ppn_persen: h.ppn_persen,
      catatan: PENANDA,
      subtotal: h.subtotal,
      nilai_ppn: h.nilai_ppn,
      total: h.total,
    })
    .select("id")
    .single();
  periksa("invoice tersimpan", !galat_inv && Boolean(inv), galat_inv?.message ?? "");
  if (!inv) {
    console.error("\nTidak bisa lanjut tanpa invoice.\n");
    process.exit(1);
  }

  const { error: galat_baris } = await db.from("baris_invoice").insert(
    baris.map((b, i) => ({ tenant_id, invoice_id: inv.id, urutan: i, ...b })),
  );
  periksa("barisnya tersimpan", !galat_baris, galat_baris?.message ?? "");

  periksa(
    "total yang tersimpan cocok dengan hitungan",
    h.subtotal === 5_550_000 && h.nilai_ppn === 555_500 && h.total === 5_605_500,
    `subtotal ${h.subtotal}, ppn ${h.nilai_ppn}, total ${h.total}`,
  );

  // ---- PDF ----
  console.log("\nPDF");
  const pdf = await susun_pdf_invoice({
    nomor: nomor_b as string,
    terbit_at: terbit,
    jatuh_tempo_at: jatuh_tempo(terbit, 7),
    penerbit_nama: "Seawise Studio",
    penerbit_alamat: "Bali",
    penerbit_nomor_wa: "+62 812-3759-7759",
    klien_nama: "Klien Uji Invoice",
    klien_nomor_wa: `+${NOMOR_UJI}`,
    bank_nama: "BCA",
    bank_rekening: "7712345678",
    bank_atas_nama: "Agus Yulyastrawan",
    catatan: PENANDA,
    diskon: 500_000,
    ppn_persen: 11,
    baris,
  });
  periksa(
    "PDF terbentuk dan berkepala %PDF",
    pdf.length > 1000 && new TextDecoder().decode(pdf.slice(0, 5)) === "%PDF-",
    `ukuran ${pdf.length}`,
  );

  const path = `${tenant_id}/${inv.id}.pdf`;
  const { error: galat_unggah } = await db.storage
    .from(BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  periksa("PDF terunggah ke Storage", !galat_unggah, galat_unggah?.message ?? "");
  await db.from("invoice").update({ berkas_path: path }).eq("id", inv.id);

  const { data: tautan } = await db.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  periksa("tautan bertanda tangan terbuat", Boolean(tautan?.signedUrl));

  if (tautan?.signedUrl) {
    // Ini yang sebenarnya dibuktikan: gateway mengunduh sendiri dari alamat
    // ini, jadi kalau tidak bisa diunduh dari luar, invoicenya tidak pernah
    // sampai ke client walaupun semua langkah lain terlihat berhasil.
    const jawab = await fetch(tautan.signedUrl);
    const isi = new Uint8Array(await jawab.arrayBuffer());
    periksa(
      "PDF benar-benar bisa diunduh dari tautan itu",
      jawab.ok && isi.length === pdf.length,
      `status ${jawab.status}, ${isi.length} dari ${pdf.length} byte`,
    );
    periksa(
      "jenis isinya application/pdf",
      (jawab.headers.get("content-type") ?? "").includes("pdf"),
      `content-type: ${jawab.headers.get("content-type")}`,
    );
  }

  // ---- Bucket tertutup ----
  console.log("\nBucket tertutup");
  const publik = `${url}/storage/v1/object/public/${BUCKET}/${path}`;
  const jawab_publik = await fetch(publik);
  periksa(
    "PDF tidak bisa diambil lewat alamat publik",
    !jawab_publik.ok,
    `status ${jawab_publik.status}`,
  );

  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: bocor } = await anon.from("invoice").select("nomor");
  periksa(
    "invoice tertutup untuk kunci publik",
    (bocor?.length ?? 0) === 0,
    `terlihat ${bocor?.length ?? 0}`,
  );

  const { error: galat_anon } = await anon.storage.from(BUCKET).download(path);
  periksa("kunci publik tidak bisa mengunduh PDF", Boolean(galat_anon));

  // ---- Bersih-bersih ----
  console.log("\nMembersihkan data uji");
  await bersihkan(db, tenant_id);

  const { count: sisa } = await db
    .from("invoice")
    .select("id", { count: "exact", head: true })
    .eq("catatan", PENANDA);
  periksa("invoice uji terhapus lagi", sisa === 0, `sisa ${sisa}`);

  const { data: berkas } = await db.storage.from(BUCKET).list(tenant_id);
  periksa(
    "berkas PDF-nya ikut terhapus",
    !(berkas ?? []).some((b) => b.name === `${inv.id}.pdf`),
    `sisa berkas: ${(berkas ?? []).map((b) => b.name).join(", ") || "tidak ada"}`,
  );

  const { count: sisa_kontak } = await db
    .from("kontak")
    .select("id", { count: "exact", head: true })
    .eq("nomor_wa", NOMOR_UJI);
  periksa("kontak uji terhapus lagi", sisa_kontak === 0, `sisa ${sisa_kontak}`);

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`\nUji invoice berhenti dengan galat:\n${e}\n`);
  process.exit(1);
});
