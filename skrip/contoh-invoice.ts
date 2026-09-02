/**
 * Membuat satu invoice contoh sebagai PDF, tanpa menyentuh database.
 *
 * Ada supaya tata letaknya bisa dilihat dan diubah tanpa harus menerbitkan
 * invoice sungguhan ke client. Isinya sengaja berat: deskripsi panjang yang
 * harus dibungkus, jumlah pecahan, diskon, PPN, dan karakter yang tidak ada
 * di font bawaan PDF.
 */
import { writeFileSync } from "node:fs";
import { susun_pdf_invoice } from "../src/lib/invoice/pdf";

const TUJUAN = process.argv[2] ?? "contoh-invoice.pdf";

async function main() {
  const pdf = await susun_pdf_invoice({
    nomor: "INV/2026/0007",
    terbit_at: "2026-09-02",
    jatuh_tempo_at: "2026-09-09",
    penerbit_nama: "Seawise Studio",
    penerbit_alamat: "Jalan Raya Canggu No. 88, Kuta Utara, Badung, Bali 80361",
    penerbit_nomor_wa: "+62 812-3759-7759",
    klien_nama: "Bu Ratna | Katering Sari Rasa",
    klien_nomor_wa: "+62 813-3829-1044",
    bank_nama: "BCA",
    bank_rekening: "7712345678",
    bank_atas_nama: "Agus Yulyastrawan",
    catatan:
      "Pembayaran DP 50 persen sebelum pengerjaan dimulai, sisanya saat serah terima. Revisi maksimal 3 kali di luar perubahan cakupan. Terima kasih sudah mempercayakan pekerjaan ini kepada kami.",
    diskon: 500_000,
    ppn_persen: 11,
    baris: [
      {
        deskripsi:
          "Website Company Profile, 5 halaman dengan desain custom, responsif di ponsel, sudah termasuk domain dan hosting setahun penuh",
        jumlah: 1,
        harga_satuan: 4_500_000,
      },
      {
        deskripsi: "Halaman tambahan di luar paket",
        jumlah: 3,
        harga_satuan: 350_000,
      },
      {
        deskripsi: "Penulisan konten dan pemotretan menu “paket hemat”",
        jumlah: 1.5,
        harga_satuan: 800_000,
      },
      {
        deskripsi: "Pendampingan setelah rilis, per bulan",
        jumlah: 3,
        harga_satuan: 250_000,
      },
    ],
  });

  writeFileSync(TUJUAN, pdf);
  console.log(`\n  ${TUJUAN} dibuat, ${(pdf.length / 1024).toFixed(1)} KB\n`);
}

main().catch((e) => {
  console.error(`\nGagal membuat contoh invoice:\n${e}\n`);
  process.exit(1);
});
