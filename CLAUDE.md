# Reflows

Otomasi admin WhatsApp untuk bisnis kecil. Membalas chat client otomatis
dengan AI, dan nanti mengejar calon client lewat follow-up bertahap.
Dibangun untuk Seawise Studio dulu, dirancang multi-tenant sejak awal supaya
bisa dijual sebagai langganan.

Produksi: **https://reflows.seawise.id**
Repo: https://github.com/seawisecc/reflows

---

## Cara kerja bekerja di sini

### Bahasa

Semua dalam bahasa Indonesia: komentar kode, nama variabel domain, nama
berkas, teks antarmuka, pesan commit. Istilah teknis yang tidak punya
padanan wajar (commit, deploy, token, cache, webhook) tetap Inggris.

**Jangan pernah memakai em dash atau en dash** di mana pun, termasuk kode,
dokumen, dan commit. Ganti dengan koma, titik dua, titik, atau kurung. Di
judul halaman pakai `|`. Ini diperiksa mesin lewat `npm run periksa-aksi`,
jadi tidak perlu diingat-ingat, tapi tetap harus dihindari saat menulis.

### Verifikasi

Jangan menyatakan sesuatu berfungsi berdasarkan build yang lolos atau
dokumentasi. Buktikan di lingkungan yang sama dengan pengguna.

Tiga lapis pengujian, masing-masing membuktikan hal berbeda:

| Lapis | Perintah | Membuktikan |
|---|---|---|
| Unit | `npm test` | Aturan bisnis, tanpa jaringan |
| Skema | `npm test` | Migrasi dan RLS di PostgreSQL sungguhan lewat PGlite, tanpa Docker |
| Produksi | `npm run periksa:produksi`, `uji-webhook`, `uji-auth` | Perilaku di Supabase dan Vercel sungguhan |

Lapis produksi ada karena beberapa kesalahan mustahil terlihat dari lokal.
Contohnya `service_role` yang kehilangan hak akses tabel: migrasi mulus, uji
lokal lolos, semua webhook gagal di produksi.

Tes yang ditulis harus dibuktikan bisa gagal, bukan lolos kosong. Cara
membuktikannya: rusak sengaja kodenya, pastikan tesnya merah, lalu kembalikan.

---

## Stack

Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, TypeScript.
Supabase (PostgreSQL + Auth + RLS). Vercel. Claude API lewat
`@anthropic-ai/sdk`. Gateway WhatsApp: Fonnte.

---

## Susunan folder

```
src/app/page.tsx      Halaman depan publik, satu-satunya layar tanpa sesi
src/app/(aplikasi)/   Halaman dasbor, satu folder per menu
src/app/api/wa/       Webhook penerima pesan WhatsApp
src/app/masuk/        Halaman login
src/komponen/ui/      Komponen pixel: tombol, kartu, tabel, lencana, grafik
src/komponen/shell/   Bilah sisi, bilah atas, tombol tema
src/komponen/depan/   Bagian dan kartu paket halaman depan
src/lib/ai/           Peta kemampuan model, penyusun instruksi, mesin balasan
src/lib/kampanye/     Aturan anti-ban dan antrean kampanye keluar
src/lib/invoice/      Aritmetika invoice, penyusun PDF, penyimpanan berkas
src/lib/paket.ts      Definisi paket langganan dan aturan kuota
src/lib/gateway/      Adapter WhatsApp: jenis, nomor, fonnte, mock
src/lib/impor/        Impor materi dari PDF, web, dan spreadsheet
src/lib/data/         Pembacaan data lewat sesi pengguna (kena RLS)
src/lib/supabase/     Klien browser, server, service role, proxy
src/lib/depan.ts      Isi halaman depan, angka paketnya dibaca dari paket.ts
src/lib/tagihan.ts    Aritmetika tagihan langganan, fungsi murni
src/lib/jaring-balasan.ts Jaring pengaman putaran balasan, dipisah supaya bisa diuji
src/lib/jalur-terbuka.ts  Gerbang jalur tanpa sesi, dipisah supaya bisa diuji
src/lib/log.ts        Log terstruktur, dengan daftar kunci yang boleh terbit
src/lib/merek.ts      Bentuk dan warna logo, satu sumber untuk semua turunannya
src/komponen/merek/   Lambang untuk dipakai di dalam aplikasi
src/aset/             Berkas mentah yang ikut repo, sekarang font gambar OG
skrip/                Skrip verifikasi dan penyiapan
supabase/migrations/  Skema database
docs/                 Keputusan produk beserta alasannya
```

---

## Design system pixel

Dua tema penuh, bukan pembalikan warna: **Deep Reef** (gelap, bawaan) dan
**Sunset Arcade** (terang). Semua warna lewat CSS variable di
`src/app/globals.css`. Sudut nol di mana-mana, border 2px, shadow offset
padat, tombol bergeser 2px saat ditekan.

