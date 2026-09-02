-- =========================================================
-- Reflows | Angka dasbor dan penggunaan token
--
-- Dasbor sebelumnya menembak delapan query terpisah, dan setengah angkanya
-- masih data karangan. Delapan query berarti delapan perjalanan bolak-balik
-- ke Singapura. Fungsi di bawah menghitung semuanya di dalam database dan
-- mengembalikan satu jsonb, jadi satu perjalanan.
--
-- Sengaja security invoker, yaitu bawaan. Row Level Security tetap yang
-- menyaring tenant, sama seperti kalau tabelnya diquery langsung. Kalau
-- dibuat security definer, satu salah tulis di sini membocorkan angka
-- seluruh pelanggan.
-- =========================================================

-- ---------- Angka utama dasbor ----------
create or replace function public.ringkasan_dasbor(p_zona text default 'Asia/Makassar')
returns jsonb
language sql
stable
as $$
  with batas as (
    select
      (date_trunc('day', now() at time zone p_zona)) at time zone p_zona as awal_hari,
      (date_trunc('month', now() at time zone p_zona)) at time zone p_zona as awal_bulan,
      (date_trunc('day', now() at time zone p_zona) - interval '6 days')
        at time zone p_zona as awal_grafik
  ),
  -- Waktu balas dihitung dari pesan masuk ke pesan keluar berikutnya di utas
  -- yang sama. Pasangan yang tidak pernah dibalas tidak ikut dirata-rata,
  -- karena kalau ikut, angkanya jadi tentang lamanya menunggu, bukan
  -- kecepatan membalas.
  jeda as (
    select extract(epoch from (
      (select min(k.dibuat_at)
         from public.pesan k
        where k.percakapan_id = m.percakapan_id
          and k.arah = 'keluar'
          and k.status_kirim <> 'antre'
          and k.dibuat_at > m.dibuat_at)
      - m.dibuat_at
    )) as detik
    from public.pesan m, batas b
    where m.arah = 'masuk'
      and m.dibuat_at >= b.awal_hari - interval '7 days'
  ),
  harian as (
    select
      to_char(hari, 'YYYY-MM-DD') as tanggal,
      to_char(hari, 'Dy') as label,
      coalesce((
        select count(*) from public.pesan p
         where p.arah = 'masuk'
           and (p.dibuat_at at time zone p_zona)::date = hari
      ), 0) as masuk,
      coalesce((
        select count(*) from public.pesan p
         where p.arah = 'keluar' and p.pengirim = 'ai'
           and p.status_kirim <> 'antre'
           and (p.dibuat_at at time zone p_zona)::date = hari
      ), 0) as ai
    from batas b,
      generate_series(
        (b.awal_grafik at time zone p_zona)::date,
        (b.awal_hari at time zone p_zona)::date,
        interval '1 day'
      ) as hari
  )
  select jsonb_build_object(
    'pesan_masuk_hari_ini', (
      select count(*) from public.pesan p, batas b
       where p.arah = 'masuk' and p.dibuat_at >= b.awal_hari),
    'dijawab_ai', (
      select count(*) from public.pesan p, batas b
       where p.arah = 'keluar' and p.pengirim = 'ai'
         and p.status_kirim <> 'antre' and p.dibuat_at >= b.awal_hari),
    'pesan_keluar_hari_ini', (
      select count(*) from public.pesan p, batas b
       where p.arah = 'keluar' and p.status_kirim <> 'antre'
         and p.dibuat_at >= b.awal_hari),
    'butuh_kamu', (
      select count(*) from public.percakapan c where c.status = 'manual'),
    'draf_menunggu', (
      select count(*) from public.pesan p
       where p.arah = 'keluar' and p.status_kirim = 'antre'),
    'kontak_baru_minggu_ini', (
      select count(*) from public.kontak k
       where k.dibuat_at >= now() - interval '7 days'),
    'kontak_total', (select count(*) from public.kontak),
    'materi_aktif', (
      select count(*) from public.pengetahuan g
       where g.aktif and g.tipe in ('layanan', 'faq')),
    'waktu_balas_rata_detik', (
      select coalesce(round(avg(detik))::int, 0) from jeda where detik is not null),
    'balasan_terhitung', (select count(*) from jeda where detik is not null),
    'token_bulan_ini', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select a.model,
               sum(a.token_masuk)::bigint        as token_masuk,
               sum(a.token_keluar)::bigint       as token_keluar,
               sum(a.token_cache_baca)::bigint   as token_cache_baca,
               sum(a.token_cache_tulis)::bigint  as token_cache_tulis,
               count(*)::bigint                  as panggilan
          from public.jalan_ai a, batas b
         where a.dibuat_at >= b.awal_bulan
         group by a.model
      ) x),
    'aktivitas', (
      select coalesce(jsonb_agg(
        jsonb_build_object('tanggal', tanggal, 'label', label,
                           'masuk', masuk, 'ai', ai)
        order by tanggal), '[]'::jsonb)
      from harian)
  )
$$;

comment on function public.ringkasan_dasbor(text) is
  'Semua angka dasbor dalam satu panggilan. Disaring RLS seperti query biasa.';

-- ---------- Pemakaian AI, untuk halaman Penggunaan ----------
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

comment on function public.penggunaan_ai(integer, text) is
  'Rekap pemakaian token per model dan per hari. Biayanya dihitung di aplikasi, karena daftar harga model tinggal di sana.';

-- Kedua fungsi menyaring lewat RLS, jadi aman dipanggil dari browser.
grant execute on function public.ringkasan_dasbor(text) to authenticated;
grant execute on function public.penggunaan_ai(integer, text) to authenticated;

-- anon belum login dan tidak boleh melihat angka siapa pun.
revoke execute on function public.ringkasan_dasbor(text) from anon, public;
revoke execute on function public.penggunaan_ai(integer, text) from anon, public;
