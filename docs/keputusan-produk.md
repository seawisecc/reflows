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
  hanya jalan sekali sehari. Antrean memakai pg_cron di Supabase, jadi tidak
  terikat plan Vercel dan tidak ikut mati kalau paketnya berubah.

  Rencana awalnya pg_cron memanggil Edge Function. Yang dipasang akhirnya
  pg_cron memanggil jalur Next.js biasa, `POST /api/kampanye/jalan`.
  Alasannya: aturan anti-ban, adapter gateway, dan normalisasi nomor sudah
  ditulis sekali di `src/lib`. Menyalinnya ke Deno berarti suatu saat dua
  salinan itu berbeda, dan yang berbeda adalah remnya.

  Jalur itu dijaga rahasia 64 karakter di header, dibandingkan dengan
  `timingSafeEqual`. Rahasianya disimpan di Supabase Vault, bukan tertulis
  di dalam definisi jadwal, karena isi `cron.job` bisa dibaca siapa pun yang
  punya akses baca ke database.

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
`pixel-sm`, `pixel-lg`, `pixel-xl`, dan `pixel-2xl`, bukan angka lepas di
komponen, supaya tidak melenceng lagi saat halaman baru ditambah. Rinciannya
di README.

`pixel-2xl` yang 32 piksel ditambahkan belakangan, khusus untuk judul utama
halaman depan. Di dalam aplikasi tidak ada teks sebesar itu, dan memakainya
di sana akan merusak kepadatan dasbor. Ukurannya tetap kelipatan 8, jadi
aturan ketajamannya tidak dilanggar.

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

## Halaman depan

Sampai halaman ini dibuat, `/` langsung dialihkan ke `/dasbor`, jadi tautan
yang dibagikan mendarat di formulir login. Produk yang dijual sebagai
langganan tidak bisa begitu.

Angka paket di halaman itu dibaca dari `PAKET` di `src/lib/paket.ts`, tabel
yang sama yang dipakai mesin untuk memaksakan kuota. Menulis ulang angkanya
di halaman jualan berarti suatu saat brosur menjanjikan 1.000 balasan
sementara mesin berhenti di 750, dan yang menanggung selisihnya pelanggan
yang sudah bayar. Uji `depan.test.ts` menjaga hubungan itu, termasuk
memastikan paket baru tidak diam-diam absen dari halaman.

Isinya sengaja memuat hal yang biasanya disembunyikan halaman jualan:

- Akun gateway atas nama tenant sendiri, dan paket gratis Fonnte menempelkan
  tulisan iklan di setiap pesan keluar.
- Belum ada pendaftaran mandiri, akun dibuatkan manual.
- Urutan keputusan mesinnya ditulis apa adanya, termasuk bahwa AI berhenti
  dan menyerahkan chat ke manusia dalam beberapa keadaan.

Ketiganya akan ketahuan di minggu pertama pemakaian. Menyembunyikannya cuma
memindahkan kekecewaan ke titik yang lebih mahal, yaitu setelah orang bayar.

Ajakan chatnya memakai `NEXT_PUBLIC_KONTAK_WA`. Kalau kosong, tombolnya
tidak muncul sama sekali dan ajakannya jatuh ke halaman masuk, karena
halaman jualan yang menampilkan nomor karangan lebih buruk daripada halaman
yang cuma menyuruh masuk.

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

## Anti-ban yang benar-benar dipasang di Fase 3

Angkanya, beserta alasannya. Semuanya fungsi murni di
`src/lib/kampanye/antiban.ts` dan dipakai dua tempat sekaligus: antrean yang
mengirim, dan layar yang menjelaskan kenapa kampanye sedang diam. Kalau
keduanya menghitung sendiri-sendiri, suatu saat layar bilang "mengirim"
sementara antreannya sudah berhenti berjam-jam.

| Rem | Angka | Kenapa begitu |
|---|---|---|
| Warm-up | 20 pesan hari pertama, naik 30 persen sehari, mentok 150 di hari kesembilan | Nomor baru yang langsung mengirim ratusan pesan adalah cara tercepat kena blokir |
| Jeda antar pesan | Acak 40 sampai 120 detik | Interval tetap adalah pola paling gampang dikenali sebagai robot |
| Variasi kalimat | Beberapa varian per langkah, dipilih dari sidik jari sasaran | Bukan diacak, supaya satu sasaran selalu menerima varian yang sama kalau pengirimannya diulang |
| Berhenti saat membalas | Langsung, lewat webhook | Meneruskan follow-up terjadwal setelah orangnya membalas membuat bisnisnya terlihat tidak membaca chat sendiri |
| Rem otomatis | Rasio balasan di bawah 5 persen setelah 30 kontak tersentuh | Rasio yang anjlok berarti daftarnya salah atau pesannya tidak nyambung, dan meneruskannya mempercepat blokir |
| Kuota nomor | Dibagi bersama balasan AI | Kampanye tidak boleh menghabiskan jatah sampai chat client tidak bisa dibalas |

