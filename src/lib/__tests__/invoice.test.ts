import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hitung_invoice,
  jatuh_tempo,
  sisa_hari,
  total_baris,
} from "@/lib/invoice/hitung";

const BARIS = [
  { jumlah: 1, harga_satuan: 4_500_000 },
  { jumlah: 2, harga_satuan: 750_000 },
];

test("subtotal menjumlahkan seluruh baris", () => {
  const h = hitung_invoice({ baris: BARIS });
  assert.equal(h.subtotal, 6_000_000);
  assert.equal(h.total, 6_000_000);
});

test("jumlah pecahan dihitung lalu dibulatkan ke rupiah penuh", () => {
  // 1,5 jam kali Rp 333.333 menghasilkan Rp 499.999,5. Menyimpan pecahannya
  // cuma menghasilkan selisih satu rupiah yang membuat orang meragukan
  // seluruh invoicenya.
  assert.equal(total_baris({ jumlah: 1.5, harga_satuan: 333_333 }), 500_000);
  assert.ok(Number.isInteger(total_baris({ jumlah: 1.5, harga_satuan: 333_333 })));
});

test("diskon dipotong sebelum PPN, bukan sesudah", () => {
  // Ini pokoknya. Menghitung PPN dari subtotal penuh lalu memotong diskon
  // menghasilkan pajak atas uang yang tidak pernah ditagih.
  const h = hitung_invoice({ baris: BARIS, diskon: 1_000_000, ppn_persen: 11 });
  assert.equal(h.dasar, 5_000_000);
  assert.equal(h.nilai_ppn, 550_000);
  assert.equal(h.total, 5_550_000);
});

test("diskon tidak pernah melebihi subtotal", () => {
  // Invoice bertotal negatif bukan invoice, dan kalau lolos ke PDF akan
  // terlihat seperti kesalahan sistem di mata client.
  const h = hitung_invoice({ baris: BARIS, diskon: 99_000_000 });
  assert.equal(h.diskon, 6_000_000);
  assert.equal(h.total, 0);
  assert.ok(h.total >= 0);
});

test("diskon negatif diabaikan, tidak malah menambah tagihan", () => {
  const h = hitung_invoice({ baris: BARIS, diskon: -500_000 });
  assert.equal(h.diskon, 0);
  assert.equal(h.total, 6_000_000);
});

test("PPN nol berarti tidak ada baris pajak sama sekali", () => {
  const h = hitung_invoice({ baris: BARIS, ppn_persen: 0 });
  assert.equal(h.nilai_ppn, 0);
  assert.equal(h.total, h.subtotal);
});

test("PPN 11 dan 12 persen keduanya menghasilkan bilangan bulat", () => {
  for (const persen of [11, 12]) {
    const h = hitung_invoice({ baris: [{ jumlah: 1, harga_satuan: 1_234_567 }], ppn_persen: persen });
    assert.ok(Number.isInteger(h.nilai_ppn), `ppn ${persen} pecahan: ${h.nilai_ppn}`);
    assert.ok(Number.isInteger(h.total), `total ${persen} pecahan: ${h.total}`);
  }
});

test("baris dengan jumlah nol atau harga negatif tidak menambah apa pun", () => {
  assert.equal(total_baris({ jumlah: 0, harga_satuan: 100_000 }), 0);
  assert.equal(total_baris({ jumlah: -3, harga_satuan: 100_000 }), 0);
  assert.equal(total_baris({ jumlah: 1, harga_satuan: -100_000 }), 0);
});

test("angka yang tidak masuk akal tidak membuat total jadi NaN", () => {
  // Nilai dari formulir bisa apa saja. Total NaN yang lolos ke PDF jauh
  // lebih memalukan daripada angka nol.
  const h = hitung_invoice({
    baris: [{ jumlah: Number.NaN, harga_satuan: 1000 }],
    diskon: Number.NaN,
    ppn_persen: Number.NaN,
  });
  assert.equal(h.total, 0);
  assert.ok(Number.isFinite(h.total));
});

test("invoice tanpa baris totalnya nol, bukan galat", () => {
  const h = hitung_invoice({ baris: [] });
  assert.equal(h.subtotal, 0);
  assert.equal(h.total, 0);
});

test("jatuh tempo dihitung dari tanggal terbit", () => {
  assert.equal(jatuh_tempo("2026-09-02", 7), "2026-09-09");
  assert.equal(jatuh_tempo("2026-09-02", 0), "2026-09-02");
});

test("jatuh tempo menyeberangi pergantian bulan dan tahun", () => {
  assert.equal(jatuh_tempo("2026-01-28", 5), "2026-02-02");
  assert.equal(jatuh_tempo("2026-12-28", 7), "2027-01-04");
});

test("sisa hari negatif kalau sudah lewat tempo", () => {
  const sekarang = new Date("2026-09-10T05:00:00Z");
  assert.equal(sisa_hari("2026-09-15", sekarang), 5);
  assert.equal(sisa_hari("2026-09-10", sekarang), 0);
  assert.equal(sisa_hari("2026-09-03", sekarang), -7);
});

// ---------- Penulisan angka dan teks untuk PDF ----------
import { aman, jumlah_pdf, rupiah_pdf, tanggal_pdf } from "@/lib/invoice/pdf";

test("rupiah ditulis dengan pemisah ribuan titik", () => {
  assert.equal(rupiah_pdf(4_500_000), "Rp 4.500.000");
  assert.equal(rupiah_pdf(0), "Rp 0");
  assert.equal(rupiah_pdf(999), "Rp 999");
  assert.equal(rupiah_pdf(1_000), "Rp 1.000");
});

test("rupiah tidak memakai spasi tak terputus", () => {
  // Intl menyisipkan U+00A0 setelah "Rp" dan bentuknya berubah antar versi
  // Node. Format invoice tidak boleh ikut berubah karena runtimenya
  // diperbarui, jadi penulisannya sengaja tidak lewat Intl.
  assert.doesNotMatch(rupiah_pdf(1_000_000), / /);
  assert.equal(rupiah_pdf(1_000_000), "Rp 1.000.000");
});

test("nilai yang bukan angka tidak menghasilkan NaN di PDF", () => {
  assert.equal(rupiah_pdf(Number.NaN), "Rp 0");
  assert.equal(jumlah_pdf(Number.NaN), "0");
});

test("tanggal ditulis dalam bahasa Indonesia", () => {
  assert.equal(tanggal_pdf("2026-09-02"), "2 September 2026");
  assert.equal(tanggal_pdf("2026-01-31"), "31 Januari 2026");
});

test("jumlah bulat ditulis tanpa desimal, yang pecahan pakai koma", () => {
  assert.equal(jumlah_pdf(2), "2");
  assert.equal(jumlah_pdf(1.5), "1,50");
});

test("karakter di luar jangkauan font PDF dibersihkan, bukan melempar galat", () => {
  // Teks yang ditempel orang dari aplikasi lain sering membawa tanda kutip
  // melengkung dan emoji. Kalau lolos apa adanya, pdf-lib melempar galat dan
  // invoicenya gagal terbit tepat saat mau dikirim ke client.
  assert.equal(
    aman("\u201CWebsite\u201D \u2013 paket hemat"),
    '"Website" - paket hemat',
  );
  assert.equal(aman("Terima kasih 🙏"), "Terima kasih ");
  assert.doesNotMatch(aman("Halo 世界"), /[Ā-￿]/);
});

test("huruf beraksen bahasa Indonesia tetap utuh", () => {
  assert.equal(aman("Kafe Doré"), "Kafe Doré");
});
