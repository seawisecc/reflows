import { test } from "node:test";
import assert from "node:assert/strict";
import { rincian_paket, URUTAN_PAKET, PAKET_DISARANKAN } from "@/lib/depan";
import { PAKET } from "@/lib/paket";

test("halaman depan menampilkan semua paket yang ada, tidak kurang", () => {
  // Paket baru yang ditambahkan di paket.ts tapi lupa dimasukkan ke urutan
  // ini tidak akan pernah muncul di halaman jualan, dan tidak ada yang
  // memberi tahu.
  assert.deepEqual([...URUTAN_PAKET].sort(), Object.keys(PAKET).sort());
});

test("paket yang disarankan memang ada", () => {
  assert.ok(PAKET_DISARANKAN in PAKET);
});

test("angka di brosur diambil dari tabel yang dipakai mesin", () => {
  // Kalau angkanya ditulis ulang dengan tangan, suatu saat brosur
  // menjanjikan lebih banyak daripada yang mesin izinkan, dan yang
  // menanggung selisihnya pelanggan yang sudah bayar.
  const baris = rincian_paket("mulai");
  const balasan = baris.find((b) => b.label === "Balasan AI");

  assert.ok(balasan);
  assert.ok(balasan.nilai.includes(String(PAKET.mulai.balasan_ai)));
});

test("impor tanpa batas ditulis apa adanya, bukan angka null", () => {
  const baris = rincian_paket("penuh");
  const impor = baris.find((b) => b.label === "Impor dokumen");

  assert.equal(PAKET.penuh.impor_dokumen, null);
  assert.equal(impor?.nilai, "Tanpa batas");
});

test("kampanye yang tidak termasuk paket tidak ditulis sebagai nol", () => {
  // "0 per bulan" terbaca seperti fitur yang ada tapi kuotanya habis.
  // Yang benar: paket Mulai memang tidak menjual kampanye sama sekali.
  const baris = rincian_paket("mulai");
  const kampanye = baris.find((b) => b.label === "Pesan kampanye");

  assert.equal(PAKET.mulai.pesan_kampanye, 0);
  assert.equal(kampanye?.nilai, "Tidak termasuk");
});

test("tiap paket menjelaskan baris yang sama, supaya bisa dibandingkan", () => {
  const label = URUTAN_PAKET.map((n) => rincian_paket(n).map((b) => b.label));
  for (const daftar of label) assert.deepEqual(daftar, label[0]);
});
