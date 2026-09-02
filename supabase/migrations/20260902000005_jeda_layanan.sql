-- =========================================================
-- Reflows | Mematikan dan menyalakan layanan tanpa kehilangan apa pun
--
-- Dua saklar yang berbeda, dan bedanya penting:
--
--   pengaturan_tenant.dijeda_at   dipegang tenant sendiri
--   tenants.aktif                 dipegang Seawise
--
-- Tenant yang mau libur sebulan menjeda sendiri, lalu menyalakan lagi kapan
-- saja. Tenant yang berhenti bayar dimatikan Seawise, dan tidak boleh bisa
-- menyalakan dirinya sendiri. Kalau keduanya dijadikan satu kolom, salah
-- satu dari dua hal itu pasti salah.
--
-- Tidak ada satu baris pun yang dihapus saat dimatikan. Nomor WhatsApp,
-- token gateway, rahasia webhook, materi admin, kontak, dan riwayat
-- percakapan semuanya tetap di tempatnya. Menyalakan lagi berarti membalik
-- satu kolom, bukan menyiapkan ulang tenant dari nol.
-- =========================================================

alter table public.pengaturan_tenant
  add column dijeda_at timestamptz,
  add column alasan_jeda text;

comment on column public.pengaturan_tenant.dijeda_at is
  'Diisi saat pemilik menjeda otomasi sendiri. AI dan kampanye berhenti, kirim manual tetap boleh. Null berarti berjalan normal.';

comment on column public.tenants.aktif is
  'Saklar milik Seawise. false berarti layanan disuspensi dan semua pengiriman berhenti, termasuk yang diketik manusia. Tenant tidak bisa mengubahnya sendiri: tabel tenants tidak punya kebijakan RLS untuk update.';

-- Kolom baru ikut aturan yang sama dengan kolom pengaturan lain: boleh
-- dibaca dan diubah pemiliknya, karena ini memang saklarnya sendiri.
grant select (dijeda_at, alasan_jeda) on public.pengaturan_tenant to authenticated;
grant update (dijeda_at, alasan_jeda) on public.pengaturan_tenant to authenticated;