Penyebut rasio balasan sengaja sasaran yang sudah tersentuh, bukan seluruh
daftar. Kalau seluruh daftar yang dipakai, rasionya nol di awal dan rem
menyala sebelum satu pesan pun sempat dibalas.

Satu putaran antrean mengirim paling banyak satu pesan per kampanye.
Terlihat lambat dan memang disengaja: yang menentukan kecepatan adalah jeda
acak, bukan seberapa rajin cron dipanggil. Mengirim berkelompok dalam satu
putaran menghasilkan letupan yang persis seperti robot.

Klaim sasaran memakai `for update skip locked` dan menggeser jadwalnya lima
menit ke depan. Dua hal sekaligus: putaran cron yang tumpang tindih tidak
mengirimi orang yang sama dua kali, dan pengiriman yang gagal di tengah
jalan kembali sendiri ke antrean alih-alih hilang.

### Yang membedakan berhenti dan minta berhenti

Keduanya menghentikan sequence, tapi dicatat dengan alasan berbeda. Kontak
yang membalas itu hasil bagus, percakapannya pindah ke inbox. Kontak yang
membalas STOP itu hasil buruk, dan dia tidak akan pernah masuk kampanye mana
pun lagi. Kalau alasannya disamakan, tidak ada cara menilai kampanye mana
yang berhasil dan mana yang mengganggu orang.

## Mematikan layanan tanpa kehilangan apa pun

Model langganan butuh cara berhenti sementara. Tenant yang mau libur sebulan
tidak boleh harus menyiapkan ulang nomor, materi, dan kontaknya dari nol
saat kembali, dan tenant yang berhenti bayar tidak boleh bisa menyalakan
dirinya sendiri.

Karena itu dua saklar, bukan satu:

| | Kolom | Dipegang | Yang ikut mati |
|---|---|---|---|
| Jeda | `pengaturan_tenant.dijeda_at` | Tenant sendiri, lewat halaman Pengaturan | Balasan AI dan kampanye |
| Suspensi | `tenants.aktif` | Seawise, lewat `npm run tenant-aktif` | Semuanya, termasuk kirim manual |

Kalau keduanya dijadikan satu kolom, salah satu dari dua kebutuhan itu pasti
salah: entah tenant tidak bisa menjeda sendiri, atau tenant yang disuspensi
bisa melepas suspensinya sendiri.

### Kenapa jeda tidak mematikan tombol kirim

Yang menjeda biasanya justru mau memegang chatnya sendiri dulu, misalnya
karena sedang promo dan jawabannya belum masuk materi. Mematikan tombol
kirimnya di situ malah memaksa dia pindah ke aplikasi WhatsApp biasa, dan
riwayat percakapannya jadi terbelah dua tempat. Suspensi beda perkara: di
situ layanannya memang berhenti, jadi tidak ada satu pun pesan yang boleh
keluar lewat Reflows.

### Dua hal yang tidak pernah ikut mati

1. **Pesan masuk tetap dicatat.** Layanan yang mati boleh berhenti membalas,
   tapi tidak boleh membuang chat client. Kalau dibuang, menyalakan lagi
   berarti pemiliknya kehilangan semua yang masuk selama mati, justru saat
   dia paling perlu tahu apa yang terlewat.
2. **Permintaan berhenti tetap dihormati.** Orang yang membalas STOP saat
   layanan sedang dijeda tetap masuk daftar berhenti. Kalau tidak, dia akan
   dikirimi kampanye lagi begitu layanannya dinyalakan.

### Yang tetap utuh saat dimatikan

Nomor WhatsApp dan token gatewaynya, rahasia dan URL webhook, materi admin
beserta harganya, semua kontak dan tagnya, daftar berhenti, riwayat
percakapan, draf yang belum disetujui, dan kampanye beserta antrean
sasarannya. Menyalakan lagi berarti mengosongkan satu kolom, bukan
menyiapkan ulang tenant.

Skrip `npm run tenant-aktif` membandingkan jumlah kontak, percakapan, pesan,
dan materi sebelum dan sesudah, lalu berhenti dengan galat kalau ada yang
berubah. Suspensi yang diam-diam menghapus data adalah kegagalan paling
mahal yang bisa terjadi di sana.

## Invoice

### Angka disalin, tidak menunjuk

