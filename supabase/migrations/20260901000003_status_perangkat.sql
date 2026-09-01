-- =========================================================
-- Reflows | Status perangkat WhatsApp
--
-- Sebelum ini, satu-satunya cara tahu nomor sudah tersambung atau belum
-- adalah menekan tombol di halaman Pengaturan. Tidak ada indikator yang
-- menetap, jadi pemilik tidak pernah tahu kalau nomornya diam-diam putus.
--
-- Status disimpan supaya bisa ditampilkan di mana saja tanpa memanggil
-- gateway setiap kali halaman dibuka.
-- =========================================================

alter table public.pengaturan_tenant
  add column perangkat_tersambung boolean,
  add column perangkat_nama text,
  add column perangkat_paket text,
  add column perangkat_kuota integer,
  add column perangkat_kedaluwarsa text,
  add column perangkat_diperiksa_at timestamptz;

-- Kolom baru ikut aturan yang sama: authenticated boleh membaca semuanya
-- kecuali token dan rahasia webhook, dan tidak boleh menulis status karena
-- status itu berasal dari gateway, bukan dari pengguna.
grant select (
  perangkat_tersambung, perangkat_nama, perangkat_paket,
  perangkat_kuota, perangkat_kedaluwarsa, perangkat_diperiksa_at
) on public.pengaturan_tenant to authenticated;

comment on column public.pengaturan_tenant.perangkat_tersambung is
  'Hasil pemeriksaan terakhir ke gateway. null berarti belum pernah diperiksa.';
comment on column public.pengaturan_tenant.nomor_wa is
  'Nomor pengirim. Diselaraskan otomatis dengan nomor yang benar-benar tersambung di gateway, supaya tidak pernah berbeda.';
