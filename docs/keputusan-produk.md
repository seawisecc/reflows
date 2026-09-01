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

## Login WhatsApp

Fonnte menyediakan endpoint `POST https://api.fonnte.com/qr` yang
mengembalikan QR sebagai PNG base64, dan menjawab "device already connect"
kalau nomornya sudah tersambung. Artinya pemindaian QR bisa dilakukan di
dalam Reflows, tenant tidak perlu membuka dasbor Fonnte sama sekali.

Yang tetap harus dilakukan tenant di Fonnte cuma sekali: mendaftar dan
menyalin token perangkatnya.

## Model AI

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
| 2 | Mesin AI, knowledge base, eskalasi | Belum |
| 3 | Outbound: kontak, kampanye, sequence, anti-ban | Belum |
| 4 | Invoice PDF dan pengirimannya lewat WhatsApp | Belum |
| 5 | Dasbor pemilik, monitoring lintas tenant, billing | Belum |
