# Reflows | Keputusan produk

Catatan hasil diskusi awal. Isinya alasan di balik pilihan, bukan cara
memakai kodenya. Kalau salah satu keputusan diubah, ubah juga di sini.

## Apa itu Reflows

Platform otomasi admin WhatsApp untuk bisnis kecil. Dua mesin yang berbeda
di bawah satu atap:

1. **Inbound.** Membalas chat client yang masuk, memakai knowledge base
   milik bisnis itu sendiri, dan menyerah ke manusia saat di luar kemampuan.
2. **Outbound.** Mengirim follow-up bertahap ke daftar kontak untuk berburu
   client baru.

Dibangun untuk kebutuhan Seawise Studio dulu, lalu dijual sebagai langganan.

## Keputusan yang sudah diambil

| Topik | Keputusan | Alasan |
|---|---|---|
| Fokus rilis pertama | Inbound dulu | Risiko paling rendah, langsung dipakai internal, dan jadi tempat mendarat balasan kampanye nanti |
| Gateway | Fonnte | Bisa kirim ke kontak dingin, murah, dokumentasi Indonesia |
| Tema | Deep Reef default, Sunset Arcade lewat toggle | Dasbor dipelototi lama, dan warnanya nyambung ke brand Seawise |
| Tenancy | Skema multi-tenant, antarmuka single | Menambah tenant nanti tinggal insert baris, tanpa membongkar skema |
| Mode balas | Hybrid | AI kirim sendiri kalau yakin, ragu sedikit jadi draf. Tidak menjadikan pemilik tukang klik, tapi juga tidak melepas AI tanpa rem |
| Nomor uji | Nomor baru khusus Reflows | Kalau AI salah jawab, yang kena bukan client asli |
| Knowledge base | Form terstruktur | AI jadi punya satu sumber angka, dan modul invoice nanti bisa mengambil harga dari sini |

## Yang sengaja tidak dilakukan

- **Tidak mengejar kecepatan kirim.** Batas realistis 150 sampai 300 pesan
  per nomor per hari. Butuh lebih banyak berarti menambah nomor pengirim,
  bukan menaikkan kecepatan.
- **Tidak memakai WhatsApp Business API resmi di v1.** Outbound ke nomor
  yang belum pernah chat wajib memakai template yang disetujui Meta, dan
  template promosi ke kontak dingin biasanya ditolak. Itu mematikan use case
  berburu client.
- **Tidak memakai Vercel Cron untuk antrean outbound.** Di plan Hobby cron
  hanya jalan sekali sehari. Antrean akan memakai pg_cron di Supabase yang
  memanggil Edge Function, jadi tidak terikat plan Vercel dan tidak kena
  batas waktu eksekusi.

## Aturan eskalasi

AI berhenti bicara dan percakapan pindah ke antrean manusia kalau:

1. Kontak menanyakan harga atau layanan di luar knowledge base
2. Kontak minta bicara dengan orang
3. Keyakinan AI di bawah ambang batas, bawaannya 85 persen
4. Percakapan lebih dari 6 giliran tanpa kesimpulan
5. Terdeteksi kata sensitif: komplain, refund, batal, hukum, penipuan
6. Pesan masuk di luar jam aktif

Minimal satu aturan harus aktif. Kalau semua dimatikan, tidak ada jalan
keluar untuk percakapan yang di luar kemampuan AI.

## Anti-ban, untuk Fase 3

Setengah dari mesin outbound isinya justru rem, bukan gas:

- Naik bertahap dari 20 pesan sehari
- Jeda acak 40 sampai 120 detik antar pesan, bukan interval tetap
- Hanya kirim di jam aktif
- Variasi kalimat supaya tidak ada dua kontak menerima teks identik
- Sequence berhenti sendiri begitu kontak membalas
- STOP dan BERHENTI masuk daftar berhenti permanen
- Rem otomatis kalau rasio balasan anjlok

## Watermark Fonnte dan pengaruhnya ke harga jual

Paket Fonnte selain Master dan Ultra menempelkan tulisan "Sent via
fonnte.com" di setiap pesan keluar. Tulisan itu ditambahkan di server
Fonnte, jadi tidak bisa dihilangkan dari sisi Reflows.

Harga di halaman Fonnte saat diperiksa: Master Rp 175.000 dan Ultra
Rp 355.000 per bulan, keduanya kuota tanpa batas.