### Aturan font yang tidak boleh dilanggar

Press Start 2P digambar di grid 1/8 em, jadi **hanya tajam di ukuran
kelipatan 8**. Diukur dari jumlah level intensitas pada render: 6 sampai 18
level di ukuran 8, 16, 24, 32, tapi melonjak jadi 50 sampai 83 di ukuran 9,
11, 12, dan 14.

Ukuran font pixel tidak pernah ditulis lepas. Pakai `pixel-sm` (8px),
`pixel-lg` (16px), `pixel-xl` (24px), atau `pixel-2xl` (32px) yang cuma
untuk judul utama halaman depan. Jangan menimpanya dengan `text-[..]` atau
`leading-*`. Teks yang isinya data, misalnya nama kontak,
memakai font badan biasa karena font pixel menyulitkan membaca nama orang.

### Warna

Warna teks dipisah dari warna bidang. Token `--aksen` untuk bidang tombol,
`--aksen-tinta` untuk teks, garis, dan ikon. Di tema terang, warna cerah
tidak pernah lolos kontras sebagai teks kecil.

Warna seri grafik terpisah lagi (`--seri-1`, `--seri-2`) dan sudah lolos
pemeriksaan buta warna. **AI selalu biru atau ungu, manusia selalu teal atau
oranye**, konsisten di grafik, lencana, dan titik status.

Di tema oranye, warna status hangat mustahil dibedakan satu sama lain. Karena
itu dalam satu deretan hanya boleh ada satu warna alarm.

---

## Model data

Lima belas tabel, semuanya membawa `tenant_id` dan dijaga RLS:
`tenants`, `pengguna`, `pengaturan_tenant`, `pengetahuan`, `kontak`,
`percakapan`, `pesan`, `jalan_ai`, `log_audit`, `kampanye`,
`langkah_kampanye`, `sasaran_kampanye`, `invoice`, `baris_invoice`,
`tagihan_langganan`.

PDF invoice tinggal di bucket Supabase Storage bernama `invoice` yang
tertutup. Bucket itu dibuat lewat API penyimpanan, bukan lewat migrasi, jadi
tidak ikut terbentuk sendiri di project Supabase yang baru.

Tiga fungsi menghitung angka layar di dalam database dan mengembalikan satu
jsonb: `ringkasan_dasbor()`, `penggunaan_ai()`, dan `keadaan_kampanye()`.
Semuanya `security invoker`, jadi RLS tetap yang menyaring tenant. Kalau
salah satu dijadikan `security definer`, angka semua pelanggan bocor, dan
`npm test` memang menangkapnya.

Tiga fungsi lain khusus jalur service role dan haknya dicabut dari
`authenticated`: `klaim_sasaran()` yang mengunci satu sasaran kampanye
dengan `for update skip locked`, `hentikan_sasaran_kontak()` yang dipanggil
webhook saat kontak membalas, dan `pemakaian_bulan()` yang menghitung
balasan satu bulan tertentu saat menyusun tagihan langganan. Ketiganya
menerima `tenant_id` sebagai parameter, dan itu sebabnya tidak boleh bisa
dipanggil dari sesi browser mana pun.

Kebijakan RLS bertumpu pada `public.tenant_saya()` yang `SECURITY DEFINER`,
supaya pembacaan tabel `pengguna` di dalamnya tidak ikut kena RLS.

### Dua tabel tagihan yang sering tertukar

| | Siapa menagih siapa | Siapa yang menulis |
|---|---|---|
| `invoice` | Tenant menagih clientnya | Tenant, lewat layar Invoice |
| `tagihan_langganan` | Seawise menagih tenant | Seawise, lewat `npm run tagihan` |

`tagihan_langganan` sengaja **tidak punya kebijakan RLS untuk menulis sama
sekali**, dan haknya juga dicabut di tingkat tabel. Tenant cuma bisa
membacanya, di halaman Penggunaan. Alasannya sama dengan kolom
`tenants.aktif`: pihak yang ditagih tidak boleh bisa menerbitkan tagihan
untuk dirinya, mengubah angkanya, atau menyatakan dirinya lunas. Uji skema
membuktikan keempatnya, dan langsung merah begitu kebijakan tulis
ditambahkan.

Semua angka dan rekening tujuannya disalin saat diterbitkan, sama seperti
invoice ke client. Menaikkan harga paket bulan depan tidak mengubah tagihan
yang sudah dibayar, dan mengganti rekening tidak mengubah rekening yang
tertulis di tagihan lama.

Pembayarannya transfer manual dulu, lalu Seawise menandainya lunas.
Payment gateway menyusul.

### Dua saklar mematikan layanan

Beda pemiliknya, dan bedanya menentukan siapa yang boleh menyalakan lagi.

