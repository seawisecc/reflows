-- =========================================================
-- Reflows | Skema awal
-- Multi-tenant sejak baris pertama. Setiap tabel bisnis membawa
-- tenant_id dan dijaga Row Level Security, walaupun antarmuka
-- Fase 0 baru melayani satu tenant.
-- =========================================================

-- gen_random_uuid() sudah jadi bagian inti PostgreSQL sejak versi 13, jadi
-- pgcrypto tidak perlu dipasang.

-- ---------- Tipe enum ----------
create type peran_pengguna as enum ('pemilik', 'admin', 'staf');
create type mode_balas as enum ('hybrid', 'draf', 'otomatis');
create type status_percakapan as enum ('ai', 'manual', 'selesai');
create type arah_pesan as enum ('masuk', 'keluar');
create type pengirim_pesan as enum ('kontak', 'ai', 'manusia');
create type status_kirim as enum ('antre', 'terkirim', 'sampai', 'dibaca', 'gagal');
create type tipe_pengetahuan as enum ('layanan', 'faq', 'gaya', 'catatan');
create type sumber_kontak as enum ('chat-masuk', 'impor', 'manual', 'kampanye');
create type paket_langganan as enum ('basic', 'pro');

-- ---------- Pemicu waktu ubah ----------
create or replace function public.set_diubah_at()
returns trigger language plpgsql as $$
begin
  new.diubah_at = now();
  return new;
end;
$$;

-- ---------- Tenant ----------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  slug text not null unique,
  paket paket_langganan not null default 'basic',
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);

-- Profil pengguna. id-nya sama dengan auth.users supaya join murah.
create table public.pengguna (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nama text not null,
  email text not null,
  peran peran_pengguna not null default 'admin',
  -- Staf Seawise Studio yang boleh melihat lintas tenant. Sengaja kolom
  -- terpisah dari peran, karena peran berlaku di dalam satu tenant saja.
  super_admin boolean not null default false,
  dibuat_at timestamptz not null default now()
);

create index pengguna_tenant_idx on public.pengguna (tenant_id);

-- ---------- Fungsi bantu RLS ----------
-- SECURITY DEFINER supaya pembacaan tabel pengguna di dalam fungsi tidak
-- ikut kena RLS, kalau tidak kebijakan pengguna akan memanggil dirinya sendiri.
create or replace function public.tenant_saya()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.pengguna where id = auth.uid()
$$;

create or replace function public.saya_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select super_admin from public.pengguna where id = auth.uid()), false)
$$;

-- ---------- Pengaturan per tenant ----------
create table public.pengaturan_tenant (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  gateway text not null default 'mock',
  -- Token gateway disimpan sudah terenkripsi di sisi aplikasi. Kolom ini
  -- tidak pernah ikut terkirim ke browser.
  gateway_token_terenkripsi text,
  nomor_wa text,
  -- Fonnte tidak menandatangani webhooknya sama sekali, jadi keaslian
  -- permintaan tidak bisa dibuktikan dari isinya. Rahasia ini ditaruh di
  -- jalur URL webhook, dan hanya tenant pemiliknya yang tahu.
  rahasia_webhook text not null unique default (
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
  ),
  mode_balas mode_balas not null default 'hybrid',
  ambang_keyakinan numeric(3, 2) not null default 0.85
    check (ambang_keyakinan between 0.50 and 1.00),
  jam_mulai time not null default '08:00',
  jam_selesai time not null default '20:00',
  zona_waktu text not null default 'Asia/Makassar',
  pesan_di_luar_jam text,
  kuota_pesan_harian integer not null default 300 check (kuota_pesan_harian > 0),
  diubah_at timestamptz not null default now()
);

-- ---------- Knowledge base ----------
create table public.pengetahuan (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  tipe tipe_pengetahuan not null,
  judul text not null,
  isi text not null,
  harga bigint check (harga is null or harga >= 0),
  aktif boolean not null default true,
  urutan integer not null default 0,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now()
);

create index pengetahuan_tenant_idx on public.pengetahuan (tenant_id, tipe, urutan);

-- ---------- Kontak ----------
create table public.kontak (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  nomor_wa text not null,
  nama text,
  tag text[] not null default '{}',
  sumber sumber_kontak not null default 'chat-masuk',
  -- Diisi saat kontak membalas STOP atau BERHENTI. Tidak pernah dihapus,
  -- karena riwayat penolakan itu yang melindungi kita nanti.
  opt_out_at timestamptz,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  unique (tenant_id, nomor_wa)
);

create index kontak_tenant_idx on public.kontak (tenant_id);
create index kontak_tag_idx on public.kontak using gin (tag);

-- ---------- Percakapan ----------
create table public.percakapan (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kontak_id uuid not null references public.kontak (id) on delete cascade,
  status status_percakapan not null default 'ai',
  alasan_eskalasi text,
  belum_dibaca integer not null default 0 check (belum_dibaca >= 0),
  pesan_terakhir_at timestamptz not null default now(),
  -- Kapan terakhir kali pemberitahuan di luar jam kerja dikirim ke utas ini.
  -- Tanpa penanda ini, kontak yang mengirim lima pesan jam sebelas malam
  -- akan menerima lima kali pesan otomatis yang sama.
  luar_jam_dibalas_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (tenant_id, kontak_id)
);

create index percakapan_antrean_idx
  on public.percakapan (tenant_id, status, pesan_terakhir_at desc);

