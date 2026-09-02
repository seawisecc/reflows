-- =========================================================
-- Reflows | Fase 4, invoice
--
-- Angka invoice tidak boleh berubah setelah dikirim ke client. Karena itu
-- harga satuan dan deskripsi disalin ke baris invoice, tidak menunjuk ke
-- tabel pengetahuan. Kalau menunjuk, menaikkan harga layanan bulan depan
-- akan diam-diam mengubah invoice yang sudah dibayar bulan lalu.
--
-- Alasan yang sama untuk data bisnis dan data client: nama, alamat, dan
-- nomor rekening ikut disalin saat invoice diterbitkan. Invoice adalah
-- rekaman satu momen, bukan tampilan atas keadaan sekarang.
-- =========================================================

create type status_invoice as enum ('draf', 'terkirim', 'lunas', 'batal');

-- ---------- Identitas penerbit dan penomoran ----------
alter table public.pengaturan_tenant
  add column alamat_bisnis text,
  add column bank_nama text,
  add column bank_rekening text,
  add column bank_atas_nama text,
  add column catatan_invoice text,
  add column ppn_persen numeric(5, 2) not null default 0
    check (ppn_persen between 0 and 100),
  add column tempo_hari integer not null default 7
    check (tempo_hari between 0 and 365),
  -- Penomoran. Diputar ulang tiap ganti tahun, seperti kebiasaan di sini.
  add column tahun_invoice integer not null default 0,
  add column urutan_invoice integer not null default 0;

grant select (
  alamat_bisnis, bank_nama, bank_rekening, bank_atas_nama,
  catatan_invoice, ppn_persen, tempo_hari, tahun_invoice, urutan_invoice
) on public.pengaturan_tenant to authenticated;
grant update (
  alamat_bisnis, bank_nama, bank_rekening, bank_atas_nama,
  catatan_invoice, ppn_persen, tempo_hari
) on public.pengaturan_tenant to authenticated;

-- ---------- Invoice ----------
create table public.invoice (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kontak_id uuid not null references public.kontak (id) on delete restrict,
  nomor text not null,
  status status_invoice not null default 'draf',

  -- Salinan identitas saat diterbitkan. Sengaja tidak menunjuk ke tabel
  -- lain, supaya invoice lama tidak ikut berubah kalau datanya diperbarui.
  penerbit_nama text not null,
  penerbit_alamat text,
  penerbit_nomor_wa text,
  bank_nama text,
  bank_rekening text,
  bank_atas_nama text,
  klien_nama text not null,
  klien_nomor_wa text not null,

  terbit_at date not null default current_date,
  jatuh_tempo_at date not null,
  diskon bigint not null default 0 check (diskon >= 0),
  ppn_persen numeric(5, 2) not null default 0 check (ppn_persen between 0 and 100),
  catatan text,

  -- Total ikut disimpan, bukan selalu dihitung ulang dari barisnya. Yang
  -- tertulis di PDF yang sudah sampai ke client adalah angka ini, dan itu
  -- yang harus tetap cocok walaupun aturan pembulatan suatu saat diubah.
  subtotal bigint not null default 0,
  nilai_ppn bigint not null default 0,
  total bigint not null default 0,

  /** Jalur berkas di Supabase Storage. Null berarti PDF belum dibuat. */
  berkas_path text,
  dikirim_at timestamptz,
  lunas_at timestamptz,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),

  unique (tenant_id, nomor)
);

create index invoice_tenant_idx on public.invoice (tenant_id, status, terbit_at desc);
create index invoice_kontak_idx on public.invoice (kontak_id);

create trigger invoice_diubah before update on public.invoice
  for each row execute function public.set_diubah_at();

-- ---------- Baris invoice ----------
create table public.baris_invoice (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.invoice (id) on delete cascade,
  urutan integer not null check (urutan >= 0),
  deskripsi text not null,
  jumlah numeric(10, 2) not null check (jumlah > 0),
  harga_satuan bigint not null check (harga_satuan >= 0),
  dibuat_at timestamptz not null default now(),
  unique (invoice_id, urutan)
);

create index baris_invoice_idx on public.baris_invoice (invoice_id, urutan);

-- ---------- Penomoran ----------
-- Nomor diambil lewat UPDATE, bukan lewat max(nomor) + 1. UPDATE mengunci
-- barisnya, jadi dua invoice yang dibuat bersamaan tidak pernah mendapat
-- nomor yang sama. max + 1 akan memberi nomor kembar tanpa suara.
--
-- security definer supaya pemakai tidak perlu diberi hak menulis kolom
-- penghitungnya. Tenantnya diambil dari sesi, dan parameter cuma dipakai
-- kalau sesinya memang tidak ada, yaitu jalur service role. Pemakai yang
-- login tidak bisa menembak tenant lain lewat parameter itu.
create or replace function public.nomor_invoice_berikutnya(p_tenant_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(public.tenant_saya(), p_tenant_id);
  v_zona text;
  v_tahun integer;
  v_urut integer;
begin
  if v_tenant is null then
    raise exception 'Tidak ada tenant untuk penomoran invoice';
  end if;

  select zona_waktu into v_zona
    from public.pengaturan_tenant where tenant_id = v_tenant;
  v_tahun := extract(year from (now() at time zone coalesce(v_zona, 'Asia/Makassar')));

  update public.pengaturan_tenant
     set urutan_invoice = case
           when tahun_invoice = v_tahun then urutan_invoice + 1 else 1 end,
         tahun_invoice = v_tahun
   where tenant_id = v_tenant
  returning urutan_invoice into v_urut;

  if v_urut is null then
    raise exception 'Pengaturan tenant tidak ditemukan';
  end if;

  return 'INV/' || v_tahun::text || '/' || lpad(v_urut::text, 4, '0');
end;
$$;

comment on function public.nomor_invoice_berikutnya(uuid) is
  'Mengambil nomor invoice berikutnya sambil mengunci barisnya. Diputar ulang tiap ganti tahun.';

-- ---------- RLS ----------
alter table public.invoice        enable row level security;
alter table public.baris_invoice  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['invoice', 'baris_invoice'] loop
    execute format($f$
      create policy %1$s_akses on public.%1$s for all to authenticated
        using (tenant_id = public.tenant_saya() or public.saya_super_admin())
        with check (tenant_id = public.tenant_saya());
    $f$, t);
  end loop;
end $$;

grant select, insert, update, delete
  on public.invoice, public.baris_invoice to authenticated;

grant execute on function public.nomor_invoice_berikutnya(uuid) to authenticated;
revoke execute on function public.nomor_invoice_berikutnya(uuid) from anon, public;