| | Kolom | Dipegang | Yang ikut mati |
|---|---|---|---|
| Jeda | `pengaturan_tenant.dijeda_at` | Tenant sendiri | Balasan AI dan kampanye. Kirim manual tetap boleh |
| Suspensi | `tenants.aktif` | Seawise | Semuanya, termasuk kirim manual |

Tenant tidak bisa melepas suspensi karena tabel `tenants` tidak punya
kebijakan RLS untuk update sama sekali. Uji skema membuktikannya, dan
langsung merah begitu kebijakan itu ditambahkan.

Dua hal tidak pernah ikut mati, dan itu disengaja: **pesan masuk tetap
dicatat** apa pun keadaannya, dan **permintaan berhenti tetap dihormati**.
Membuang chat berarti pemiliknya kehilangan semua yang masuk selama mati.
Mengabaikan opt-out berarti orang yang minta berhenti dikirimi kampanye lagi
begitu layanan menyala.

Keputusannya satu fungsi murni di `src/lib/layanan.ts`, dipakai empat tempat:
webhook, antrean kampanye, tombol kirim, dan spanduk di layar.

### Peran dan super admin

Dua hal yang berbeda dan sering tertukar:

| | Cakupan | Isi |
|---|---|---|
| `peran` (pemilik, admin, staf) | Di dalam satu tenant | Belum dipakai membatasi apa pun |
| `super_admin` (boolean) | Seluruh platform | Membuka pembacaan lintas tenant di RLS |

`super_admin` sekarang **hanya membuka pembacaan**. Kebijakan tiap tabel
dipecah jadi empat: `_baca` menyebut super admin, sedangkan `_sisip`,
`_ubah`, dan `_hapus` cuma menyebut tenant sendiri. Sebelum diperketat,
kebijakannya `for all` dengan super admin di klausa `using`, jadi
pemegangnya bisa menghapus seluruh riwayat percakapan pelanggan mana pun
dari sesi browser biasa.

Kalau memang perlu memperbaiki data pelanggan, jalurnya lewat service role
dengan skrip yang tercatat, bukan lewat browser.

Akun `seawise.cc@gmail.com` berperan `pemilik` dengan `super_admin = false`.
Itu disengaja: akun harian sebaiknya tidak memegang kunci ke data semua
pelanggan. Halaman `/platform` sudah ada dan bekerja untuk akun mana pun,
cuma isinya disaring RLS: akun biasa melihat tenantnya sendiri, super admin
melihat semuanya. Akun administrasi platform yang terpisah belum dibuat.

---

## Keamanan yang sudah dipasang

- **Token gateway** disandi AES-256-GCM sebelum masuk database. Kuncinya di
  variabel lingkungan, bukan di database.
- **Kolom rahasia** (`gateway_token_terenkripsi`, `rahasia_webhook`) dicabut
  penuh dari peran `authenticated` lalu diberikan lagi per kolom tanpa
  keduanya. Mencabut satu kolom saja tidak cukup: hak di tingkat tabel
  menang.
- **Webhook** dijaga dua lapis, karena Fonnte tidak menandatangani apa pun:
  rahasia 64 karakter di jalur URL, dan pencocokan nomor perangkat.
- **Pengambilan halaman web** untuk impor materi diperiksa sampai ke nomor
  IP hasil resolusi DNS. Semua rentang jaringan dalam ditolak, termasuk
  169.254.169.254 milik metadata cloud, dan tiap pengalihan diperiksa ulang.
- **Gerbang server action** selalu lewat klien bersesi supaya yang menolak
  adalah RLS, bukan perbandingan `tenant_id` yang ditulis tangan.
- **Log server** cuma boleh memuat id dan sebab, tidak pernah isi chat atau
  nomor WhatsApp. Penyaring di `src/lib/log.ts` memilih kunci satu per satu
  dari daftar, jadi kunci yang tidak terdaftar hilang walaupun pemanggilnya
  memaksa lewat cast. Alasannya sama dengan mematikan Inbox Fonnte: isi chat
  client tidak boleh menginap di server orang lain, dan log Vercel adalah
  server orang lain.

---

## Jebakan yang sudah memakan waktu

Dicatat supaya tidak terulang.

1. **`service_role` tidak mewarisi hak akses tabel.** Migrasi CLI berjalan
   sebagai role yang bukan pemilik default, jadi default privileges Supabase
   tidak berlaku. Sifat `bypassrls` melewati RLS tapi itu bukan pengganti
   hak akses tabel.
2. **Berkas `"use server"` hanya boleh mengekspor fungsi async.** Melanggar
   ini lolos TypeScript dan lolos ESLint, lalu meruntuhkan halaman di
   produksi. Dijaga `npm run periksa-aksi`.
3. **Satu permintaan harus memakai satu klien Supabase.** Refresh token
   berputar, jadi beberapa klien yang menyegarkan berbarengan akan saling
   membatalkan dan sesi pengguna hangus di tengah kerja. `klien_server`
   dibungkus `cache()`.
