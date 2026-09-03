-- =========================================================
-- Reflows | Tagihan langganan, Seawise menagih tenant
--
-- Beda dengan tabel invoice yang sudah ada. Yang itu tenant menagih
-- clientnya, penomorannya milik tenant, dan tenant yang menerbitkan. Yang
-- ini Seawise menagih tenant, dan tenant tidak boleh menerbitkan maupun
-- mengubah apa pun di dalamnya.
--
-- Karena itu tabel ini sengaja TIDAK punya kebijakan RLS untuk insert,
-- update, maupun delete. Tenant cuma bisa membaca tagihannya sendiri.
-- Penulisan hanya lewat service role, yaitu skrip npm run tagihan. Alasan
-- yang sama dengan tabel tenants: pihak yang ditagih tidak boleh bisa
-- menyatakan dirinya lunas.
--
-- Semua angka dan cara bayarnya disalin saat diterbitkan, tidak menunjuk
-- ke tabel lain. Menaikkan harga paket bulan depan tidak boleh diam-diam
-- mengubah tagihan yang sudah dibayar bulan lalu, dan mengganti rekening
-- tidak boleh mengubah rekening yang tertulis di tagihan lama.
-- =========================================================

create table public.tagihan_langganan (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  -- Bulan yang ditagih, selalu tanggal 1. Dijaga check, bukan kesepakatan,
  -- karena satu baris bertanggal 15 membuat unique di bawah tidak lagi
  -- mencegah tagihan dobel untuk bulan yang sama.
  periode date not null check (periode = date_trunc('month', periode)::date),
  status status_invoice not null default 'terkirim',

  -- Salinan keadaan saat diterbitkan.
  paket paket_langganan not null,
  harga_pokok bigint not null check (harga_pokok >= 0),
  kuota integer not null check (kuota >= 0),
  terpakai integer not null check (terpakai >= 0),
  kelebihan integer not null check (kelebihan >= 0),
  tarif_kelebihan bigint not null check (tarif_kelebihan >= 0),
  biaya_kelebihan bigint not null check (biaya_kelebihan >= 0),
  total bigint not null check (total >= 0),

  -- Cara bayar ikut disalin. Sekarang transfer manual, jadi ini yang
  -- dibaca tenant saat mau membayar.
  bank_nama text,
  bank_rekening text,
  bank_atas_nama text,

  catatan text,
  dibayar_at timestamptz,
  dibuat_at timestamptz not null default now(),

  unique (tenant_id, periode)
);

create index tagihan_langganan_tenant_idx
  on public.tagihan_langganan (tenant_id, periode desc);

alter table public.tagihan_langganan enable row level security;

-- Membaca: tenantnya sendiri, atau super admin. Tidak ada kebijakan lain,
-- dan itu yang membuat tenant tidak bisa menagih atau melunasi dirinya.
create policy tagihan_langganan_baca on public.tagihan_langganan
  for select to authenticated
  using (tenant_id = public.tenant_saya() or public.saya_super_admin());

-- Hak tabelnya ikut dipersempit, bukan cuma kebijakannya. Kebijakan RLS
-- yang hilang di migrasi berikutnya tidak boleh langsung membuka penulisan.
grant select on public.tagihan_langganan to authenticated;
revoke insert, update, delete on public.tagihan_langganan from authenticated;

comment on table public.tagihan_langganan is
  'Tagihan Seawise ke tenant. Tenant hanya bisa membaca: tidak ada kebijakan RLS untuk menulis, dan haknya dicabut di tingkat tabel.';

-- ---------- Pemakaian satu bulan tertentu ----------
--
-- kuota_bulan_ini() hanya tahu bulan berjalan, sedangkan tagihan disusun
-- setelah bulannya lewat. Batas bulannya dihitung memakai zona waktu
-- tenant, sama dengan yang dipakai kuota_bulan_ini, supaya angka di
-- tagihan sama dengan angka yang dilihat tenant sepanjang bulan itu.
create or replace function public.pemakaian_bulan(
  p_tenant_id uuid,
  p_periode date
) returns jsonb
language sql
stable
as $$
  with atur as (
    select coalesce(g.zona_waktu, 'Asia/Makassar') as zona
      from public.pengaturan_tenant g
     where g.tenant_id = p_tenant_id
  ),
  zona as (
    select coalesce((select zona from atur), 'Asia/Makassar') as z
  ),
  batas as (
    select (date_trunc('month', p_periode::timestamp)) at time zone z as awal,
           (date_trunc('month', p_periode::timestamp) + interval '1 month')
             at time zone z as akhir
      from zona
  )
  select jsonb_build_object(
    'tenant_id', p_tenant_id,
    'periode', p_periode,
    'sejak', b.awal,
    'sampai', b.akhir,
    -- Kuota paket hanya menghitung balasan. Impor dokumen memanggil model
    -- dan berbiaya, tapi paket tidak pernah menjanjikan jumlah impor.
    'terpakai', (
      select count(*) from public.jalan_ai a
       where a.tenant_id = p_tenant_id
         and a.jenis = 'balasan'
         and a.dibuat_at >= b.awal
         and a.dibuat_at < b.akhir)
  )
  from batas b;
$$;

comment on function public.pemakaian_bulan(uuid, date) is
  'Balasan AI satu bulan kalender tertentu, memakai zona waktu tenant. Jalur service role saja, dipakai saat menyusun tagihan langganan.';

-- Jalur service role saja, seperti klaim_sasaran. Fungsinya menerima
-- tenant_id sebagai parameter, jadi tidak boleh bisa dipanggil dari sesi
-- browser mana pun.
revoke execute on function public.pemakaian_bulan(uuid, date) from anon, authenticated, public;
grant execute on function public.pemakaian_bulan(uuid, date) to service_role;
