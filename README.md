# Reflows

Otomasi admin WhatsApp: membalas chat client otomatis, mengelola percakapan,
dan nanti mengejar calon client lewat follow-up bertahap.

Latar belakang dan alasan setiap pilihan ada di
[`docs/keputusan-produk.md`](docs/keputusan-produk.md).

## Status

**Fase 0, fondasi.** Antarmuka sudah berdiri dengan data contoh. Belum ada
koneksi ke Supabase maupun gateway WhatsApp, jadi belum ada pesan yang benar
benar terkirim atau diterima.

## Menjalankan

```bash
npm install
cp .env.example .env.local   # boleh dibiarkan kosong selama Fase 0
npm run dev
```

Buka http://localhost:3000, halaman utama langsung mengarah ke `/dasbor`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npm run periksa` | Lint, typecheck, dan build sekaligus |

## Susunan folder

```
src/app/(aplikasi)/   Halaman dasbor, satu folder per menu
src/komponen/ui/      Komponen pixel: tombol, kartu, tabel, lencana, grafik
src/komponen/shell/   Bilah sisi, bilah atas, tombol tema
src/lib/              Utilitas, tema, klien Supabase, data contoh
src/tipe/             Tipe domain
supabase/migrasi/     Skema database dan kebijakan RLS
```

## Tema

Dua tema, keduanya lengkap dan bukan sekadar pembalikan warna:

- **Deep Reef**, gelap, bawaan
- **Sunset Arcade**, terang hangat

Pilihan tema disimpan di localStorage dan dipasang lewat skrip kecil di
`<head>` sebelum halaman dirender, jadi tidak ada kedipan saat memuat.
Menambah tema baru cukup menambahkan satu blok `[data-tema="..."]` di
`src/app/globals.css`, komponen tidak perlu disentuh.

## Database

`supabase/migrasi/0001_skema_awal.sql` berisi skema lengkap beserta Row Level
Security. Setiap tabel bisnis membawa `tenant_id`, dan seluruh kebijakan
bertumpu pada fungsi `public.tenant_saya()`.

Migrasi ini belum pernah dijalankan terhadap Postgres. Jalankan dulu di
proyek Supabase percobaan sebelum dipakai serius.