4. **`backdrop-filter` membuat containing block baru**, sehingga elemen
   `position: fixed` di dalamnya terkurung.
5. **Haiku 4.5 menolak `adaptive thinking` dan `fallbacks`** dengan galat
   400. Model keluarga baru justru sebaliknya. Petanya di
   `src/lib/ai/model.ts`.
6. **Fonnte mengirim `inboxid: 0`** saat fitur Inbox dimatikan. Kalau
   diterima apa adanya sebagai id, semua pesan punya id sama dan pesan kedua
   dan seterusnya dibuang karena dikira kiriman ulang.
7. **`autoread` wajib On di Fonnte**, kalau tidak webhook tidak pernah
   dipanggil sama sekali.
8. **Fitur Inbox Fonnte sengaja dimatikan** karena menyalakannya berarti isi
   chat client disimpan di server Fonnte. Anti-dobel memakai sidik jari isi
   pesan, bukan `inboxid`.
9. **Skrip uji tidak boleh menimpa pengaturan produksi.** Versi pertama
   `uji-webhook` menulis nomor karangan ke `nomor_wa` dan lupa
   mengembalikan, sehingga semua pesan client asli ditolak diam-diam.
10. **Nomor uji memakai kode negara 999** yang dicadangkan ITU. Sejak mesin
    balasan menyala, nomor uji berprefix Indonesia berarti orang asing
    menerima pesan dari nomor bisnis tenant.
11. **Region fungsi Vercel harus dipatok `sin1`** di `vercel.json`. Bawaannya
    `iad1`, sedangkan Supabase di `ap-southeast-1`, jadi tiap query
    menyeberangi Pasifik dan satu halaman bisa menumpuk lebih dari sedetik
    jeda jaringan murni. Diperiksa lewat header `x-vercel-id`, bagian
    keduanya adalah region fungsinya.
12. **Bilah sisi harus dirender di layout, bukan di dalam bilah atas tiap
    halaman.** Layout Next.js tidak dirender ulang saat pindah antar halaman
    di dalamnya, jadi profil pengguna dibaca sekali per muat penuh. Waktu
    masih di bilah atas, tiap klik menu menunggu dua query yang hasilnya
    sama persis.
13. **`to_char` di Postgres selalu memberi nama hari Inggris**, tidak peduli
    locale server. Diterjemahkan di aplikasi, bukan dengan menggeser
    `lc_time` yang berlaku untuk seluruh project.
14. **Jalur API baru harus didaftarkan di `TERBUKA` milik `src/proxy.ts`.**
    Middleware mengalihkan semua yang belum terdaftar ke halaman masuk, dan
    pemanggil tanpa sesi seperti pg_cron cuma menerima 307 tanpa penjelasan.
    Antrean kampanye diam total sampai ini ketahuan, dan cuma kelihatan saat
    jalurnya dicoba di produksi.
15. **Nilai enum baru tidak boleh dipakai di migrasi yang sama dengan
    penambahannya.** PostgreSQL menolak dengan galat 55P04, dan badan fungsi
    SQL ikut diperiksa saat dibuat. Pisahkan jadi dua berkas migrasi.
16. **Peran `postgres` di Supabase bukan superuser**, jadi
    `alter database ... set` ditolak. Rahasia yang dibutuhkan pg_cron
    disimpan di Supabase Vault, lalu dibaca lewat `vault.decrypted_secrets`
    di dalam definisi jadwalnya.
17. **`INSERT ... SELECT` lintas tenant lolos tanpa menguji apa pun.** RLS
    menyaring SELECT-nya lebih dulu, jadi tidak ada baris yang disisipkan
    dan tidak ada galat yang muncul. Uji penolakan harus memakai baris yang
    memang terlihat oleh pemakainya, lalu menaruh tenant_id orang lain di
    kolomnya.
18. **`npm run periksa-aksi` melarang tanda pisah panjang di seluruh kode**,
    termasuk di tempat karakter itu justru jadi data, misalnya peta
    pembersih teks untuk PDF. Tulis sebagai escape `\u2013`, jangan
    melemahkan pemeriksanya.
19. **Font PDF sengaja yang bawaan, bukan yang disematkan.** Konsekuensinya
    teks harus muat di WinAnsi, jadi kutip melengkung dan emoji dibersihkan
    di `aman()` sebelum digambar. Kalau lolos apa adanya, pdf-lib melempar
    galat dan invoicenya gagal terbit tepat saat mau dikirim ke client.
20. **Ada DUA tempat yang memanggil Claude, dan dua-duanya harus dicatat.**
    `balas-otomatis.ts` untuk balasan chat, `impor/ekstrak.ts` untuk membaca
    dokumen. Yang kedua sempat tidak pernah masuk `jalan_ai` sama sekali,
    jadi halaman Penggunaan mengaku menampilkan biaya AI padahal cuma
    sebagian. Kolom `jenis` sekarang memisahkannya: kuota paket menghitung
    `balasan` saja, biaya menghitung dua-duanya.
