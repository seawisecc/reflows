-- =========================================================
-- Reflows | Hak akses service_role
--
-- Ditemukan saat memeriksa database produksi, bukan saat uji lokal.
-- Migrasi dijalankan CLI sebagai role migrasi, bukan sebagai postgres,
-- jadi default privileges bawaan Supabase yang biasanya memberi hak ke
-- anon, authenticated, dan service_role tidak ikut berlaku. Akibatnya
-- service_role kehilangan akses ke seluruh tabel, dan jalur webhook
-- yang memakai kunci service role akan selalu gagal.
--
-- service_role memang melewati Row Level Security lewat sifat bypassrls,
-- tapi itu tidak menggantikan hak akses tabel. Dua hal yang berbeda.
-- =========================================================

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Penanda pesan masuk haknya sudah dicabut dari public, jadi service_role
-- perlu diberi izin secara terpisah.
grant execute on function public.tandai_pesan_masuk(uuid, timestamptz)
  to service_role;

-- Tabel yang dibuat migrasi berikutnya ikut terkena aturan yang sama,
-- supaya kesalahan ini tidak terulang setiap menambah tabel.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
