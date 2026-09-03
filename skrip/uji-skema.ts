/**
 * Menjalankan migrasi terhadap PostgreSQL sungguhan lewat PGlite, lalu
 * menguji kebijakan RLS-nya. Tanpa ini, skema cuma teks yang belum pernah
 * dieksekusi, dan kesalahan baru ketahuan setelah menempel di Supabase.
 *
 * Yang ditiru: peran anon dan authenticated, skema auth, serta auth.uid()
 * yang membaca klaim JWT. Selebihnya Postgres asli.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRASI = readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort()
  .map((n) => `supabase/migrations/${n}`);

const PRASYARAT = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
`;

let gagal = 0;
let lulus = 0;

function periksa(nama: string, syarat: boolean, catatan = "") {
  if (syarat) {
    lulus++;
    console.log(`  lulus  ${nama}`);
  } else {
    gagal++;
    console.error(`  GAGAL  ${nama}${catatan ? ` | ${catatan}` : ""}`);
  }
}

async function tolak(db: PGlite, nama: string, sql: string, potongan: string) {
  try {
    await db.exec(sql);
    periksa(nama, false, "seharusnya ditolak, tapi berhasil");
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    periksa(nama, pesan.includes(potongan), `pesan tak terduga: ${pesan}`);
  }
}

async function main() {
  const db = await PGlite.create();


  console.log("\nMenyiapkan lingkungan tiruan Supabase");
  await db.exec(PRASYARAT);

  console.log("Menjalankan migrasi");
  for (const berkas of MIGRASI) {
    await db.exec(readFileSync(berkas, "utf8"));
  }
  periksa("semua migrasi berjalan tanpa galat", true);

  const tabel = await db.query<{ n: string }>(
    `select tablename as n from pg_tables where schemaname = 'public' order by 1`,
  );
  const namaTabel = tabel.rows.map((r) => r.n);
  // Disebut satu per satu, bukan dihitung. Hitungan yang cocok tidak
  // membuktikan tabel yang benar terbentuk, cuma membuktikan jumlahnya sama.
  const DIHARAPKAN = [
    "baris_invoice", "invoice", "jalan_ai", "kampanye", "kontak",
    "langkah_kampanye", "log_audit", "pengaturan_tenant", "pengetahuan",
    "pengguna", "percakapan", "pesan", "sasaran_kampanye",
    "tagihan_langganan", "tenants",
  ];
  const kurang = DIHARAPKAN.filter((t) => !namaTabel.includes(t));
  periksa(
    "semua tabel terbentuk",
    kurang.length === 0 && namaTabel.length === DIHARAPKAN.length,
    `kurang: ${kurang.join(", ") || "tidak ada"}, yang ada: ${namaTabel.join(", ")}`,
  );

  const tanpaRls = await db.query<{ n: string }>(
    `select c.relname as n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = false`,
  );
  periksa(
    "semua tabel menyalakan RLS",
    tanpaRls.rows.length === 0,
    `tanpa RLS: ${tanpaRls.rows.map((r) => r.n).join(", ")}`,
  );

  // ---- Data uji: dua tenant yang tidak boleh saling melihat ----
  console.log("\nMengisi dua tenant");
  await db.exec(`
    insert into auth.users (id) values
      ('11111111-1111-1111-1111-111111111111'),
      ('22222222-2222-2222-2222-222222222222'),
      ('33333333-3333-3333-3333-333333333333');

    insert into public.tenants (id, nama, slug) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'Seawise Studio', 'seawise'),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'Katering Sari Rasa', 'sari-rasa');

    insert into public.pengguna (id, tenant_id, nama, email, peran, super_admin) values
      ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'Agus', 'agus@seawise.test', 'pemilik', false),
      ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000002', 'Ratna', 'ratna@sarirasa.test', 'admin', false),
      ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001', 'Pengawas', 'ops@seawise.test', 'pemilik', true);

    insert into public.pengaturan_tenant (tenant_id, gateway_token_terenkripsi) values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'rahasia-seawise'),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'rahasia-sarirasa');

    insert into public.kontak (tenant_id, nomor_wa, nama) values
      ('aaaaaaaa-0000-0000-0000-000000000001', '628111000001', 'Kontak Seawise'),
      ('aaaaaaaa-0000-0000-0000-000000000001', '628111000002', 'Kontak Seawise 2'),
      ('bbbbbbbb-0000-0000-0000-000000000002', '628222000001', 'Kontak Sari Rasa');
  `);

  const jadiPengguna = async (id: string) => {
    await db.exec(`reset role;`);
    await db.exec(`select set_config('request.jwt.claim.sub', '${id}', false);`);
    await db.exec(`set role authenticated;`);
  };

  console.log("\nIsolasi antar tenant");
  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  const kontakAgus = await db.query<{ nomor_wa: string }>(
    `select nomor_wa from public.kontak order by nomor_wa`,
  );
  periksa(
    "Agus hanya melihat 2 kontak tenantnya",
    kontakAgus.rows.length === 2 &&
      kontakAgus.rows.every((r) => r.nomor_wa.startsWith("628111")),
    `terlihat: ${kontakAgus.rows.map((r) => r.nomor_wa).join(", ")}`,
  );

  await jadiPengguna("22222222-2222-2222-2222-222222222222");
  const kontakRatna = await db.query<{ nomor_wa: string }>(
    `select nomor_wa from public.kontak`,
  );
  periksa(
    "Ratna hanya melihat 1 kontak tenantnya",
    kontakRatna.rows.length === 1 &&
      kontakRatna.rows[0]?.nomor_wa === "628222000001",
    `terlihat: ${kontakRatna.rows.map((r) => r.nomor_wa).join(", ")}`,
  );

  console.log("\nMenulis lintas tenant");
  await jadiPengguna("22222222-2222-2222-2222-222222222222");
  await tolak(
    db,
    "Ratna tidak bisa menyisipkan kontak ke tenant Seawise",
    `insert into public.kontak (tenant_id, nomor_wa, nama)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '628111000009', 'Sisipan nakal')`,
    "row-level security",
  );

  const ubah = await db.query(
    `update public.kontak set nama = 'Diretas'
     where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id`,
  );
  periksa(
    "UPDATE lintas tenant tidak mengubah baris apa pun",
    ubah.rows.length === 0,
    `terubah: ${ubah.rows.length}`,
  );

  console.log("\nToken gateway");
  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  await tolak(
    db,
    "kolom token gateway tidak bisa dibaca authenticated",
    `select gateway_token_terenkripsi from public.pengaturan_tenant`,
    "permission denied",
  );
  await tolak(
    db,
    "kolom rahasia webhook tidak bisa dibaca authenticated",
    `select rahasia_webhook from public.pengaturan_tenant`,
    "permission denied",
  );
  const pengaturan = await db.query<{ gateway: string }>(
    `select gateway, mode_balas from public.pengaturan_tenant`,
  );
  periksa(
    "kolom pengaturan lain tetap bisa dibaca",
    pengaturan.rows.length === 1,
    `baris: ${pengaturan.rows.length}`,
  );

  console.log("\nFungsi penanda pesan masuk");
  await db.exec(`reset role;`);
  await db.exec(`
    insert into public.percakapan (id, tenant_id, kontak_id)
    select 'cccccccc-0000-0000-0000-000000000001', tenant_id, id
      from public.kontak where nomor_wa = '628111000001';
  `);
  await db.exec(`
    select public.tandai_pesan_masuk(
      'cccccccc-0000-0000-0000-000000000001', now()
    );
    select public.tandai_pesan_masuk(
      'cccccccc-0000-0000-0000-000000000001', now()
    );
  `);
  const hitung = await db.query<{ belum_dibaca: number }>(
    `select belum_dibaca from public.percakapan
      where id = 'cccccccc-0000-0000-0000-000000000001'`,
  );
  periksa(
    "dua kali penandaan menaikkan hitungan jadi 2",
    hitung.rows[0]?.belum_dibaca === 2,
    `nilai: ${hitung.rows[0]?.belum_dibaca}`,
  );

  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  await tolak(
    db,
    "pengguna biasa tidak boleh memanggil penanda pesan masuk",
    `select public.tandai_pesan_masuk('cccccccc-0000-0000-0000-000000000001', now())`,
    "permission denied",
  );

  console.log("\nRahasia webhook");
  await db.exec(`reset role;`);
  const rahasia = await db.query<{ rahasia_webhook: string }>(
    `select rahasia_webhook from public.pengaturan_tenant order by tenant_id`,
  );
  const daftar = rahasia.rows.map((r) => r.rahasia_webhook);
  periksa(
    "setiap tenant dapat rahasia webhook 64 karakter",
    daftar.length === 2 && daftar.every((r) => /^[0-9a-f]{64}$/.test(r)),
    `nilai: ${daftar.join(", ")}`,
  );
  periksa(
    "rahasia webhook antar tenant berbeda",
    new Set(daftar).size === daftar.length,
  );

  console.log("\nSuper admin");
  await jadiPengguna("33333333-3333-3333-3333-333333333333");
  const semua = await db.query(`select nomor_wa from public.kontak`);
  periksa(
    "super admin melihat kontak semua tenant",
    semua.rows.length === 3,
    `terlihat: ${semua.rows.length}`,
  );

  // ---- Angka dasbor dan pemakaian AI ----
  // Diisi timpang sengaja: Seawise 2 pesan masuk, Sari Rasa 5. Kalau fungsi
  // ringkasannya lupa disaring RLS, Agus akan melihat 7 dan uji ini merah.
  console.log("\nRingkasan dasbor dan penggunaan AI");
  await db.exec(`reset role;`);
  await db.exec(`
    insert into public.percakapan (id, tenant_id, kontak_id)
    select 'cccccccc-0000-0000-0000-000000000002', tenant_id, id
      from public.kontak where nomor_wa = '628222000001';

    insert into public.pesan (tenant_id, percakapan_id, arah, pengirim, isi, status_kirim, dibuat_at)
    values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'masuk', 'kontak', 'halo', 'sampai', now() - interval '120 seconds'),
      ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'keluar', 'ai', 'halo juga', 'terkirim', now() - interval '60 seconds'),
      ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'masuk', 'kontak', 'belum dibalas', 'sampai', now() - interval '10 seconds'),
      ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'keluar', 'ai', 'draf', 'antre', now());

    insert into public.pesan (tenant_id, percakapan_id, arah, pengirim, isi, status_kirim, dibuat_at)
    select 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002',
           'masuk', 'kontak', 'pesan ' || g, 'sampai', now() - interval '30 seconds'
      from generate_series(1, 5) g;

    insert into public.jalan_ai (tenant_id, model, token_masuk, token_keluar, latensi_ms, keyakinan)
    values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'claude-haiku-4-5', 1000, 200, 1200, 0.90),
      ('bbbbbbbb-0000-0000-0000-000000000002', 'claude-haiku-4-5', 9000, 900, 3000, 0.50);
  `);

  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  const ringkas = await db.query<{ r: Record<string, unknown> }>(
    `select public.ringkasan_dasbor() as r`,
  );
  const r = ringkas.rows[0]?.r as Record<string, number | unknown[]>;
  periksa(
    "ringkasan hanya menghitung pesan tenant sendiri",
    r?.pesan_masuk_hari_ini === 2,
    `pesan_masuk_hari_ini: ${r?.pesan_masuk_hari_ini}`,
  );
  periksa(
    "draf yang antre tidak dihitung sebagai dijawab AI",
    r?.dijawab_ai === 1 && r?.draf_menunggu === 1,
    `dijawab_ai: ${r?.dijawab_ai}, draf_menunggu: ${r?.draf_menunggu}`,
  );
  periksa(
    "waktu balas dihitung dari pesan masuk ke balasan berikutnya",
    r?.waktu_balas_rata_detik === 60 && r?.balasan_terhitung === 1,
    `rata: ${r?.waktu_balas_rata_detik}, terhitung: ${r?.balasan_terhitung}`,
  );
  periksa(
    "grafik aktivitas berisi tujuh hari",
    Array.isArray(r?.aktivitas) && (r.aktivitas as unknown[]).length === 7,
    `panjang: ${Array.isArray(r?.aktivitas) ? (r.aktivitas as unknown[]).length : "bukan larik"}`,
  );

  const pakai = await db.query<{ p: Record<string, unknown> }>(
    `select public.penggunaan_ai(30) as p`,
  );
  const per_model = (pakai.rows[0]?.p as { per_model?: { token_masuk: number }[] })
    ?.per_model;
  periksa(
    "penggunaan token hanya menjumlah tenant sendiri",
    per_model?.length === 1 && Number(per_model[0]?.token_masuk) === 1000,
    `hasil: ${JSON.stringify(per_model)}`,
  );

  // ---- Kuota tidak boleh ikut menghitung impor dokumen ----
  // Paket menjanjikan jumlah BALASAN. Kalau impor ikut terhitung, tenant
  // yang merapikan materinya sekali kehilangan puluhan balasan dari
  // kuotanya, padahal paketnya tidak pernah menjanjikan jumlah impor.
  await db.exec(`reset role;`);
  await db.exec(`
    insert into public.jalan_ai (tenant_id, jenis, model, token_masuk, token_keluar)
    values
      ('aaaaaaaa-0000-0000-0000-000000000001', 'impor', 'claude-haiku-4-5', 30000, 2000),
      ('aaaaaaaa-0000-0000-0000-000000000001', 'impor', 'claude-haiku-4-5', 12000, 900);
  `);

  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  const kuota = await db.query<{ k: Record<string, number> }>(
    `select public.kuota_bulan_ini() as k`,
  );
  const k = kuota.rows[0]?.k;
  periksa(
    "kuota cuma menghitung balasan, bukan impor",
    Number(k?.terpakai) === 1,
    `terpakai: ${k?.terpakai}, seharusnya 1 balasan saja`,
  );
  periksa(
    "impor tetap terhitung sendiri, tidak hilang dari pembukuan",
    Number(k?.impor) === 2,
    `impor: ${k?.impor}`,
  );
  periksa(
    "token menghitung dua-duanya, karena dua-duanya ditagih",
    Number(k?.token_masuk) === 43000 && Number(k?.token_keluar) === 3100,
    `masuk ${k?.token_masuk}, keluar ${k?.token_keluar}`,
  );

  const pakai_pecah = await db.query<{ p: Record<string, unknown> }>(
    `select public.penggunaan_ai(30) as p`,
  );
  const pp = pakai_pecah.rows[0]?.p as { balasan?: number; impor?: number };
  periksa(
    "halaman penggunaan memecah balasan dan impor",
    Number(pp?.balasan) === 1 && Number(pp?.impor) === 2,
    `balasan ${pp?.balasan}, impor ${pp?.impor}`,
  );

  // Dibersihkan supaya blok berikutnya tidak terpengaruh.
  await db.exec(`reset role;`);
  await db.exec(`delete from public.jalan_ai where jenis = 'impor';`);

  await jadiPengguna("22222222-2222-2222-2222-222222222222");
  const ringkasRatna = await db.query<{ r: Record<string, number> }>(
    `select public.ringkasan_dasbor() as r`,
  );
  periksa(
    "tenant lain melihat angkanya sendiri, bukan angka Seawise",
    ringkasRatna.rows[0]?.r?.pesan_masuk_hari_ini === 5,
    `nilai: ${ringkasRatna.rows[0]?.r?.pesan_masuk_hari_ini}`,
  );

  // ---- Saklar layanan ----
  // Dua saklar yang berbeda pemiliknya. Yang penting dibuktikan di sini:
  // tenant bisa menjeda dirinya sendiri, tapi TIDAK bisa melepas suspensi
  // yang dipasang Seawise. Kalau bisa, tenant yang berhenti bayar tinggal
  // menekan satu tombol untuk menyalakan lagi layanannya.
  console.log("\nSaklar layanan");
  await jadiPengguna("11111111-1111-1111-1111-111111111111");

  const jeda_sendiri = await db.query(
    `update public.pengaturan_tenant set dijeda_at = now(), alasan_jeda = 'libur'
      where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning tenant_id`,
  );
  periksa(
    "pemilik boleh menjeda layanannya sendiri",
    jeda_sendiri.rows.length === 1,
    `terubah: ${jeda_sendiri.rows.length}`,
  );

  await tolak(
    db,
    "pemilik tidak boleh mengubah kolom rahasia lewat jalur yang sama",
    `update public.pengaturan_tenant set gateway_token_terenkripsi = 'curang'
      where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'`,
    "permission denied",
  );

  const lepas_suspensi = await db.query(
    `update public.tenants set aktif = true
      where id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id`,
  );
  periksa(
    "tenant tidak bisa menyentuh saklar suspensi milik Seawise",
    lepas_suspensi.rows.length === 0,
    `terubah: ${lepas_suspensi.rows.length}`,
  );

  const jeda_tenant_lain = await db.query(
    `update public.pengaturan_tenant set dijeda_at = now()
      where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002' returning tenant_id`,
  );
  periksa(
    "tenant tidak bisa menjeda layanan tenant lain",
    jeda_tenant_lain.rows.length === 0,
    `terubah: ${jeda_tenant_lain.rows.length}`,
  );

  // Dikembalikan supaya uji sesudahnya tidak terpengaruh.
  await db.exec(`reset role;`);
  await db.exec(
    `update public.pengaturan_tenant set dijeda_at = null, alasan_jeda = null;`,
  );

  // ---- Penomoran invoice ----
  // Nomor yang kembar berarti dua client menerima tagihan dengan nomor sama,
  // dan pembukuan tenant langsung kacau. Diambil lewat UPDATE yang mengunci
  // barisnya, bukan max + 1, dan itu yang dibuktikan di sini.
  console.log("\nPenomoran invoice");
  await jadiPengguna("11111111-1111-1111-1111-111111111111");

  const nomor1 = await db.query<{ n: string }>(
    `select public.nomor_invoice_berikutnya() as n`,
  );
  const nomor2 = await db.query<{ n: string }>(
    `select public.nomor_invoice_berikutnya() as n`,
  );
  const tahun = new Date().getFullYear();
  periksa(
    "nomor pertama berbentuk INV/tahun/0001",
    nomor1.rows[0]?.n === `INV/${tahun}/0001`,
    `nilai: ${nomor1.rows[0]?.n}`,
  );
  periksa(
    "nomor kedua naik satu, tidak pernah kembar",
    nomor2.rows[0]?.n === `INV/${tahun}/0002`,
    `nilai: ${nomor2.rows[0]?.n}`,
  );

  // Parameter tenant cuma dipakai kalau tidak ada sesi. Pemakai yang login
  // tidak boleh bisa menghabiskan nomor tenant lain lewat parameter itu.
  const nomor_curang = await db.query<{ n: string }>(
    `select public.nomor_invoice_berikutnya(
       'bbbbbbbb-0000-0000-0000-000000000002'
     ) as n`,
  );
  periksa(
    "parameter tenant diabaikan selama ada sesi",
    nomor_curang.rows[0]?.n === `INV/${tahun}/0003`,
    `nilai: ${nomor_curang.rows[0]?.n}`,
  );

  // Dibaca tanpa peran, karena sebagai Agus barisnya memang disaring RLS
  // dan hasilnya kosong, bukan nol.
  await db.exec(`reset role;`);
  const urutan_ratna = await db.query<{ urutan_invoice: number }>(
    `select urutan_invoice from public.pengaturan_tenant
      where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002'`,
  );
  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  periksa(
    "penghitung tenant lain tidak tersentuh",
    Number(urutan_ratna.rows[0]?.urutan_invoice ?? -1) === 0,
    `nilai: ${urutan_ratna.rows[0]?.urutan_invoice}`,
  );

  await tolak(
    db,
    "pemakai tidak boleh menulis penghitung nomornya sendiri",
    `update public.pengaturan_tenant set urutan_invoice = 999
      where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'`,
    "permission denied",
  );

  // ---- Isolasi invoice ----
  console.log("\nIsolasi invoice");
  await db.exec(`reset role;`);
  await db.exec(`
    insert into public.invoice (
      tenant_id, kontak_id, nomor, penerbit_nama, klien_nama, klien_nomor_wa,
      jatuh_tempo_at, subtotal, total
    )
    select 'bbbbbbbb-0000-0000-0000-000000000002', id, 'INV/9999/0001',
           'Katering Sari Rasa', 'Klien Rahasia', '628222000001',
           current_date + 7, 1000000, 1000000
      from public.kontak where nomor_wa = '628222000001';
  `);

  await jadiPengguna("11111111-1111-1111-1111-111111111111");
  const invoice_bocor = await db.query(`select nomor from public.invoice`);
  periksa(
    "invoice tenant lain tidak terlihat",
    invoice_bocor.rows.length === 0,
    `terlihat: ${invoice_bocor.rows.length}`,
  );

  // Kontaknya sengaja milik Agus sendiri. Kalau memakai kontak Ratna,
  // SELECT-nya sudah disaring RLS lebih dulu dan tidak ada baris yang
  // disisipkan sama sekali, jadi ujinya lolos tanpa pernah menguji apa pun.
  await tolak(
    db,
    "tidak bisa menyisipkan invoice atas nama tenant lain",
    `insert into public.invoice (
       tenant_id, kontak_id, nomor, penerbit_nama, klien_nama, klien_nomor_wa,
       jatuh_tempo_at
     )
     select 'bbbbbbbb-0000-0000-0000-000000000002', id, 'INV/9999/0002',
            'Palsu', 'Palsu', '628111000001', current_date
       from public.kontak where nomor_wa = '628111000001'`,
    "row-level security",
  );

  // Invoice uji dibuang lagi sebelum blok berikutnya. Kolom kontak_id-nya
  // memakai on delete restrict, jadi kalau dibiarkan, penghapusan kontak di
  // uji super admin akan meledak dengan galat foreign key sebelum sempat
  // membuktikan apa pun soal RLS.
  await db.exec(`reset role;`);
  await db.exec(`delete from public.invoice where nomor = 'INV/9999/0001';`);

  // ---- Super admin baca saja ----
  // Sebelum diperketat, super admin bisa menghapus baris tenant mana pun
  // lewat sesi browser biasa. Untuk pekerjaan dukungan itu terlalu longgar:
  // satu salah klik menghapus seluruh riwayat percakapan pelanggan.
  console.log("\nSuper admin baca saja");
  await jadiPengguna("33333333-3333-3333-3333-333333333333");

  const baca_lintas = await db.query(`select nomor_wa from public.kontak`);
  periksa(
    "super admin tetap bisa membaca lintas tenant",
    baca_lintas.rows.length === 3,
    `terlihat: ${baca_lintas.rows.length}`,
  );

  const hapus_lintas = await db.query(
    `delete from public.kontak
      where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002' returning id`,
  );
  periksa(
    "super admin tidak bisa menghapus baris tenant lain",
    hapus_lintas.rows.length === 0,
    `terhapus: ${hapus_lintas.rows.length}`,
  );

  const ubah_lintas = await db.query(
    `update public.kontak set nama = 'Diubah super admin'
      where tenant_id = 'bbbbbbbb-0000-0000-0000-000000000002' returning id`,
  );
  periksa(
    "super admin tidak bisa mengubah baris tenant lain",
    ubah_lintas.rows.length === 0,
    `terubah: ${ubah_lintas.rows.length}`,
  );

  const hapus_sendiri = await db.query(
    `delete from public.kontak where nomor_wa = '628111000002' returning id`,
  );
  periksa(
    "super admin tetap bisa mengurus tenantnya sendiri",
    hapus_sendiri.rows.length === 1,
    `terhapus: ${hapus_sendiri.rows.length}`,
  );

  // Tagihan langganan. Yang ditagih tidak boleh bisa menerbitkan tagihan
  // untuk dirinya sendiri, mengubah angkanya, atau menyatakan dirinya
  // lunas. Tabelnya sengaja tanpa kebijakan tulis sama sekali.
  console.log("\nTagihan langganan");
  await db.exec(`reset role;`);
  await db.exec(`
    insert into public.tagihan_langganan
      (tenant_id, periode, paket, harga_pokok, kuota, terpakai, kelebihan,
       tarif_kelebihan, biaya_kelebihan, total)
    values
      ('aaaaaaaa-0000-0000-0000-000000000001', date '2026-08-01', 'mulai',
       349000, 750, 800, 50, 300, 15000, 364000),
      ('bbbbbbbb-0000-0000-0000-000000000002', date '2026-08-01', 'tumbuh',
       749000, 2500, 1000, 0, 250, 0, 749000);
  `);

  await jadiPengguna("11111111-1111-1111-1111-111111111111");

  const tagihan_sendiri = await db.query(
    `select total from public.tagihan_langganan`,
  );
  periksa(
    "tenant melihat tagihannya sendiri saja",
    tagihan_sendiri.rows.length === 1,
    `terlihat: ${tagihan_sendiri.rows.length}`,
  );

  let terbit_sendiri = "tidak ditolak";
  try {
    await db.query(
      `insert into public.tagihan_langganan
         (tenant_id, periode, paket, harga_pokok, kuota, terpakai, kelebihan,
          tarif_kelebihan, biaya_kelebihan, total)
       values ('aaaaaaaa-0000-0000-0000-000000000001', date '2026-07-01',
               'mulai', 0, 750, 0, 0, 300, 0, 0)`,
    );
  } catch (e) {
    terbit_sendiri = e instanceof Error ? e.message : String(e);
  }
  periksa(
    "tenant tidak bisa menerbitkan tagihan untuk dirinya sendiri",
    terbit_sendiri !== "tidak ditolak",
    terbit_sendiri,
  );

  let lunas_sendiri = "tidak ditolak";
  try {
    const ubah = await db.query(
      `update public.tagihan_langganan set status = 'lunas', dibayar_at = now()
        where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id`,
    );
    lunas_sendiri = ubah.rows.length === 0 ? "tidak ada baris terubah" : "tidak ditolak";
  } catch (e) {
    lunas_sendiri = e instanceof Error ? e.message : String(e);
  }
  periksa(
    "tenant tidak bisa menyatakan dirinya lunas",
    lunas_sendiri !== "tidak ditolak",
    lunas_sendiri,
  );

  let hapus_tagihan = "tidak ditolak";
  try {
    const hapus = await db.query(
      `delete from public.tagihan_langganan
        where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning id`,
    );
    hapus_tagihan = hapus.rows.length === 0 ? "tidak ada baris terhapus" : "tidak ditolak";
  } catch (e) {
    hapus_tagihan = e instanceof Error ? e.message : String(e);
  }
  periksa(
    "tenant tidak bisa menghapus tagihannya",
    hapus_tagihan !== "tidak ditolak",
    hapus_tagihan,
  );

  // Super admin boleh membaca lintas tenant, seperti tabel lain.
  await jadiPengguna("33333333-3333-3333-3333-333333333333");
  const tagihan_super = await db.query(
    `select total from public.tagihan_langganan`,
  );
  periksa(
    "super admin membaca tagihan semua tenant",
    tagihan_super.rows.length === 2,
    `terlihat: ${tagihan_super.rows.length}`,
  );

  // Periode wajib tanggal 1. Kalau tidak, unique per bulan tidak lagi
  // mencegah satu tenant ditagih dua kali untuk bulan yang sama.
  await db.exec(`reset role;`);
  let periode_tengah = "tidak ditolak";
  try {
    await db.query(
      `insert into public.tagihan_langganan
         (tenant_id, periode, paket, harga_pokok, kuota, terpakai, kelebihan,
          tarif_kelebihan, biaya_kelebihan, total)
       values ('aaaaaaaa-0000-0000-0000-000000000001', date '2026-09-15',
               'mulai', 349000, 750, 0, 0, 300, 0, 349000)`,
    );
  } catch (e) {
    periode_tengah = e instanceof Error ? e.message : String(e);
  }
  periksa(
    "periode tagihan wajib tanggal 1",
    periode_tengah !== "tidak ditolak",
    periode_tengah,
  );

  let dobel = "tidak ditolak";
  try {
    await db.query(
      `insert into public.tagihan_langganan
         (tenant_id, periode, paket, harga_pokok, kuota, terpakai, kelebihan,
          tarif_kelebihan, biaya_kelebihan, total)
       values ('aaaaaaaa-0000-0000-0000-000000000001', date '2026-08-01',
               'mulai', 349000, 750, 0, 0, 300, 0, 349000)`,
    );
  } catch (e) {
    dobel = e instanceof Error ? e.message : String(e);
  }
  periksa(
    "satu tenant tidak bisa ditagih dua kali untuk bulan yang sama",
    dobel !== "tidak ditolak",
    dobel,
  );

  console.log("\nHak service_role");
  await db.exec(`reset role;`);
  await db.exec(`set role service_role;`);
  let service_role_lolos = true;
  let tabel_gagal = "";
  for (const t of namaTabel) {
    try {
      await db.query(`select 1 from public.${t} limit 1`);
    } catch (e) {
      service_role_lolos = false;
      tabel_gagal = `${t}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
  }
  periksa(
    "service_role bisa membaca semua tabel",
    service_role_lolos,
    tabel_gagal,
  );

  let penanda_lolos = true;
  try {
    await db.query(
      `select public.tandai_pesan_masuk('cccccccc-0000-0000-0000-000000000001', now())`,
    );
  } catch {
    penanda_lolos = false;
  }
  periksa("service_role boleh memanggil penanda pesan masuk", penanda_lolos);

  console.log("\nTanpa sesi");
  await db.exec(`reset role;`);
  await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
  await db.exec(`set role authenticated;`);
  const kosong = await db.query(`select nomor_wa from public.kontak`);
  periksa(
    "tanpa pengguna login tidak ada baris yang bocor",
    kosong.rows.length === 0,
    `terlihat: ${kosong.rows.length}`,
  );

  await db.exec(`reset role;`);
  await db.close();

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nUji skema berhenti dengan galat:\n", e);
  process.exit(1);
});