21. **Claude Console menghitung se-organisasi, bukan se-project.** Selama
    satu API key dipakai semua project Seawise, angka di Console tidak akan
    pernah cocok dengan angka di Reflows. Cara memastikan: Usage, Group by
    API Key, lalu Group by Model. Model selain Haiku 4.5 sudah pasti bukan
    Reflows, karena `MODEL_BALASAN` dan `MODEL_EKSTRAKSI` tidak diset.
22. **Jalur metadata Next tidak berakhiran nama berkas.** `/opengraph-image`
    dan `/apple-icon` tidak punya akhiran, jadi lolos dari pengecualian
    matcher di `src/proxy.ts` dan ikut diperiksa sesi. Crawler WhatsApp yang
    kena pengalihan ke halaman masuk cuma menampilkan tautan telanjang,
    tanpa galat apa pun yang kelihatan. Keduanya sudah didaftarkan di
    `TERBUKA`. Ini varian dari jebakan nomor 14, dan sama tidak
    kelihatannya.
23. **Janji "tidak akan melempar" yang cuma ditulis di komentar akan
    dilanggar.** `balas_otomatis` sudah lama berkomentar bahwa kegagalannya
    tidak boleh menjatuhkan webhook, dan semua kegagalan yang diperkirakan
    memang dilempar ke manusia dengan alasan yang kelihatan di inbox. Tapi
    galat yang tidak diperkirakan lolos ke pemanggil, ditangkap `catch`
    kosong di webhook, lalu hilang. Percakapannya tetap berstatus `ai`, dan
    di layar itu terlihat persis sama dengan chat yang memang sedang
    dipegang AI. Sekarang janjinya dipegang kode, bukan komentar, lewat
    `dengan_jaring` di `src/lib/jaring-balasan.ts` yang diuji terpisah.
24. **Halaman depan yang terbuka nyaris membuka seluruh aplikasi.**
    Gerbang di `src/proxy.ts` mencocokkan awalan, jadi menaruh `/` di daftar
    jalur terbuka terlihat seperti membuka semua halaman sekaligus. Yang
    menyelamatkan cuma satu detail: pencocokannya menempelkan garis miring,
    jadi awalan untuk `/` menjadi `//` dan tidak cocok dengan `/dasbor`.
    Menyederhanakan pencocokan itu jadi `startsWith(t)` saja akan membuka
    seluruh data pelanggan tanpa sesi, tanpa galat apa pun yang muncul.
    Sekarang halaman depan ada di daftar terpisah yang cocok persis, dan
    gerbangnya diuji di `src/lib/jalur-terbuka.ts`.

---

## Keadaan tiap fase

| Fase | Isi | Status |
|---|---|---|
| 0 | Fondasi, skema, RLS, design system dua tema | Selesai |
| 1 | Gateway, webhook, autentikasi, inbox, kirim manual | Selesai |
| 2 | Mesin balasan AI, impor materi, eskalasi | Selesai |
| 3 | Kampanye keluar, sequence, anti-ban | Selesai |
| 4 | Invoice PDF dan pengirimannya lewat WhatsApp | Selesai |
| 5 | Dasbor pemilik platform, monitoring lintas tenant, billing | Selesai |

### Yang sudah hidup di produksi

Pesan WhatsApp masuk lewat Fonnte, AI menyusun balasan dari materi admin,
lalu mengirimkannya kembali. Terbukti dengan chat sungguhan.

Dasbor, Percakapan, Kontak, Pengetahuan, Penggunaan, dan Kampanye semuanya
membaca data sungguhan. Tidak ada lagi layar yang menampilkan angka
karangan. Percakapan, dasbor, dan kampanye yang sedang jalan menyegar
sendiri lewat `router.refresh()` berkala, yang berhenti saat tab tidak
terlihat.

Antrean kampanye dipanggil pg_cron di Supabase setiap menit, dan terbukti
dijawab 200 lewat `npm run periksa-cron`.

Invoice bisa disusun dari daftar layanan, jadi PDF, lalu dikirim ke
WhatsApp beserta ringkasan tagihan. Terbukti dengan invoice sungguhan yang
diterbitkan di produksi lalu diunduh lewat tautan bertanda tangannya.

Kuota paket sudah dipaksakan mesin. Diperiksa sebelum model dipanggil,
bukan sesudah, karena memanggil model lalu membuang hasilnya tetap dibayar.

Halaman depan publik hidup di `/`, terbuka tanpa sesi, dan angka paketnya
dibaca dari `paket.ts` supaya brosur tidak bisa berbeda dari mesin.

Tagihan langganan bisa diterbitkan, didaftar, dan ditandai lunas lewat
`npm run tagihan`. Sudah dibuktikan ujung ke ujung di produksi, lalu
tagihan ujinya dihapus lagi karena bulannya belum selesai.

