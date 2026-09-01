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

Sembilan tabel, semuanya membawa `tenant_id` dan dijaga RLS:
`tenants`, `pengguna`, `pengaturan_tenant`, `pengetahuan`, `kontak`,
`percakapan`, `pesan`, `jalan_ai`, `log_audit`.

Kebijakan RLS bertumpu pada `public.tenant_saya()` yang `SECURITY DEFINER`,
supaya pembacaan tabel `pengguna` di dalamnya tidak ikut kena RLS.

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

---

## Keadaan tiap fase

| Fase | Isi | Status |
|---|---|---|
| 0 | Fondasi, skema, RLS, design system dua tema | Selesai |
| 1 | Gateway, webhook, autentikasi, inbox, kirim manual | Selesai |
| 2 | Mesin balasan AI, impor materi, eskalasi | Selesai |
| 3 | Kampanye keluar, sequence, anti-ban | Belum |
| 4 | Invoice PDF dan pengirimannya lewat WhatsApp | Belum |
| 5 | Dasbor pemilik platform, monitoring lintas tenant, billing | Belum |

### Yang sudah hidup di produksi

Pesan WhatsApp masuk lewat Fonnte, AI menyusun balasan dari materi admin,
lalu mengirimkannya kembali. Terbukti dengan chat sungguhan.

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

- **Fase 3 anti-ban**: warm-up bertahap, jeda acak 40 sampai 120 detik,
  variasi kalimat, berhenti sendiri saat kontak membalas, rem otomatis kalau
  rasio balasan anjlok. Antreannya butuh cron per menit, dan Vercel Hobby
  cuma sekali sehari. Rencana: pg_cron di Supabase memanggil Edge Function.
- **Watermark Fonnte**: paket selain Master dan Ultra menempelkan "Sent via
  fonnte.com" di setiap pesan. Ini menyentuh cara menjual Reflows, bukan
  cuma tampilan.
- **Hak super admin** perlu diperketat sebelum ada tenant kedua.
- **Site URL Supabase** sudah diganti ke domain produksi.

---

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run periksa` | Lint, typecheck, periksa-aksi, tes, build |
| `npm run periksa:produksi` | Memeriksa database Supabase sungguhan |
| `npm run uji-webhook` | Uji jalur webhook ujung ke ujung |
| `npm run uji-auth` | Uji sesi dan isolasi antar tenant |
| `npm run deploy` | Deploy ke produksi |
| `npm run db:push` | Memasang migrasi ke Supabase |
| `npm run siapkan-tenant` | Mengisi tenant dan materi adminnya |
| `npm run buat-pengguna` | Membuat akun masuk |
| `npm run bersihkan-contoh` | Menghapus kontak percobaan |

Supabase CLI dijalankan lewat `npm run sb` yang memakai token khusus project
ini dari `.env.local`, supaya login global untuk project Seawise lain tidak
tertimpa.
