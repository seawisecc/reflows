-- =========================================================
-- Reflows | Membedakan balasan chat dari impor dokumen
--
-- Ada dua tempat di Reflows yang memanggil Claude, tapi selama ini cuma
-- satu yang dicatat: balasan chat. Impor dokumen dan halaman web memanggil
-- model, memakan token, dan menghasilkan tagihan, tapi tidak pernah masuk
-- jalan_ai sama sekali.
--
-- Akibatnya halaman Penggunaan mengaku menampilkan biaya AI padahal cuma
-- sebagian. Ketahuan waktu angkanya dibandingkan dengan Claude Console:
-- selisihnya persis sama dengan token satu impor halaman web.
--
-- Kolom jenis dipasang supaya keduanya bisa dicatat di tabel yang sama
-- tanpa tercampur. Bedanya penting: paket langganan menjanjikan jumlah
-- BALASAN, jadi kuota tidak boleh ikut menghitung impor. Tapi biaya harus
-- menghitung dua-duanya, karena dua-duanya ditagih Anthropic.
-- =========================================================

create type jenis_jalan_ai as enum ('balasan', 'impor');

alter table public.jalan_ai
  add column jenis jenis_jalan_ai not null default 'balasan';

create index jalan_ai_jenis_idx
  on public.jalan_ai (tenant_id, jenis, dibuat_at desc);

comment on column public.jalan_ai.jenis is
  'balasan untuk chat ke client, impor untuk pembacaan dokumen dan halaman web. Kuota paket hanya menghitung balasan, biaya menghitung keduanya.';

comment on column public.jalan_ai.alasan is
  'Untuk balasan: alasan eskalasi atau draf. Untuk impor: asal dokumennya, supaya kelihatan berkas mana yang mahal.';

-- ---------- Kuota hanya menghitung balasan ----------
-- Ini yang paling menentukan. Kalau impor ikut terhitung, tenant yang
-- merapikan materinya sekali kehilangan puluhan balasan dari kuotanya,
-- padahal paketnya tidak pernah menjanjikan jumlah impor.
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
    -- Hanya jenis balasan. Semua panggilan balasan tetap dihitung termasuk
    -- yang berakhir jadi draf maupun eskalasi, karena modelnya tetap
    -- dipanggil dan tetap dibayar.
    'terpakai', (
      select count(*) from public.jalan_ai a
       where a.tenant_id = b.tenant_id
         and a.jenis = 'balasan'
         and a.dibuat_at >= b.awal),
    'impor', (
      select count(*) from public.jalan_ai a
       where a.tenant_id = b.tenant_id
         and a.jenis = 'impor'
         and a.dibuat_at >= b.awal),
    -- Token menghitung dua-duanya, karena dua-duanya ditagih Anthropic.
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

-- ---------- Penggunaan dipecah per jenis ----------
create or replace function public.penggunaan_ai(
  p_hari integer default 30,
  p_zona text default 'Asia/Makassar'
)
returns jsonb
language sql
stable
as $$
  with batas as (
    select (date_trunc('day', now() at time zone p_zona)
            - make_interval(days => greatest(p_hari, 1) - 1)) at time zone p_zona as awal
  ),
  jalan as (
    select a.* from public.jalan_ai a, batas b where a.dibuat_at >= b.awal
  )
  select jsonb_build_object(
    'sejak', (select awal from batas),
    'panggilan', (select count(*) from jalan),
    'balasan', (select count(*) from jalan where jenis = 'balasan'),
    'impor', (select count(*) from jalan where jenis = 'impor'),
    'eskalasi', (select count(*) from jalan where dieskalasi),
    'keyakinan_rata', (
      select coalesce(round(avg(keyakinan), 2), 0) from jalan where keyakinan is not null),
    'latensi_tengah_ms', (
      select coalesce(
        percentile_cont(0.5) within group (order by latensi_ms)::int, 0)
      from jalan where latensi_ms is not null),
    'per_model', (
      select coalesce(jsonb_agg(x order by x.model), '[]'::jsonb) from (
        select model,
               count(*)::bigint                 as panggilan,
               sum(token_masuk)::bigint         as token_masuk,
               sum(token_keluar)::bigint        as token_keluar,
               sum(token_cache_baca)::bigint    as token_cache_baca,
               sum(token_cache_tulis)::bigint   as token_cache_tulis
          from jalan group by model
      ) x),
    -- Pecahan per jenis, supaya kelihatan berapa yang benar-benar dipakai
    -- membalas client dan berapa yang habis untuk merapikan materi.
    'per_jenis', (
      select coalesce(jsonb_agg(x order by x.jenis), '[]'::jsonb) from (
        select jenis::text                      as jenis,
               model,
               count(*)::bigint                 as panggilan,
               sum(token_masuk)::bigint         as token_masuk,
               sum(token_keluar)::bigint        as token_keluar,
               sum(token_cache_baca)::bigint    as token_cache_baca,
               sum(token_cache_tulis)::bigint   as token_cache_tulis
          from jalan group by jenis, model
      ) x),
    'per_hari', (
      select coalesce(jsonb_agg(x order by x.tanggal), '[]'::jsonb) from (
        select to_char(dibuat_at at time zone p_zona, 'YYYY-MM-DD') as tanggal,
               count(*)::bigint                 as panggilan,
               sum(token_masuk)::bigint         as token_masuk,
               sum(token_keluar)::bigint        as token_keluar,
               sum(token_cache_baca)::bigint    as token_cache_baca,
               sum(token_cache_tulis)::bigint   as token_cache_tulis
          from jalan group by 1
      ) x)
  )
$$;

-- ---------- Ringkasan platform ikut membedakan ----------
create or replace function public.ringkasan_platform()
returns jsonb
language sql
stable
as $$
  with bulan as (
    select t.id, t.nama, t.slug, t.paket, t.aktif, t.dibuat_at,
           g.zona_waktu, g.dijeda_at, g.batas_kelebihan, g.nomor_wa,
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
      -- Yang dibandingkan dengan kuota, jadi balasan saja.
      'balasan_ai', (
        select count(*) from public.jalan_ai a
         where a.tenant_id = b.id and a.jenis = 'balasan' and a.dibuat_at >= b.awal),
      'impor', (
        select count(*) from public.jalan_ai a
         where a.tenant_id = b.id and a.jenis = 'impor' and a.dibuat_at >= b.awal),
      -- Yang dibandingkan dengan tagihan, jadi dua-duanya.
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
      'terakhir_aktif', (
        select max(p.dibuat_at) from public.pesan p where p.tenant_id = b.id)
    ) as x
    from bulan b
  ) y
$$;