Urutan keputusan mesin balasan:

```
pesan masuk
  minta berhenti?              tutup, tidak dibalas apa pun
  kena aturan eskalasi?        lempar ke manusia, AI tidak dipanggil
  sudah dipegang manusia?      AI diam
  selain itu                   AI menyusun balasan
                                 butuh manusia     eskalasi
                                 mode draf         simpan draf
                                 keyakinan cukup   kirim
                                 keyakinan kurang  simpan draf
```

### Biaya terukur

Diukur dari tabel `jalan_ai`, bukan diperkirakan. Diperiksa ulang
3 September 2026 dan angkanya belum berubah, karena layanan dijeda
sepanjang hari itu jadi tidak ada panggilan model baru:

| | Panggilan | Per panggilan |
|---|---|---|
| Balasan ke client | 6 | $0,0025, sekitar Rp 42 |
| Baca dokumen atau web | 1 | $0,0027, sekitar Rp 44 |

Angka balasan naik dari $0,002 setelah materi diselaraskan dengan situs,
karena instruksi tetapnya ikut membesar. Token masuk satu balasan sekarang
sekitar 2.900, dari sebelumnya 1.550.

**Prompt caching masih belum pernah kena satu kali pun.** Kolom
`token_cache_baca` dan `token_cache_tulis` semuanya nol. Dua sebab yang
mungkin, dan belum dipisahkan: instruksinya masih di bawah ambang minimum
cache Haiku, atau umur cache lima menit selalu habis karena chat masuk
jarang. Kalau nanti mau dikejar, yang perlu diperiksa dulu ukuran instruksi
tetapnya, bukan langsung mengubah kode.

---

## Yang menunggu kamu, di luar kode

Tidak satu pun bisa dikerjakan dari dalam repo ini.

1. **Isi identitas invoice.** Alamat bisnis dan nomor rekening masih kosong
   di Pengaturan, jadi PDF yang terbit sekarang tidak memuat cara
   pembayaran dan client harus menanyakannya lagi.
2. **Naikkan paket Fonnte ke Master, dan sekarang itu tanggungan Seawise.**
   Masih Free, jadi setiap pesan keluar membawa tulisan "Sent via
   fonnte.com". Sejak 3 September 2026 gateway ikut dijual di dalam paket
   Reflows, jadi tulisan itu bukan lagi urusan tenant melainkan janji yang
   sudah tertulis di halaman depan. Paketnya per device, bukan per akun,
   jadi tiap nomor tenant berbiaya Rp 175.000 sebulan.
3. **Buat API key Claude terpisah khusus Reflows.** Sekarang satu key untuk
   seluruh organisasi Seawise, jadi angka di Console tidak akan pernah bisa
   dibandingkan dengan angka di halaman Penggunaan.
4. **Buat akun administrasi platform** yang terpisah dari akun harian.
   `seawise.cc@gmail.com` sengaja bukan super admin, jadi `/platform`
   sekarang cuma menampilkan satu tenant.
5. **Isi rekening Seawise** di `.env.local`, tiga baris `SEAWISE_BANK_*`.
   Tanpa itu tagihan langganan tetap terbit tapi tanpa cara bayar, dan
   tenant harus menanyakannya lewat chat. Tidak perlu dipasang di Vercel:
   yang membacanya cuma `npm run tagihan` yang jalan di laptop, lalu
   nilainya disalin ke baris tagihan.
6. **Tambahkan scope `workflow` ke token GitHub**, atau pindahkan remote ke
   SSH. Sampai itu beres, `.github/workflows/periksa.yml` tertahan di branch
   dan push ke `main` masih terbit ke produksi tanpa gerbang.

## Yang perlu diputuskan

- **Notifikasi ke HP.** Fonnte wajib menyalakan `autoread` supaya webhook
  jalan, dan itu menandai pesan sebagai terbaca di seluruh perangkat. Jadi
  notifikasi di HP tidak muncul, dan client melihat centang biru padahal
  belum ada manusia yang baca. Satu-satunya jalan keluar adalah Reflows yang
  mengirim notifikasinya sendiri ke nomor pribadi pemilik. Sudah dibahas,
  belum dikerjakan atas permintaan pemilik.

  **Urgensinya naik sejak 3 September 2026.** Halaman depan sekarang
  mengarahkan calon pelanggan ke nomor bisnis yang sama. Selama layanan
  dijeda, AI tidak membalas, sementara `autoread` tetap membuat chatnya
  bercentang biru. Dari sisi orang yang baru tertarik: pesannya dibaca lalu
  didiamkan. Sebelum ada halaman depan, yang chat cuma client lama yang
  memang dipegang sendiri, jadi menundanya masuk akal. Sekarang ada pintu
  masuk publik yang tidak dijaga siapa pun.
