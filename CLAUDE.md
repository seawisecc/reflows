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
src/app/(aplikasi)/   Halaman dasbor, satu folder per menu
src/app/api/wa/       Webhook penerima pesan WhatsApp
src/app/masuk/        Halaman login
src/komponen/ui/      Komponen pixel: tombol, kartu, tabel, lencana, grafik
src/komponen/shell/   Bilah sisi, bilah atas, tombol tema
src/lib/ai/           Peta kemampuan model, penyusun instruksi, mesin balasan
src/lib/kampanye/     Aturan anti-ban dan antrean kampanye keluar
src/lib/invoice/      Aritmetika invoice, penyusun PDF, penyimpanan berkas
src/lib/gateway/      Adapter WhatsApp: jenis, nomor, fonnte, mock
src/lib/impor/        Impor materi dari PDF, web, dan spreadsheet
src/lib/data/         Pembacaan data lewat sesi pengguna (kena RLS)
src/lib/supabase/     Klien browser, server, service role, proxy
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
`pixel-lg` (16px), atau `pixel-xl` (24px). Jangan menimpanya dengan
`text-[..]` atau `leading-*`. Teks yang isinya data, misalnya nama kontak,
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

Empat belas tabel, semuanya membawa `tenant_id` dan dijaga RLS:
`tenants`, `pengguna`, `pengaturan_tenant`, `pengetahuan`, `kontak`,
`percakapan`, `pesan`, `jalan_ai`, `log_audit`, `kampanye`,
`langkah_kampanye`, `sasaran_kampanye`, `invoice`, `baris_invoice`.

PDF invoice tinggal di bucket Supabase Storage bernama `invoice` yang
tertutup. Bucket itu dibuat lewat API penyimpanan, bukan lewat migrasi, jadi
tidak ikut terbentuk sendiri di project Supabase yang baru.

Tiga fungsi menghitung angka layar di dalam database dan mengembalikan satu
jsonb: `ringkasan_dasbor()`, `penggunaan_ai()`, dan `keadaan_kampanye()`.
Semuanya `security invoker`, jadi RLS tetap yang menyaring tenant. Kalau
salah satu dijadikan `security definer`, angka semua pelanggan bocor, dan
`npm test` memang menangkapnya.

Dua fungsi lain khusus jalur service role dan haknya dicabut dari
`authenticated`: `klaim_sasaran()` yang mengunci satu sasaran kampanye
dengan `for update skip locked`, dan `hentikan_sasaran_kontak()` yang
dipanggil webhook saat kontak membalas.

Kebijakan RLS bertumpu pada `public.tenant_saya()` yang `SECURITY DEFINER`,
supaya pembacaan tabel `pengguna` di dalamnya tidak ikut kena RLS.

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

`super_admin` muncul di klausa `using` semua kebijakan, jadi pemegangnya
bisa **membaca dan menghapus** baris tenant mana pun. Tapi tidak ada di
klausa `with check`, jadi dia **tidak bisa menyisipkan** data ke tenant lain.

Belum ada satu halaman pun yang memakainya. Antarmuka pemilik platform baru
digarap di Fase 5.

Akun `seawise.cc@gmail.com` berperan `pemilik` dengan `super_admin = false`.
Itu disengaja: akun harian sebaiknya tidak memegang kunci ke data semua
pelanggan. Nanti dibuat akun terpisah khusus administrasi platform.

Yang perlu diperketat di Fase 5: hak hapus lintas tenant terlalu longgar
untuk pekerjaan dukungan.

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

---

## Keadaan tiap fase

| Fase | Isi | Status |
|---|---|---|
| 0 | Fondasi, skema, RLS, design system dua tema | Selesai |
| 1 | Gateway, webhook, autentikasi, inbox, kirim manual | Selesai |
| 2 | Mesin balasan AI, impor materi, eskalasi | Selesai |
| 3 | Kampanye keluar, sequence, anti-ban | Selesai |
| 4 | Invoice PDF dan pengirimannya lewat WhatsApp | Selesai |
| 5 | Dasbor pemilik platform, monitoring lintas tenant, billing | Belum |

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

Sekitar **$0,002 per balasan** dengan Haiku 4.5, atau **$2 per seribu
balasan**. Impor dokumen sekitar $0,004 sekali jalan.

Instruksi tetap sudah ditandai untuk prompt caching, tapi materi admin
Seawise baru sekitar 700 token, di bawah ambang minimum cache Haiku, jadi
cache belum pernah kena. Penghematannya berlaku sendiri begitu materinya
bertambah.

---

## Yang perlu diputuskan berikutnya

- **Watermark Fonnte**: paket selain Master dan Ultra menempelkan "Sent via
  fonnte.com" di setiap pesan. Ini menyentuh cara menjual Reflows, bukan
  cuma tampilan.
- **Hak super admin** perlu diperketat sebelum ada tenant kedua.
- **Site URL Supabase** sudah diganti ke domain produksi.
- **Mematikan layanan sudah bisa**, dan terbukti bolak-balik di produksi:
  dijeda, pesan client tetap tercatat tanpa dibalas, dinyalakan lagi, AI
  langsung menjawab dari materi yang sama tanpa satu pun input diulang.
- **Fase 3 sudah jalan**, tapi belum pernah dipakai ke kontak sungguhan.
  Kampanye pertama sebaiknya kecil dulu, sepuluh sampai dua puluh kontak,
  dan hasilnya diperiksa sebelum daftar besar dimasukkan.
- **Identitas invoice belum diisi.** Alamat bisnis dan nomor rekening kosong
  di Pengaturan, jadi PDF yang terbit sekarang tidak memuat cara pembayaran
  dan client harus menanyakannya lagi.
- **Paket langganan** sudah dihitung, ada di `docs/keputusan-produk.md`.
  Mulai Rp 349.000, Tumbuh Rp 749.000, Penuh Rp 1.490.000. Yang belum ada:
  penghitung balasan bulanan dan remnya, tanpa itu kuota cuma janji.
- **Variabel lingkungan Preview** belum diisi, jadi deployment dari branch
  akan gagal. Sengaja: mengisinya berarti preview bisa menulis ke database
  produksi.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run periksa` | Lint, typecheck, periksa-aksi, tes, build |
| `npm run periksa:produksi` | Memeriksa database Supabase sungguhan |
| `npm run uji-webhook` | Uji jalur webhook ujung ke ujung |
| `npm run uji-auth` | Uji sesi dan isolasi antar tenant |
| `npm run uji-kampanye` | Uji antrean kampanye ujung ke ujung |
| `npm run uji-invoice` | Uji penomoran, PDF, dan penyimpanannya |
| `npm run contoh-invoice` | Membuat PDF contoh tanpa menyentuh database |
| `npm run pasang-cron` | Memasang penjadwal antrean di Supabase |
| `npm run periksa-cron` | Memeriksa apakah cron benar-benar memanggil |
| `npm run deploy` | Deploy ke produksi |
| `npm run db:push` | Memasang migrasi ke Supabase |
| `npm run siapkan-tenant` | Mengisi tenant dan materi adminnya |
| `npm run buat-pengguna` | Membuat akun masuk |
| `npm run bersihkan-contoh` | Menghapus kontak percobaan |
| `npm run tenant-aktif` | Melihat, menyuspensi, atau mengaktifkan tenant |

Supabase CLI dijalankan lewat `npm run sb` yang memakai token khusus project
ini dari `.env.local`, supaya login global untuk project Seawise lain tidak
tertimpa.
