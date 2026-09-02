-- =========================================================
-- Reflows | Pengirim jenis kampanye
--
-- Berdiri sendiri sebagai satu migrasi, bukan digabung ke migrasi kampanye.
-- PostgreSQL menolak pemakaian nilai enum baru di transaksi yang sama
-- dengan penambahannya, dan badan fungsi SQL ikut diperiksa saat dibuat.
-- Menggabungkannya membuat migrasi gagal dengan galat 55P04.
--
-- Pesan kampanye bukan pesan AI dan bukan diketik manusia. Dibedakan supaya
-- di inbox kelihatan asalnya, dan supaya hitungan biaya AI tidak tercemar
-- pesan yang tidak pernah menyentuh model.
-- =========================================================

alter type pengirim_pesan add value if not exists 'kampanye';