Deskripsi, harga satuan, nama bisnis, alamat, dan nomor rekening semuanya
disalin ke baris invoice saat diterbitkan. Tidak ada satu pun yang menunjuk
ke tabel `pengetahuan` maupun `pengaturan_tenant`.

Kalau menunjuk, menaikkan harga layanan bulan depan akan diam-diam mengubah
invoice yang sudah dibayar bulan lalu, dan tidak ada cara membuktikan berapa
yang sebenarnya ditagih. Invoice adalah rekaman satu momen, bukan tampilan
atas keadaan sekarang.

Konsekuensinya, memperbaiki nomor rekening di Pengaturan tidak memperbaiki
invoice yang sudah terbit. Untuk itu ada tombol Terbitkan ulang PDF, dan
tombol itu memang harus ditekan sadar.

### Penomoran

`INV/tahun/urut`, diputar ulang tiap ganti tahun seperti kebiasaan di sini.
Nomornya diambil lewat UPDATE yang mengunci baris penghitungnya, bukan lewat
`max(nomor) + 1`. Dua invoice yang dibuat bersamaan dengan cara kedua akan
mendapat nomor kembar tanpa suara, dan itu berarti dua client menerima
tagihan bernomor sama.

Fungsinya `security definer` supaya pemakai tidak perlu diberi hak menulis
kolom penghitungnya. Tenantnya diambil dari sesi, dan parameter tenant cuma
dipakai kalau sesinya memang tidak ada, yaitu jalur service role. Pemakai
yang login tidak bisa menghabiskan nomor tenant lain lewat parameter itu.

### Diskon dulu, baru PPN

Menghitung PPN dari subtotal penuh lalu memotong diskon menghasilkan pajak
atas uang yang tidak pernah ditagih. Urutannya dikunci uji, dan ujinya
terbukti merah waktu urutannya dibalik.

Diskon juga dijepit supaya tidak melebihi subtotal. Invoice bertotal negatif
bukan invoice, dan kalau lolos ke PDF akan terlihat seperti kesalahan sistem
di mata client.

### PDF memakai font bawaan

pdf-lib dengan Helvetica bawaan, bukan font yang disematkan. Alasannya bukan
ukuran berkas: font bawaan tidak perlu diunduh saat fungsi dingin, dan
invoice yang gagal terbit karena pengunduhan font timeout adalah cara paling
bodoh untuk mengecewakan client.

Konsekuensinya teks harus muat di WinAnsi. Bahasa Indonesia memang muat,
tapi teks yang ditempel orang dari aplikasi lain sering membawa kutip
melengkung dan emoji, jadi semuanya dibersihkan lebih dulu.

Angka rupiah dan tanggal ditulis sendiri, tidak lewat `Intl`. Intl
menyisipkan spasi tak terputus setelah "Rp" dan bentuknya berubah antar
versi Node. Format invoice tidak boleh ikut berubah hanya karena runtimenya
diperbarui.

### Tautan berumur tujuh hari

PDF disimpan di bucket tertutup dan dikirim sebagai tautan bertanda tangan.
Umurnya tujuh hari, bukan satu jam. Gateway memang mengunduhnya beberapa
detik setelah dikirim, tapi client sering membuka ulang chat lamanya, dan
invoice yang tautannya mati sehari kemudian terlihat seperti penipuan.

### Yang sengaja tidak dilakukan

- **Tidak ada pengingat otomatis jatuh tempo.** Layar sudah menandai yang
  lewat tempo, tapi mengirim tagihan berulang sendiri ke client itu
  keputusan bisnis, bukan keputusan mesin. Kalau nanti dibuat, jalurnya
  lewat kampanye yang sudah ada remnya, bukan jalur baru tanpa rem.
- **Tidak ada pencatatan pembayaran sebagian.** Lunas atau belum saja.
  Menambah pelunasan bertahap berarti menambah buku besar kecil, dan itu
  produk yang berbeda.

## Kuota paket, dan kenapa habisnya tidak mematikan AI

Kuota diperiksa sebelum model dipanggil, bukan sesudah. Memanggil model lalu
membuang hasilnya tetap dibayar, dan itu persis biaya yang kuotanya
seharusnya cegah.

Tapi kuota yang habis **tidak** langsung mematikan AI. Client yang tidak
dibalas lebih merugikan tenant daripada tagihan kelebihan yang wajar, dan
tarif kelebihan sudah dua setengah kali biayanya jadi tenant yang boros
tetap menambah untung, bukan mengurangi.

