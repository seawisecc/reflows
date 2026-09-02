-- =========================================================
-- Reflows | Kuota bulanan dan penghitungnya
-- =========================================================

-- Nilai lama basic dan pro tidak pernah dipakai kode mana pun. Dipetakan ke
-- paket baru supaya tidak ada tenant yang tertinggal tanpa kuota.
update public.tenants set paket = 'mulai' where paket::text = 'basic';
update public.tenants set paket = 'tumbuh' where paket::text = 'pro';
alter table public.tenants alter column paket set default 'mulai';

comment on column public.tenants.paket is
  'Paket langganan. Kuota dan harganya didefinisikan di src/lib/paket.ts, bukan di database, karena itu definisi produk bukan data per pelanggan.';

-- Batas kelebihan dipegang tenant sendiri, seperti saklar jeda.
--
-- Kuota habis sengaja TIDAK langsung mematikan AI: client yang tidak dibalas
-- lebih merugikan tenant daripada tagihan kelebihan yang wajar. Yang
-- membatasi justru angka yang dipasang tenant di sini, supaya tidak ada yang
-- kaget di akhir bulan.
alter table public.pengaturan_tenant
  add column batas_kelebihan integer
    check (batas_kelebihan is null or batas_kelebihan >= 0);

comment on column public.pengaturan_tenant.batas_kelebihan is
  'Berapa balasan AI di atas kuota yang diizinkan tenant. null berarti tanpa batas, 0 berarti AI berhenti tepat saat kuota habis.';

grant select (batas_kelebihan) on public.pengaturan_tenant to authenticated;
grant update (batas_kelebihan) on public.pengaturan_tenant to authenticated;

-- ---------- Pemakaian bulan berjalan ----------
-- Dihitung dari jalan_ai, bukan dari tabel penghitung terpisah. Penghitung
-- yang disimpan sendiri bisa melenceng dari kenyataan begitu ada satu jalur
-- yang lupa menaikkannya, dan melencengnya baru ketahuan saat menagih.
create or replace function public.kuota_bulan_ini(
  p_tenant_id uuid default null,
  p_zona text default null
) returns jsonb
language sql
stable
as $$
  with sasaran as (
    select coalesce(public.tenant_saya(), p_tenant_id) as tenant_id
  ),
  atur as (
    select s.tenant_id,
           coalesce(p_zona, g.zona_waktu, 'Asia/Makassar') as zona,
           g.batas_kelebihan
      from sasaran s
      left join public.pengaturan_tenant g on g.tenant_id = s.tenant_id
  ),
  batas as (
    select tenant_id, batas_kelebihan,
           (date_trunc('month', now() at time zone zona)) at time zone zona as awal
      from atur
  )
  select jsonb_build_object(
    'tenant_id', b.tenant_id,
    'paket', (select t.paket from public.tenants t where t.id = b.tenant_id),
    'batas_kelebihan', b.batas_kelebihan,
    'sejak', b.awal,
    -- Semua panggilan AI dihitung, termasuk yang berakhir jadi draf maupun
    -- eskalasi. Modelnya tetap dipanggil dan tetap dibayar, jadi tetap
    -- memakan kuota.
    'terpakai', (
      select count(*) from public.jalan_ai a
       where a.tenant_id = b.tenant_id and a.dibuat_at >= b.awal),
    'token_masuk', (
      select coalesce(sum(a.token_masuk + a.token_cache_baca + a.token_cache_tulis), 0)
        from public.jalan_ai a
       where a.tenant_id = b.tenant_id and a.dibuat_at >= b.awal),
    'token_keluar', (
      select coalesce(sum(a.token_keluar), 0) from public.jalan_ai a
       where a.tenant_id = b.tenant_id and a.dibuat_at >= b.awal)
  )
  from batas b
$$;

comment on function public.kuota_bulan_ini(uuid, text) is
  'Pemakaian balasan AI bulan kalender berjalan. Tenantnya dari sesi, dan parameter cuma dipakai kalau sesinya tidak ada, yaitu jalur service role.';

grant execute on function public.kuota_bulan_ini(uuid, text) to authenticated;
revoke execute on function public.kuota_bulan_ini(uuid, text) from anon, public;