- **Balasan luar jam saat layanan dijeda.** Sekarang ikut mati, jadi client
  melihat pesannya dibaca lalu didiamkan total. Mungkin lebih baik tetap
  keluar, karena "dibaca lalu didiamkan" lebih buruk daripada balasan
  otomatis yang jujur bilang sedang tidak aktif.
- **Banyak nomor untuk satu tenant.** Paket Penuh pernah menjanjikan tiga
  nomor, dan itu dikoreksi jadi satu pada 3 September 2026 karena mesinnya
  memang tidak bisa. `pengaturan_tenant` memakai `tenant_id` sebagai primary
  key, jadi satu tenant tepat satu token gateway dan satu `nomor_wa`, dan
  webhook menolak pesan dari nomor perangkat lain. Fonnte sendiri bisa
  banyak device dalam satu akun, jadi hambatannya murni di Reflows.

  Kalau mau dibangun: tabel perangkat menggantikan kolom tunggal di
  `pengaturan_tenant`, webhook memilih perangkat dari nomor tujuan,
  pengiriman memilih token per percakapan, plus layar mengelolanya. Harganya
  juga perlu naik Rp 175.000 per nomor tambahan, karena paket Fonnte berlaku
  per device. Uji di `paket.test.ts` akan merah kalau angka nomornya
  dinaikkan sebelum kodenya ada.
- **Kampanye pertama.** Fase 3 jalan tapi belum pernah dipakai ke kontak
  sungguhan. Mulai kecil, sepuluh sampai dua puluh kontak, periksa rasio
  balasannya sebelum daftar besar dimasukkan.
- **Variabel lingkungan Preview** sengaja dibiarkan kosong, jadi deployment
  dari branch akan gagal build. Mengisinya berarti preview bisa menulis ke
  database produksi. Kalau preview memang dibutuhkan, jalannya lewat project
  Supabase kedua, bukan menyalin kunci produksi.

---

## Serah terima, 2 September 2026

Semua fase selesai. Yang dikerjakan hari ini, berurutan:

1. **GitHub disambungkan ke Vercel.** Sebelumnya deploy cuma lewat CLI.
   Sekarang push ke `main` memicu deploy produksi sendiri.
2. **Region fungsi dipatok `sin1`.** Sebelumnya `iad1` sementara database di
   Singapura, jadi tiap query menyeberangi Pasifik. Halaman turun dari 530
   sampai 1.100 ms jadi 140 sampai 300 ms.
3. **Semua layar membaca data sungguhan.** Tidak ada lagi angka karangan.
4. **Halaman Penggunaan** dibuat, tabel `jalan_ai` akhirnya dibaca.
5. **Tiga paket langganan** dihitung, dicatat di `docs/keputusan-produk.md`.
6. **Fase 3, 4, dan 5** digarap sampai selesai.
7. **Saklar mematikan layanan**, dua buah, beda pemiliknya.
8. **Materi AI diselaraskan dengan seawise.id.** Harga yang dipakai AI
   ternyata tidak ada di situs sama sekali.
9. **Impor dokumen akhirnya dicatat** ke `jalan_ai`. Sebelumnya halaman
   Penggunaan mengaku menampilkan biaya AI padahal cuma sebagian.

Keadaan produksi saat ditinggalkan:

| | |
|---|---|
| Layanan | **DIJEDA** sejak 2 September 2026 pukul 14.25 WITA |
| WhatsApp | Tersambung, +62 812-3759-7759, paket Fonnte Free |
| Kontak | 5, semuanya asli |
| Materi AI | 28 butir, 22 aktif |
| Kampanye | Belum ada satu pun |
| Invoice | Belum ada, penomoran mulai dari INV/2026/0001 |
| Antrean cron | Jalan tiap menit, dijawab 200 |
| Uji | 183 unit, 43 skema, 20 produksi, semua hijau |

**Jedanya dipasang pemilik sendiri, bukan tertinggal dari pengujian.**
Tujuh belas detik setelah dijeda, satu pesan berbunyi "Tes" masuk dan
memang tercatat tanpa dibalas, jadi jedanya terbukti bekerja dari sisi
pemilik juga.

Selama masih dijeda, **AI tidak akan membalas chat client mana pun**, dan
kampanye tidak akan mengirim. Pesan yang masuk tetap tercatat dan menunggu
di inbox. Menyalakannya lagi satu tombol di halaman Pengaturan.

Data uji semuanya sudah dibersihkan. Kalau ada sisa yang mencurigakan,
periksa dengan `npm run tenant-aktif seawise`, yang menampilkan jumlah
kontak, percakapan, pesan, dan materi.

---

## Tambahan, 3 September 2026

Dikerjakan setelah serah terima, berurutan:

1. **Logo, favicon, dan gambar Open Graph.** Bentuknya satu sumber di
   `src/lib/merek.ts`, dipakai komponen React, favicon SVG, ikon iOS, dan
   gambar Open Graph sekaligus. Dua gelembung chat menurun diagonal, warnanya
   ikut aturan yang sudah ada: manusia teal atau oranye, AI biru atau ungu.