-- ---------- Pesan ----------
create table public.pesan (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  percakapan_id uuid not null references public.percakapan (id) on delete cascade,
  arah arah_pesan not null,
  pengirim pengirim_pesan not null,
  isi text not null,
  status_kirim status_kirim not null default 'antre',
  -- Id dari gateway. Dipakai mencocokkan laporan status dan mencegah
  -- webhook yang dikirim dua kali tersimpan dobel.
  wa_message_id text,
  dibuat_at timestamptz not null default now(),
  unique (tenant_id, wa_message_id)
);

create index pesan_utas_idx on public.pesan (percakapan_id, dibuat_at);

-- ---------- Penanda pesan masuk ----------
-- Menaikkan hitungan belum dibaca lewat satu pernyataan UPDATE, bukan baca
-- lalu tulis dari aplikasi. Dua webhook yang datang bersamaan akan saling
-- menimpa kalau hitungannya dibaca dulu ke aplikasi.
--
-- Sengaja BUKAN security definer. Fungsi ini cuma dipanggil jalur webhook
-- yang memakai service role, dan service role memang melewati RLS. Kalau
-- dibuat security definer, pengguna biasa bisa menaikkan hitungan percakapan
-- tenant lain hanya dengan menebak id-nya.
create or replace function public.tandai_pesan_masuk(
  p_percakapan_id uuid,
  p_waktu timestamptz
) returns void language sql as $$
  update public.percakapan
     set belum_dibaca = belum_dibaca + 1,
         pesan_terakhir_at = greatest(pesan_terakhir_at, p_waktu)
   where id = p_percakapan_id
$$;

-- ---------- Jejak pemanggilan AI ----------
create table public.jalan_ai (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pesan_id uuid references public.pesan (id) on delete set null,
  model text not null,
  token_masuk integer not null default 0,
  token_keluar integer not null default 0,
  token_cache_baca integer not null default 0,
  token_cache_tulis integer not null default 0,
  latensi_ms integer,
  keyakinan numeric(3, 2),
  dieskalasi boolean not null default false,
  alasan text,
  dibuat_at timestamptz not null default now()
);

create index jalan_ai_tenant_idx on public.jalan_ai (tenant_id, dibuat_at desc);

-- ---------- Audit ----------
create table public.log_audit (
  id bigserial primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pengguna_id uuid references public.pengguna (id) on delete set null,
  aksi text not null,
  target text,
  rincian jsonb,
  dibuat_at timestamptz not null default now()
);

create index log_audit_tenant_idx on public.log_audit (tenant_id, dibuat_at desc);

-- ---------- Pemicu diubah_at ----------
create trigger tenants_diubah before update on public.tenants
  for each row execute function public.set_diubah_at();
create trigger pengaturan_diubah before update on public.pengaturan_tenant
  for each row execute function public.set_diubah_at();
create trigger pengetahuan_diubah before update on public.pengetahuan
  for each row execute function public.set_diubah_at();
create trigger kontak_diubah before update on public.kontak
  for each row execute function public.set_diubah_at();

-- =========================================================
-- Row Level Security
-- Semua tabel ditolak secara bawaan, lalu dibuka per tenant.
-- =========================================================
alter table public.tenants            enable row level security;
alter table public.pengguna           enable row level security;
alter table public.pengaturan_tenant  enable row level security;
alter table public.pengetahuan        enable row level security;
alter table public.kontak             enable row level security;
alter table public.percakapan         enable row level security;
alter table public.pesan              enable row level security;
alter table public.jalan_ai           enable row level security;
alter table public.log_audit          enable row level security;

create policy tenants_baca on public.tenants for select to authenticated
  using (id = public.tenant_saya() or public.saya_super_admin());

create policy pengguna_baca on public.pengguna for select to authenticated
  using (tenant_id = public.tenant_saya() or public.saya_super_admin());

-- Tabel bisnis: satu kebijakan penuh per tabel, kunci selalu tenant_id.
do $$
declare t text;
begin
  foreach t in array array[
    'pengaturan_tenant', 'pengetahuan', 'kontak',
    'percakapan', 'pesan', 'jalan_ai', 'log_audit'
  ] loop
    execute format($f$
      create policy %1$s_akses on public.%1$s for all to authenticated
        using (tenant_id = public.tenant_saya() or public.saya_super_admin())
        with check (tenant_id = public.tenant_saya());
    $f$, t);
  end loop;
end $$;

-- =========================================================
-- Hak akses
-- Supabase memang memberi hak ke authenticated lewat default privileges,
-- tapi ditulis ulang di sini supaya skema ini tetap benar kalau dijalankan
-- di Postgres biasa, dan supaya terbaca siapa boleh apa.
-- =========================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon dipakai sebelum login. Tidak ada satu pun tabel yang boleh dilihatnya.
revoke all on all tables in schema public from anon;

-- Fungsi penanda pesan masuk hanya untuk jalur webhook, bukan untuk browser.
revoke execute on function public.tandai_pesan_masuk(uuid, timestamptz)
  from anon, authenticated, public;

-- Token gateway tidak boleh terbaca lewat API publik dalam bentuk apa pun.
-- Mencabut satu kolom saja tidak cukup: hak di tingkat tabel tetap menang,
-- jadi haknya dicabut penuh lalu diberikan lagi per kolom tanpa token.
revoke select, update on public.pengaturan_tenant from authenticated;
grant select (
  tenant_id, gateway, nomor_wa, mode_balas, ambang_keyakinan,
  jam_mulai, jam_selesai, zona_waktu, pesan_di_luar_jam,
  kuota_pesan_harian, diubah_at
) on public.pengaturan_tenant to authenticated;
grant update (
  gateway, nomor_wa, mode_balas, ambang_keyakinan,
  jam_mulai, jam_selesai, zona_waktu, pesan_di_luar_jam, kuota_pesan_harian
) on public.pengaturan_tenant to authenticated;