Yang membatasi justru angka yang dipasang tenant sendiri, kolom
`batas_kelebihan` di Pengaturan. Kosong berarti tanpa batas, nol berarti AI
berhenti tepat saat kuota habis. Keduanya pilihan yang sah, dan yang tidak
sah adalah memilihkannya diam-diam untuk tenant. Karena itu angka
pemakaiannya terlihat sepanjang bulan, dengan peringatan menyala di 80
persen, supaya tidak ada yang kaget di akhir.

Pemakaian dihitung ulang dari tabel `jalan_ai` tiap kali diminta, bukan dari
penghitung yang disimpan sendiri. Penghitung tersimpan bisa melenceng begitu
ada satu jalur yang lupa menaikkannya, dan melencengnya baru ketahuan saat
menagih.

Semua panggilan AI dihitung, termasuk yang berakhir jadi draf maupun
eskalasi. Modelnya tetap dipanggil dan tetap dibayar, jadi tetap memakan
kuota.

## Super admin jadi baca saja

Kebijakan RLS lama memakai `for all` dengan `saya_super_admin()` di klausa
`using`. Akibatnya pemegang super admin bukan cuma bisa membaca data tenant
mana pun, tapi juga mengubah dan menghapusnya, dari sesi browser biasa.
Untuk pekerjaan dukungan itu terlalu longgar: satu salah klik atau satu akun
yang bocor bisa menghapus seluruh riwayat percakapan pelanggan.

Sekarang tiap tabel punya empat kebijakan. Yang `_baca` menyebut super
admin, yang `_sisip`, `_ubah`, dan `_hapus` tidak. Kalau memang perlu
memperbaiki data pelanggan, jalurnya lewat service role dengan skrip yang
tercatat.

Halaman `/platform` mengikuti pendirian yang sama: tidak ada pemeriksaan
peran di TypeScript sama sekali. Fungsi SQL-nya `security invoker`, jadi RLS
yang menyaring, dan akun biasa yang membukanya cuma melihat tenantnya
sendiri. Menambahkan pemeriksaan peran di aplikasi hanya menciptakan gerbang
kedua yang suatu saat akan berbeda pendapat dengan gerbang pertama.

## Kenapa impor dokumen dicatat terpisah dari balasan

Reflows memanggil Claude di dua tempat: membalas chat, dan membaca dokumen
atau halaman web saat impor materi. Sampai 2 September 2026, cuma yang
pertama yang dicatat ke `jalan_ai`. Akibatnya halaman Penggunaan mengaku
menampilkan biaya AI padahal cuma sebagian.

Ketahuannya dengan membandingkan angka Reflows terhadap Claude Console.
Selisih pemakaian pada 2 September persis 4.771 token, dan itu persis token
satu impor halaman web yang layar impornya sendiri sudah menampilkan 3.157
masuk dan 1.614 keluar. Cocok sampai satu token.

Keduanya sekarang masuk tabel yang sama dengan kolom `jenis` yang
membedakan. Pemisahan itu menentukan dua hal yang berlawanan:

- **Kuota paket hanya menghitung `balasan`.** Paket menjanjikan jumlah
  balasan dan tidak pernah menjanjikan jumlah impor. Tenant yang merapikan
  materinya sekali tidak boleh kehilangan puluhan balasan dari kuotanya
  gara-gara itu.
- **Biaya menghitung keduanya.** Dua-duanya memanggil model dan dua-duanya
  ditagih Anthropic, jadi laporan yang cuma memuat satu di antaranya bukan
  laporan biaya.

Pencatatannya dilakukan begitu modelnya selesai dipanggil, bukan saat hasil
bacaannya disimpan. Tokennya sudah terpakai dan sudah ditagih walaupun
pemiliknya lalu membuang seluruh hasilnya. Kegagalan mencatat sengaja
didiamkan, karena hasil bacaan yang hilang gara-gara satu baris pembukuan
jauh lebih merugikan daripada satu angka biaya yang meleset.

Kolom `alasan` dipakai ulang untuk menyimpan asal dokumennya, jadi kelihatan
berkas mana yang mahal.

### Yang tidak bisa diperbaiki dari dalam Reflows

Claude Console menghitung pemakaian se-organisasi, bukan se-project. Selama
satu API key dipakai semua project Seawise, angka di sana akan selalu lebih
besar daripada angka di Reflows, dan bedanya bukan kesalahan pencatatan.
Yang perlu dilakukan di luar: membuat API key terpisah khusus Reflows.

Penanda cepat untuk membedakan: Reflows tidak pernah memakai model selain
Haiku 4.5 kecuali `MODEL_BALASAN` atau `MODEL_EKSTRAKSI` diset. Kalau di
Console muncul Sonnet atau Opus, itu sudah pasti bukan Reflows.
