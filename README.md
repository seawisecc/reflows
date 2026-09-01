# Reflows

**https://reflows.seawise.id**

Otomasi admin WhatsApp: membalas chat client otomatis, mengelola percakapan,
dan nanti mengejar calon client lewat follow-up bertahap.

Latar belakang dan alasan setiap pilihan ada di
[`docs/keputusan-produk.md`](docs/keputusan-produk.md).

## Status

**Fase 1, jalur masuk.** Database Supabase sudah tersambung, autentikasi dan
Row Level Security jalan, dan webhook WhatsApp sudah bisa menerima pesan
sungguhan. Gateway masih memakai penyedia tiruan, jadi belum ada pesan yang
benar-benar terkirim keluar.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # boleh dibiarkan kosong selama Fase 0
npm run dev
```

Buka http://localhost:3000, halaman utama langsung mengarah ke `/dasbor`.

## Menyiapkan dari nol

```bash
cp .env.example .env.local        # lalu isi kuncinya
npm run sb -- link --project-ref <ref>
npm run db:push                   # pasang skema
npm run siapkan-tenant            # isi tenant dan materi admin
npm run buat-pengguna -- email@bisnis.com "Nama Lengkap" pemilik
npm run periksa:produksi          # buktikan semuanya benar
```

Docker tidak diperlukan. `skrip/sb.sh` memakai `SUPABASE_ACCESS_TOKEN` dari
`.env.local`, jadi login global Supabase CLI untuk project lain tidak
tertimpa.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npm test` | Tes unit dan uji skema terhadap PostgreSQL lewat PGlite |
| `npm run periksa` | Lint, typecheck, pemeriksa Server Action, tes, dan build |
| `npm run periksa-aksi` | Memastikan berkas Server Action cuma mengekspor fungsi async |
| `npm run periksa:produksi` | Memeriksa database Supabase yang sungguhan |
| `npm run uji-webhook` | Uji jalur webhook dari ujung ke ujung |
| `npm run uji-auth` | Uji sesi pengguna dan isolasi antar tenant |
| `npm run db:push` | Memasang migrasi ke Supabase |
| `npm run siapkan-tenant` | Mengisi tenant Seawise dan materi adminnya |
| `npm run buat-pengguna` | Membuat akun masuk untuk satu tenant |

## Pengujian

Tiga lapis, masing-masing membuktikan hal yang berbeda:

| Lapis | Perintah | Yang dibuktikan |
|---|---|---|
| Unit | `npm test` | Aturan bisnis, tanpa jaringan dan tanpa database |
| Skema | `npm test` | Migrasi dan RLS terhadap PostgreSQL sungguhan lewat PGlite, tanpa Docker |
| Produksi | `npm run periksa:produksi`, `uji-webhook`, `uji-auth` | Perilaku di Supabase yang sungguhan |

Lapis produksi ada karena beberapa kesalahan mustahil terlihat dari uji
lokal. Contohnya `service_role` yang kehilangan hak akses tabel: migrasi
berjalan mulus, uji lokal lolos, tapi semua webhook akan gagal di produksi.

## Susunan folder

```
src/app/(aplikasi)/   Halaman dasbor, satu folder per menu
src/komponen/ui/      Komponen pixel: tombol, kartu, tabel, lencana, grafik
src/komponen/shell/   Bilah sisi, bilah atas, tombol tema
src/lib/              Utilitas, tema, klien Supabase, data contoh
src/tipe/             Tipe domain
supabase/migrations/     Skema database dan kebijakan RLS
```

## Aturan font pixel

Press Start 2P digambar di grid 1/8 em, jadi hurufnya hanya jatuh pas di
piksel layar kalau ukurannya kelipatan 8. Di ukuran lain setiap sisi huruf
terbelah dan teks terlihat berkabut. Ini terukur: jumlah level intensitas
pada render adalah 6 sampai 18 di ukuran kelipatan 8, tapi melonjak jadi 50
sampai 83 di ukuran 9, 11, 12, dan 14.

Karena itu ukuran font pixel tidak pernah ditulis lepas di komponen. Pakai
salah satu dari tiga kelas ini saja:

| Kelas | Ukuran | Untuk |
|---|---|---|
| `pixel-sm` | 8px | Label, lencana, kepala tabel, tombol |
| `pixel-lg` | 16px | Judul halaman dan judul kartu |
| `pixel-xl` | 24px | Angka sorotan, belum terpakai |

Jangan menimpanya dengan `text-[..]` atau `leading-*`, keduanya sudah diatur
kelasnya dan nilai pecahan akan menggeser huruf ke antara piksel.

Teks yang isinya data, misalnya nama kontak, memakai font badan biasa. Font
pixel menyulitkan membaca nama orang.