2. **Halaman galat, lima berkas.** Sebelumnya tidak ada satu pun, jadi galat
   apa pun menampilkan halaman bawaan Next berlatar putih berbahasa Inggris.
   Yang di dalam grup `(aplikasi)` mempertahankan bilah sisi.
3. **CI di GitHub Actions.** Menjalankan `npm run periksa` tanpa satu pun
   rahasia, dan itu sudah dibuktikan di salinan repo tanpa `.env.local`.
   **Commitnya belum terkirim**, lihat catatan di bawah.
4. **Log terstruktur dan jaring pengaman balasan.** Sebelumnya nol `console`
   di seluruh `src`, dan galat tak terduga meninggalkan percakapan berstatus
   `ai` yang tidak akan pernah dibalas.
5. **Halaman depan publik di `/`.** Angka paketnya dibaca dari `paket.ts`,
   jadi brosur tidak bisa berbeda dari yang dipaksakan mesin.
6. **Tagihan langganan.** Tabel `tagihan_langganan` dan `npm run tagihan`,
   Seawise menagih tenant lewat transfer manual. Tabelnya sengaja tanpa
   kebijakan RLS untuk menulis sama sekali.
7. **Gateway ditanggung Seawise, harga paket naik.** Membalik keputusan
   sebelumnya. Paket Fonnte berlaku per device, bukan per akun, jadi tiap
   nomor tetap berbiaya Rp 175.000 walaupun akunnya cuma satu. Harga naik
   sebesar biaya itu, dan paket Penuh dikoreksi dari tiga nomor jadi satu.

Keadaan yang berubah dari tabel serah terima:

| | |
|---|---|
| Halaman depan | Hidup di `/`, terbuka tanpa sesi, ajakan chat ke nomor bisnis |
| Harga paket | Mulai Rp 499.000, Tumbuh Rp 949.000, Penuh Rp 1.690.000 |
| Gateway | Ditanggung Seawise, sudah termasuk harga paket |
| Nomor per tenant | Satu, dan itu batas mesin bukan pilihan produk |
| Tagihan langganan | Tabel dan skripnya jalan, belum ada tagihan sungguhan |
| Uji | 223 unit, 50 skema, 21 produksi, semua hijau |

Layanan **masih dijeda**, dan itu sengaja tidak diubah.

### Yang tertinggal dari hari itu

Commit `.github/workflows/periksa.yml` masih tertahan di branch
`logo-dan-gerbang-periksa` di laptop. GitHub menolaknya dengan pesan
"refusing to allow a Personal Access Token to create or update workflow
without `workflow` scope", jadi ini urusan kredensial, bukan isi berkasnya.

Itu dan dua hal lain ada di daftar "Yang menunggu kamu" di atas, nomor 2,
5, dan 6.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run periksa` | Lint, typecheck, periksa-aksi, tes, build |
| `npm test` | Uji unit dan uji skema lewat PGlite, tanpa jaringan |
| `npm run periksa:produksi` | Memeriksa database Supabase sungguhan |
| `npm run uji-webhook` | Uji jalur webhook ujung ke ujung |
| `npm run uji-auth` | Uji sesi dan isolasi antar tenant |
| `npm run uji-kampanye` | Uji antrean kampanye ujung ke ujung |
| `npm run uji-invoice` | Uji penomoran, PDF, dan penyimpanannya |
| `npm run contoh-invoice` | Membuat PDF contoh tanpa menyentuh database |
| `npm run pasang-cron` | Memasang penjadwal antrean di Supabase |
| `npm run periksa-cron` | Memeriksa apakah cron benar-benar memanggil |
| `npm run buat-logo` | Menulis ulang berkas SVG logo dari `src/lib/merek.ts` |
| `npm run deploy` | Deploy ke produksi |
| `npm run db:push` | Memasang migrasi ke Supabase |
| `npm run siapkan-tenant` | Mengisi tenant dan materi adminnya |
| `npm run buat-pengguna` | Membuat akun masuk |
| `npm run bersihkan-contoh` | Menghapus kontak percobaan |
| `npm run tenant-aktif` | Melihat, menyuspensi, atau mengaktifkan tenant |
| `npm run tagihan` | Menerbitkan dan melunasi tagihan langganan tenant |

Uji produksi menulis ke Supabase sungguhan lalu membersihkan sendiri, dan
nomor sasarannya selalu berkode negara 999 yang dicadangkan ITU. Jangan
pernah menggantinya dengan prefix Indonesia: sejak mesin balasan dan
kampanye menyala, itu berarti orang asing menerima pesan dari nomor bisnis
tenant setiap kali uji dijalankan.

Supabase CLI dijalankan lewat `npm run sb` yang memakai token khusus project
ini dari `.env.local`, supaya login global untuk project Seawise lain tidak
tertimpa.
