-- =========================================================
-- Reflows | Materi jenis dokumen
--
-- Selama ini pembaca dokumen cuma menarik layanan, FAQ, dan catatan.
-- Sisanya dibuang. Padahal penawaran yang diunggah pemilik sering memuat
-- hal yang tidak berbentuk salah satu dari tiga itu: syarat pembayaran,
-- jumlah revisi, cakupan garansi, alur kerja. Semuanya ditanyakan client,
-- dan semuanya membuat AI menyerah karena tidak ada di materi.
--
-- Jenis "dokumen" menampung kutipan apa adanya dari sumbernya. Bukan
-- menyimpan PDF utuh: yang disimpan potongan yang sudah dipilih dan
-- diperiksa manusia, supaya instruksi tetap pendek dan cache tetap kena.
-- =========================================================

alter type tipe_pengetahuan add value if not exists 'dokumen';

comment on column public.pengetahuan.tipe is
  'layanan dan faq jadi sumber jawaban utama. gaya mengatur nada. catatan jadi pagar pembatas. dokumen menampung kutipan apa adanya dari materi yang diunggah.';
