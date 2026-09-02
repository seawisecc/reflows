-- =========================================================
-- Reflows | Fase 5, paket langganan dan kuota yang benar-benar dipaksakan
--
-- Kolom tenants.paket sudah ada sejak migrasi pertama dan belum dipakai
-- satu baris kode pun. Selama itu, angka kuota di brosur cuma janji: satu
-- tenant ramai bisa menghabiskan marjin sepuluh tenant lain tanpa ada yang
-- menghentikannya.
--
-- Definisi paketnya sendiri tinggal di kode, bukan di sini. Harga dan kuota
-- sebuah paket sama untuk semua tenant yang memakainya, dan menaruhnya di
-- database berarti suatu saat ada tenant yang paketnya diam-diam berbeda
-- dari yang tertulis di brosur.
-- =========================================================

alter type paket_langganan add value if not exists 'mulai';
alter type paket_langganan add value if not exists 'tumbuh';
alter type paket_langganan add value if not exists 'penuh';
