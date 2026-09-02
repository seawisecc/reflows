-- =========================================================
-- Reflows | Fase 3, mesin kampanye keluar
--
-- Setengah dari mesin ini isinya rem, bukan gas. Nomor WhatsApp yang
-- diblokir tidak bisa dibanding: percakapan client yang sedang berjalan
-- ikut mati, dan tidak ada tombol untuk mengembalikannya. Karena itu setiap
-- angka pembatas disimpan per kampanye dan bisa diperketat, tapi batas
-- bawahnya dijaga di tingkat skema supaya tidak bisa dimatikan dari layar.
-- =========================================================

create type status_kampanye as enum ('draf', 'jalan', 'jeda', 'selesai', 'dihentikan');

-- Perjalanan satu kontak di dalam satu kampanye.
--   antre    menunggu langkah berikutnya
--   selesai  semua langkah terkirim, tanpa balasan
--   berhenti kontak membalas, atau minta berhenti. Ini hasil yang bagus
--   gagal    gateway menolak dan sudah tidak akan dicoba lagi
create type status_sasaran as enum ('antre', 'selesai', 'berhenti', 'gagal');

-- ---------- Kampanye ----------
create table public.kampanye (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nama text not null,
  status status_kampanye not null default 'draf',
  -- Kosong berarti semua kontak. Kontak harus punya SEMUA tag di sini.
  saringan_tag text[] not null default '{}',

  -- Jeda antar pesan. Interval tetap adalah pola paling mudah dikenali
  -- sebagai robot, jadi yang disimpan rentang, bukan satu angka.
  jeda_min_detik integer not null default 40 check (jeda_min_detik >= 30),
  jeda_maks_detik integer not null default 120 check (jeda_maks_detik >= 60),

  -- Warm-up. Nomor baru yang langsung mengirim ratusan pesan adalah cara
  -- tercepat kena blokir, jadi batas hari pertama sengaja kecil.
  batas_harian_awal integer not null default 20
    check (batas_harian_awal between 1 and 100),
  batas_harian_maks integer not null default 150
    check (batas_harian_maks between 1 and 300),

  -- Rem otomatis. Rasio balasan yang anjlok berarti daftar kontaknya salah
  -- atau pesannya tidak nyambung, dan meneruskannya cuma mempercepat blokir.
  rem_min_terkirim integer not null default 30 check (rem_min_terkirim >= 10),
  rem_rasio_balas numeric(3, 2) not null default 0.05
    check (rem_rasio_balas between 0 and 1),
  rem_alasan text,

  mulai_at timestamptz,
  -- Diisi setiap selesai mengirim. Antrean tidak boleh menyentuh kampanye
  -- ini lagi sebelum waktu itu lewat.
  boleh_kirim_lagi_at timestamptz,

  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),

  check (jeda_maks_detik >= jeda_min_detik),
  check (batas_harian_maks >= batas_harian_awal)
);

create index kampanye_tenant_idx on public.kampanye (tenant_id, status);

create trigger kampanye_diubah before update on public.kampanye
  for each row execute function public.set_diubah_at();

-- ---------- Langkah sequence ----------
create table public.langkah_kampanye (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kampanye_id uuid not null references public.kampanye (id) on delete cascade,
  urutan integer not null check (urutan >= 0),
  -- Jarak dari langkah sebelumnya. Langkah pertama selalu 0.
  tunda_hari integer not null default 0 check (tunda_hari between 0 and 90),
  -- Beberapa tulisan untuk maksud yang sama. Yang dipakai dipilih dari
  -- sidik jari sasaran, jadi dua kontak jarang menerima teks identik tapi
  -- satu kontak selalu menerima varian yang sama kalau dikirim ulang.
  varian text[] not null check (cardinality(varian) between 1 and 10),
  dibuat_at timestamptz not null default now(),
  unique (kampanye_id, urutan)
);

create index langkah_kampanye_idx on public.langkah_kampanye (kampanye_id, urutan);

