/**
 * Mengisi tenant Seawise Studio beserta materi adminnya.
 *
 * Aman dijalankan berulang: kalau tenantnya sudah ada, isinya diperbarui,
 * bukan dibuat dobel. Rahasia webhook tidak pernah dibuat ulang, karena
 * mengubahnya berarti URL webhook yang sudah dipasang di Fonnte jadi mati.
 */
import { createClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

const SLUG = "seawise";

const PENGETAHUAN = [
  { tipe: "layanan", judul: "Website Company Profile", harga: 4_500_000, urutan: 1,
    isi: "5 halaman, desain custom, responsif, domain dan hosting setahun. Pengerjaan 10 sampai 14 hari kerja." },
  { tipe: "layanan", judul: "Website Toko Online", harga: 9_500_000, urutan: 2,
    isi: "Katalog produk, keranjang, pembayaran Midtrans, ongkir otomatis. Pengerjaan 3 sampai 4 minggu." },
  { tipe: "layanan", judul: "Aplikasi ERP per modul", harga: 12_000_000, urutan: 3,
    isi: "Kasir, stok, keuangan, atau kepegawaian. Harga per modul, bisa dicicil per tahap." },
  { tipe: "layanan", judul: "Perawatan bulanan", harga: 500_000, urutan: 4,
    isi: "Backup mingguan, pembaruan keamanan, dan revisi konten ringan maksimal 4 kali sebulan." },
  { tipe: "faq", judul: "Berapa lama pengerjaannya?", harga: null, urutan: 1,
    isi: "Company profile 10 sampai 14 hari kerja. Toko online 3 sampai 4 minggu. ERP tergantung jumlah modul, dibahas saat rapat awal." },
  { tipe: "faq", judul: "Sistem pembayarannya bagaimana?", harga: null, urutan: 2,
    isi: "DP 50 persen di awal, sisanya saat serah terima. Untuk proyek di atas 20 juta bisa dibagi tiga termin." },
  { tipe: "faq", judul: "Apakah bisa revisi?", harga: null, urutan: 3,
    isi: "Bisa, 3 kali revisi desain gratis di tahap mockup. Revisi setelah pengembangan dimulai dihitung terpisah." },
  { tipe: "gaya", judul: "Gaya bahasa balasan", harga: null, urutan: 1,
    isi: "Santai tapi sopan, panggil calon client dengan Bapak atau Ibu. Jangan pakai istilah teknis tanpa penjelasan. Balasan maksimal 4 kalimat, selalu tutup dengan satu pertanyaan supaya percakapan jalan terus." },
  { tipe: "catatan", judul: "Yang tidak boleh dijanjikan AI", harga: null, urutan: 1,
    isi: "Jangan pernah memberi diskon, jangan menyebut tanggal serah terima yang pasti, dan jangan menerima proyek di luar daftar layanan. Semua itu eskalasi ke manusia." },
] as const;

async function main() {
  muat_env();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) {
    console.error("NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi.");
    process.exit(1);
  }
  const db = createClient(url, kunci, { auth: { persistSession: false } });

  const { data: ada } = await db
    .from("tenants")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();

  let tenant_id: string;
  if (ada) {
    tenant_id = ada.id as string;
    console.log(`Tenant ${SLUG} sudah ada, isinya diperbarui.`);
  } else {
    const { data, error } = await db
      .from("tenants")
      .insert({ nama: "Seawise Studio", slug: SLUG, paket: "pro" })
      .select("id")
      .single();
    if (error || !data) throw new Error(`Gagal membuat tenant: ${error?.message}`);
    tenant_id = data.id as string;
    console.log(`Tenant ${SLUG} dibuat.`);
  }

  const { data: pengaturan_ada } = await db
    .from("pengaturan_tenant")
    .select("tenant_id")
    .eq("tenant_id", tenant_id)
    .maybeSingle();

  const pengaturan = {
    tenant_id,
    gateway: "mock",
    mode_balas: "hybrid" as const,
    jam_mulai: "08:00",
    jam_selesai: "20:00",
    zona_waktu: "Asia/Makassar",
    pesan_di_luar_jam:
      "Terima kasih sudah menghubungi Seawise Studio. Saat ini di luar jam kerja kami. Pesan Bapak atau Ibu sudah kami catat dan akan dibalas besok pagi mulai pukul 08.00.",
  };

  if (pengaturan_ada) {
    // rahasia_webhook sengaja tidak disentuh. Menggantinya membuat URL
    // webhook yang sudah terpasang di gateway langsung mati.
    await db.from("pengaturan_tenant").update(pengaturan).eq("tenant_id", tenant_id);
  } else {
    await db.from("pengaturan_tenant").insert(pengaturan);
  }

  await db.from("pengetahuan").delete().eq("tenant_id", tenant_id);
  const { error: galat_pengetahuan } = await db
    .from("pengetahuan")
    .insert(PENGETAHUAN.map((p) => ({ ...p, tenant_id })));
  if (galat_pengetahuan) {
    throw new Error(`Gagal mengisi pengetahuan: ${galat_pengetahuan.message}`);
  }

  const { data: rahasia } = await db
    .from("pengaturan_tenant")
    .select("rahasia_webhook")
    .eq("tenant_id", tenant_id)
    .single();

  console.log(`\n  tenant_id      ${tenant_id}`);
  console.log(`  butir materi   ${PENGETAHUAN.length}`);
  console.log(`\nURL webhook untuk dipasang di dasbor Fonnte:`);
  console.log(`  https://<domain-kamu>/api/wa/masuk/${rahasia?.rahasia_webhook}`);
  console.log(`\nRahasia ini setara kunci. Jangan ditempel di tempat umum.\n`);
}

main().catch((e) => {
  console.error("\nGagal menyiapkan tenant:\n", e);
  process.exit(1);
});