## Tema

Dua tema, keduanya lengkap dan bukan sekadar pembalikan warna:

- **Deep Reef**, gelap, bawaan
- **Sunset Arcade**, terang hangat

Pilihan tema disimpan di localStorage dan dipasang lewat skrip kecil di
`<head>` sebelum halaman dirender, jadi tidak ada kedipan saat memuat.
Menambah tema baru cukup menambahkan satu blok `[data-tema="..."]` di
`src/app/globals.css`, komponen tidak perlu disentuh.

## Database

`supabase/migrations/20260901000001_skema_awal.sql` berisi skema lengkap beserta Row Level
Security. Setiap tabel bisnis membawa `tenant_id`, dan seluruh kebijakan
bertumpu pada fungsi `public.tenant_saya()`.

Migrasi sudah dijalankan terhadap PostgreSQL sungguhan dan diuji, baik
lewat PGlite secara lokal maupun di project Supabase.

Dua hal yang gampang terlewat dan sudah ditangani:

- `service_role` melewati Row Level Security lewat sifat `bypassrls`, tapi
  itu bukan pengganti hak akses tabel. Keduanya harus diberikan.
- Mencabut hak baca satu kolom tidak menyembunyikan kolom itu selama hak di
  tingkat tabel masih ada. Haknya harus dicabut penuh lalu diberikan lagi
  per kolom.

## Deploy

Aplikasi jalan di Vercel, project `reflows` di tim `seawise`.

```bash
npm run deploy            # ke produksi
npm run deploy:pratinjau  # ke URL pratinjau
```

Variabel lingkungan di Vercel sengaja tidak sama persis dengan `.env.local`:

| Kunci | Production | Preview | Alasan |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ya | ya | Dibutuhkan saat build |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | ya | Dijaga RLS, aman terlihat |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | **tidak** | Melewati semua RLS. URL pratinjau bisa ditebak orang, jadi kunci ini tidak ditaruh di sana |
| `KUNCI_ENKRIPSI` | ya | tidak | Cuma dipakai membuka token gateway di produksi |
| `SUPABASE_ACCESS_TOKEN` | tidak | tidak | Cuma untuk CLI di komputer sendiri |

### Domain

Produksi hidup di **https://reflows.seawise.id**.

Nameserver `seawise.id` ada di cloudhost.id, jadi catatan DNS-nya di sana,
bukan di Vercel:

```
Tipe    CNAME
Nama    reflows
Nilai   557dc94d1e6c43e1.vercel-dns-017.com.
```

Perlu diingat kalau nanti menambah subdomain lagi: Vercel menandai domain
"verified" begitu domain induknya ada di akun, dan itu cuma bukti
kepemilikan. Catatan DNS-nya tetap harus dibuat sendiri, dan propagasinya
bisa perlu belasan menit.

### Webhook di produksi

Alamat webhook yang ditempel ke dasbor Fonnte:

```
https://reflows.seawise.id/api/wa/masuk/<rahasia>
```

Rahasianya bisa disalin dari halaman Pengaturan. Selama aplikasi cuma jalan
di localhost, Fonnte tidak akan pernah bisa mengirim pesan masuk.

### Yang masih perlu disetel manual

Site URL di Supabase masih `http://localhost:3000`. Perlu diganti ke domain
produksi supaya tautan di email pemulihan sandi tidak mengarah ke komputer
sendiri.

## Impor materi

Halaman Pengetahuan bisa menerima PDF, halaman web, CSV, dan Excel. Claude
membacanya sekali menjadi entri terstruktur, pemilik meninjau dan mengoreksi,
baru tersimpan. Dokumen mentah tidak pernah ikut dibaca saat membalas chat.

Pengambilan halaman web adalah permukaan serangan yang serius: alamatnya
ditentukan pengguna, tapi yang mengambil adalah server kita. Karena itu
setiap alamat diperiksa sampai ke nomor IP hasil resolusi DNS, semua rentang
jaringan dalam ditolak termasuk 169.254.169.254 milik metadata cloud, dan
setiap pengalihan diikuti satu per satu dengan pemeriksaan yang sama.

## Keamanan webhook

Fonnte tidak menandatangani webhooknya sama sekali, jadi keaslian permintaan
tidak bisa dibuktikan dari isinya. Pengamanannya dua lapis:

1. Rahasia 64 karakter di jalur URL, satu per tenant, tersimpan di kolom
   `rahasia_webhook` yang tidak bisa dibaca dari browser.
2. Nomor perangkat di muatan harus cocok dengan nomor milik tenant itu.

URL webhooknya dicetak `npm run siapkan-tenant`. Rahasia itu setara kunci.