-- ---------- Sasaran ----------
create table public.sasaran_kampanye (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kampanye_id uuid not null references public.kampanye (id) on delete cascade,
  kontak_id uuid not null references public.kontak (id) on delete cascade,
  langkah_berikutnya integer not null default 0,
  jadwal_at timestamptz not null default now(),
  status status_sasaran not null default 'antre',
  terkirim integer not null default 0,
  dibalas_at timestamptz,
  alasan_berhenti text,
  dibuat_at timestamptz not null default now(),
  -- Satu kontak sekali saja per kampanye. Tanpa ini, impor ulang daftar
  -- kontak berarti orang yang sama menerima sequence dua kali.
  unique (kampanye_id, kontak_id)
);

create index sasaran_antrean_idx
  on public.sasaran_kampanye (kampanye_id, status, jadwal_at);
create index sasaran_kontak_idx
  on public.sasaran_kampanye (tenant_id, kontak_id, status);

-- ---------- Penanda asal pesan ----------
-- Tanpa kolom ini, pesan kampanye cuma bisa dikenali lewat kontaknya. Satu
-- kontak yang masuk dua kampanye lalu membuat pesannya terhitung di kedua
-- kampanye, dan batas harian salah satunya habis sebelum waktunya.
alter table public.pesan
  add column kampanye_id uuid references public.kampanye (id) on delete set null;

create index pesan_kampanye_idx on public.pesan (kampanye_id, dibuat_at)
  where kampanye_id is not null;

comment on column public.pesan.kampanye_id is
  'Diisi hanya untuk pesan yang keluar dari mesin kampanye. Null untuk balasan AI dan pesan yang diketik manusia.';

-- ---------- Mengambil satu sasaran dari antrean ----------
-- Antrean dijalankan cron per menit, dan satu putaran bisa saja belum
-- selesai saat putaran berikutnya mulai. Tanpa penguncian, kontak yang sama
-- bisa menerima pesan dua kali. FOR UPDATE SKIP LOCKED membuat putaran
-- kedua melewatinya alih-alih menunggu lalu mengirim ulang.
--
-- Sengaja BUKAN security definer, sama seperti tandai_pesan_masuk. Yang
-- memanggil cuma jalur cron yang memakai service role.
create or replace function public.klaim_sasaran(p_kampanye_id uuid)
returns table (
  sasaran_id uuid,
  kontak_id uuid,
  nomor_wa text,
  nama text,
  langkah_berikutnya integer,
  terkirim integer
)
language sql
as $$
  with terpilih as (
    select s.id
      from public.sasaran_kampanye s
      join public.kontak k on k.id = s.kontak_id
     where s.kampanye_id = p_kampanye_id
       and s.status = 'antre'
       and s.jadwal_at <= now()
       and k.opt_out_at is null
     order by s.jadwal_at
     limit 1
       for update of s skip locked
  )
  update public.sasaran_kampanye s
     set jadwal_at = now() + interval '5 minutes'
    from terpilih t, public.kontak k
   where s.id = t.id and k.id = s.kontak_id
  returning s.id, k.id, k.nomor_wa, k.nama, s.langkah_berikutnya, s.terkirim
$$;

comment on function public.klaim_sasaran(uuid) is
  'Mengunci satu sasaran dan menggeser jadwalnya lima menit ke depan. Kalau pengirimannya gagal di tengah jalan, sasaran itu kembali sendiri ke antrean, bukan hilang.';

-- ---------- Menghentikan sequence begitu kontak membalas ----------
-- Dipanggil dari jalur webhook. Kontak yang sudah membalas berarti
-- percakapannya sudah dimulai, dan meneruskan follow-up terjadwal setelah
-- itu membuat bisnisnya terlihat tidak membaca chat sendiri.
create or replace function public.hentikan_sasaran_kontak(
  p_tenant_id uuid,
  p_kontak_id uuid,
  p_alasan text
) returns integer language sql as $$
  with diubah as (
    update public.sasaran_kampanye
       set status = 'berhenti',
           dibalas_at = coalesce(dibalas_at, now()),
           alasan_berhenti = p_alasan
     where tenant_id = p_tenant_id
       and kontak_id = p_kontak_id
       and status = 'antre'
    returning 1
  )
  select coalesce(count(*), 0)::integer from diubah
$$;

