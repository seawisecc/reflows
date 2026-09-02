-- =========================================================
-- Reflows | Ringkasan lintas tenant untuk pemilik platform
--
-- security invoker, sama seperti fungsi ringkasan yang lain. Konsekuensinya
-- menyenangkan: pemakai biasa yang memanggilnya cuma melihat tenantnya
-- sendiri, super admin melihat semuanya, dan tidak ada satu baris kode pun
-- yang perlu memeriksa peran. Yang menyaring tetap RLS.
--
-- Kalau dibuat security definer, satu salah tulis di sini membocorkan
-- pendapatan dan pemakaian seluruh pelanggan ke tenant mana pun.
-- =========================================================

create or replace function public.ringkasan_platform()
returns jsonb
language sql
stable
as $$
  with bulan as (
    select t.id,
           t.nama,
           t.slug,
           t.paket,
           t.aktif,
           t.dibuat_at,
           g.zona_waktu,
           g.dijeda_at,
           g.batas_kelebihan,
           g.nomor_wa,
           g.perangkat_tersambung,
           (date_trunc('month', now() at time zone coalesce(g.zona_waktu, 'Asia/Makassar')))
             at time zone coalesce(g.zona_waktu, 'Asia/Makassar') as awal
      from public.tenants t
      left join public.pengaturan_tenant g on g.tenant_id = t.id
  )
  select coalesce(jsonb_agg(x order by x->>'nama'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', b.id,
      'nama', b.nama,
      'slug', b.slug,
      'paket', b.paket,
      'aktif', b.aktif,
      'dijeda_at', b.dijeda_at,
      'batas_kelebihan', b.batas_kelebihan,
      'nomor_wa', b.nomor_wa,
      'perangkat_tersambung', b.perangkat_tersambung,
      'dibuat_at', b.dibuat_at,
      'balasan_ai', (
        select count(*) from public.jalan_ai a
         where a.tenant_id = b.id and a.dibuat_at >= b.awal),
      'token_masuk', (
        select coalesce(sum(a.token_masuk + a.token_cache_baca + a.token_cache_tulis), 0)
          from public.jalan_ai a
         where a.tenant_id = b.id and a.dibuat_at >= b.awal),
      'token_keluar', (
        select coalesce(sum(a.token_keluar), 0) from public.jalan_ai a
         where a.tenant_id = b.id and a.dibuat_at >= b.awal),
      'kontak', (select count(*) from public.kontak k where k.tenant_id = b.id),
      'percakapan', (
        select count(*) from public.percakapan c where c.tenant_id = b.id),
      'butuh_manusia', (
        select count(*) from public.percakapan c
         where c.tenant_id = b.id and c.status = 'manual'),
      'pesan_bulan_ini', (
        select count(*) from public.pesan p
         where p.tenant_id = b.id and p.dibuat_at >= b.awal),
      -- Kapan terakhir ada tanda kehidupan. Tenant yang diam sebulan penuh
      -- biasanya bukan tenant yang puas, tapi tenant yang sudah berhenti
      -- memakai tanpa pernah bilang.
      'terakhir_aktif', (
        select max(p.dibuat_at) from public.pesan p where p.tenant_id = b.id)
    ) as x
    from bulan b
  ) y
$$;

comment on function public.ringkasan_platform() is
  'Rekap lintas tenant. Disaring RLS, jadi pemakai biasa hanya melihat tenantnya sendiri dan super admin melihat semuanya.';

grant execute on function public.ringkasan_platform() to authenticated;
revoke execute on function public.ringkasan_platform() from anon, public;