Ini menyentuh model bisnis, bukan cuma tampilan. Karena setiap tenant
memakai akun Fonnte-nya sendiri, biaya itu ditanggung tenant, bukan Seawise.
Yang perlu disampaikan saat menjual Reflows: paket gratis Fonnte cukup untuk
mencoba, tapi untuk dipakai ke client sungguhan mereka perlu naik paket,
kalau tidak setiap balasan ke client mereka membawa iklan gateway.

Peringatan ini muncul sendiri di halaman Pengaturan begitu paket perangkat
terbaca bukan Master atau Ultra.

## Login WhatsApp

Fonnte menyediakan endpoint `POST https://api.fonnte.com/qr` yang
mengembalikan QR sebagai PNG base64, dan menjawab "device already connect"
kalau nomornya sudah tersambung. Artinya pemindaian QR bisa dilakukan di
dalam Reflows, tenant tidak perlu membuka dasbor Fonnte sama sekali.

Yang tetap harus dilakukan tenant di Fonnte cuma sekali: mendaftar dan
menyalin token perangkatnya.

## Impor materi dari dokumen

Materi bisa diimpor dari PDF, halaman web, CSV, dan Excel. Dokumen dibaca
sekali oleh Claude, hasilnya ditinjau pemilik, lalu yang tersimpan cuma entri
terstruktur. Dokumen mentahnya tidak pernah jadi bahan balasan harian.

Alasannya tiga, dan semuanya soal uang atau akurasi:

1. Menyuapkan PDF dua puluh halaman ke setiap balasan itu dibayar berulang.
2. Model bisa salah membaca baris tabel harga. Sekali salah, angka itu
   diulang ke setiap calon client sesudahnya.
3. Awalan yang berubah-ubah merusak prompt caching.

Karena itu ekstraksi memakai model paling mampu, bukan yang paling murah:
jalannya cuma sekali per dokumen, sedangkan akibat salah bacanya menetap.

Harga yang tidak tertulis jelas di sumber dikembalikan sebagai kosong, bukan
ditebak, dan disebutkan di daftar keraguan supaya pemilik memeriksanya.

## Model AI

Haiku 4.5 dipakai sebagai bawaan, termasuk untuk membaca dokumen impor.
Diuji dengan daftar harga tujuh baris berformat Indonesia: Haiku dan Opus 5
sama-sama benar tujuh dari tujuh, dan sama-sama menandai harga yang cuma
tertulis "Hubungi kami" sebagai kosong. Bedanya Opus menarik lebih banyak
catatan konteks, dengan biaya tujuh kali lipat.

Perbedaan kemampuan antar model wajib diperhatikan, dan ini baru ketahuan
saat memanggil API sungguhan: Haiku 4.5 menolak `adaptive thinking` dan
menolak parameter `fallbacks`, dua-duanya dengan galat 400. Model keluarga
baru justru sebaliknya. Petanya ada di `src/lib/ai/model.ts`.

- Balasan rutin memakai `claude-haiku-4-5`, 1 dolar per juta token masuk dan
  5 dolar per juta token keluar.
- Naik ke `claude-sonnet-5` hanya saat keyakinan rendah atau percakapan sudah
  panjang, 2 dolar per juta token masuk dan 10 dolar per juta token keluar.
- Knowledge base per tenant dipakai sebagai awalan tetap dan disimpan di
  prompt cache, jadi bagian yang sama tidak dibayar penuh tiap balasan.
  Nilai `cache_read_input_tokens` di respons harus dipantau, kalau nol terus
  berarti ada yang membatalkan cache secara diam-diam.

## Ketajaman teks

Font pixel hanya tajam di ukuran kelipatan 8. Skalanya dikunci lewat kelas
`pixel-sm`, `pixel-lg`, dan `pixel-xl`, bukan angka lepas di komponen, supaya
tidak melenceng lagi saat halaman baru ditambah. Rinciannya di README.

Teks kecil non-pixel dinaikkan dari 10 dan 11 piksel ke 12 piksel, dan nama
kontak dipindah dari font pixel ke font badan supaya nama orang lebih mudah
dibaca.

## Warna grafik

Warna seri grafik sengaja dipisah dari warna aksen antarmuka, karena warna
yang enak dibaca sebagai teks terlalu terang untuk dipakai sebagai bidang
isi. Nilainya sudah lolos pemeriksaan buta warna dan kontras:

| Tema | Seri 1 | Seri 2 |
|---|---|---|
| Deep Reef | `#12a896` | `#5b8cff` |
| Sunset Arcade | `#e8551f` | `#7b2cbf` |

Identitas seri tidak pernah bergantung warna saja. Selalu ada legenda, label
angka langsung di atas batang, dan tombol untuk melihat versi tabelnya.

## Peta fase

| Fase | Isi | Status |
|---|---|---|
| 0 | Fondasi, skema, RLS, design system dua tema, kerangka dasbor | Selesai |
| 1 | Adapter gateway, webhook, autentikasi, inbox nyata, kirim manual | Selesai |
| 2 | Mesin AI, knowledge base, eskalasi | Selesai |
| 3 | Outbound: kontak, kampanye, sequence, anti-ban | Belum |
| 4 | Invoice PDF dan pengirimannya lewat WhatsApp | Belum |
| 5 | Dasbor pemilik, monitoring lintas tenant, billing | Belum |

## Tiga paket langganan dan hitungan marjinnya

Disusun dari biaya terukur, bukan perkiraan. Empat balasan pertama di
produksi menghabiskan 6.372 token masuk dan 533 token keluar, jadi $0,0090
seluruhnya, atau **$0,00226 per balasan, sekitar Rp 37**.

Semua hitungan paket memakai **Rp 80 per balasan**, yaitu dua kali lipat
angka terukur. Itu mengandaikan instruksi tetap 3.000 token, percakapan 800
token, balasan 200 token, dan prompt caching tidak pernah kena sama sekali.
Kalau nyatanya lebih murah, marjinnya lebih besar, bukan lebih kecil.

| Paket | Harga per bulan | Balasan AI | Kelebihan | Biaya AI penuh | Marjin |
|---|---|---|---|---|---|
| Mulai | Rp 349.000 | 750 | Rp 300 | Rp 60.000 | Rp 289.000 (83%) |
| Tumbuh | Rp 749.000 | 2.500 | Rp 250 | Rp 200.000 | Rp 549.000 (73%) |
| Penuh | Rp 1.490.000 | 8.000 | Rp 200 | Rp 640.000 | Rp 850.000 (57%) |

Biaya tetap Seawise adalah Supabase Pro dan Vercel Pro, sekitar Rp 742.500
sebulan. Tiga tenant paket Mulai sudah menutupnya. Tarif kelebihan kuota
yang paling murah, Rp 200, masih dua setengah kali biaya Rp 80, jadi tenant
boros tetap menambah untung.

Fonnte sengaja tetap atas nama tenant, seperti sekarang. Kalau Seawise yang
membelikan, Rp 175.000 per tenant langsung menggerus marjin, dan Seawise
ikut menanggung pekerjaan mengurus akun gateway orang lain.

### Empat cara paket ini bisa boncos

1. **Menaikkan model tanpa menaikkan harga.** Sonnet 5 dua kali lipat harga
   Haiku di kedua arah, jadi sekitar Rp 160 per balasan. Paket Penuh yang
   terpakai habis menyisakan marjin 14 persen. Sonnet harus jadi tambahan
   berbayar, jangan masuk paket bawaan.
2. **Materi admin yang terlalu gemuk.** Instruksi tetap ikut dikirim di
   setiap balasan. Materi 10.000 token tanpa cache membuat biaya naik jadi
   sekitar Rp 175 per balasan, dan marjin paket Penuh tinggal 6 persen.
3. **Kuota yang tidak dipaksakan mesin.** `tenants.paket` masih berisi basic
   dan pro, dan tidak dipakai satu baris kode pun. Belum ada penghitung
   balasan bulanan. Selama itu, angka kuota cuma janji di brosur.
4. **Waktu manusia.** Satu jam membantu tenant memasang nomor lebih mahal
   daripada seluruh biaya AI paket Mulai sebulan. Karena itu dukungan paket
   Mulai sengaja lewat email saja, dan pemasangan dibuat bisa dikerjakan
   sendiri lewat QR di halaman Pengaturan.

### Yang harus digarap sebelum paket ini dijual

Semuanya Fase 5: mengganti enum `paket_langganan`, penghitung balasan
bulanan beserta remnya, layar tagihan untuk tenant, dasbor pemilik platform,
dan akun administrasi platform yang terpisah dari akun harian.