-- ---------- Keadaan satu kampanye ----------
-- Fakta mentah untuk antrean dan untuk layar. Keputusan boleh kirim atau
-- tidak sengaja TIDAK dihitung di sini: aturannya ada di TypeScript supaya
-- bisa diuji tanpa database, dan supaya layar dan antrean memakai aturan
-- yang sama persis.
create or replace function public.keadaan_kampanye(
  p_kampanye_id uuid,
  p_zona text default 'Asia/Makassar'
) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'sasaran_total',   (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id),
    'antre',           (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id and status = 'antre'),
    'selesai',         (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id and status = 'selesai'),
    'berhenti',        (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id and status = 'berhenti'),
    'gagal',           (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id and status = 'gagal'),
    'dibalas',         (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id and dibalas_at is not null),
    -- Sasaran yang sudah menerima minimal satu pesan. Ini penyebut rasio
    -- balasan: sasaran yang belum pernah dikirimi tidak mungkin membalas,
    -- dan kalau ikut dihitung, rem otomatis akan menyala di awal terus.
    'tersentuh',       (select count(*) from public.sasaran_kampanye where kampanye_id = p_kampanye_id and terkirim > 0),
    'pesan_terkirim',  (select coalesce(sum(terkirim), 0) from public.sasaran_kampanye where kampanye_id = p_kampanye_id),
    -- Batas warm-up dihitung per kampanye, jadi penandanya kampanye_id,
    -- bukan kontaknya.
    'terkirim_hari_ini', (
      select count(*) from public.pesan p
       where p.kampanye_id = p_kampanye_id
         and p.status_kirim <> 'gagal'
         and p.dibuat_at >= (date_trunc('day', now() at time zone p_zona)) at time zone p_zona
    ),
    -- Kuota harian itu milik nomornya, bukan milik kampanye, jadi semua
    -- pesan keluar ikut dihitung termasuk balasan AI. Kampanye tidak boleh
    -- menghabiskannya sampai chat client tidak bisa dibalas.
    'kuota_terpakai_hari_ini', (
      select count(*) from public.pesan p
       where p.tenant_id = (select tenant_id from public.kampanye where id = p_kampanye_id)
         and p.arah = 'keluar'
         and p.status_kirim not in ('antre', 'gagal')
         and p.dibuat_at >= (date_trunc('day', now() at time zone p_zona)) at time zone p_zona
    ),
    'kuota_harian', (
      select coalesce(g.kuota_pesan_harian, 0)
        from public.pengaturan_tenant g
       where g.tenant_id = (select tenant_id from public.kampanye where id = p_kampanye_id)
    ),
    'hari_ke', (
      select case
        when k.mulai_at is null then 0
        else greatest(1, (
          ((now() at time zone p_zona)::date - (k.mulai_at at time zone p_zona)::date) + 1
        ))
      end
      from public.kampanye k where k.id = p_kampanye_id
    )
  )
$$;

-- ---------- RLS ----------
alter table public.kampanye          enable row level security;
alter table public.langkah_kampanye  enable row level security;
alter table public.sasaran_kampanye  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['kampanye', 'langkah_kampanye', 'sasaran_kampanye'] loop
    execute format($f$
      create policy %1$s_akses on public.%1$s for all to authenticated
        using (tenant_id = public.tenant_saya() or public.saya_super_admin())
        with check (tenant_id = public.tenant_saya());
    $f$, t);
  end loop;
end $$;

grant select, insert, update, delete
  on public.kampanye, public.langkah_kampanye, public.sasaran_kampanye
  to authenticated;

-- Antrean dan webhook itu jalur service role. Browser tidak boleh mengklaim
-- sasaran sendiri, karena klaim menggeser jadwal dan bisa dipakai melewati
-- seluruh pembatas kecepatan.
revoke execute on function public.klaim_sasaran(uuid) from anon, authenticated, public;
revoke execute on function public.hentikan_sasaran_kontak(uuid, uuid, text)
  from anon, authenticated, public;

grant execute on function public.keadaan_kampanye(uuid, text) to authenticated;
revoke execute on function public.keadaan_kampanye(uuid, text) from anon, public;
