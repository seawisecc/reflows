import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baca_periode,
  bulan_di_zona,
  label_periode,
  periode_sebelumnya,
  susun_tagihan,
  teks_periode,
} from "@/lib/tagihan";
import { PAKET } from "@/lib/paket";

test("pemakaian di dalam kuota ditagih pokoknya saja", () => {
  const t = susun_tagihan("mulai", 700);
  assert.equal(t.kelebihan, 0);
  assert.equal(t.biaya_kelebihan, 0);
  assert.equal(t.total, PAKET.mulai.harga_bulanan);
});

test("tepat di angka kuota belum menghasilkan kelebihan", () => {
  // Kelebihan bernilai nol baik saat masih di dalam maupun tepat saat
  // habis. Salah satu piksel di sini berarti tenant ditagih satu balasan
  // yang tidak pernah dia pakai.
  const t = susun_tagihan("mulai", PAKET.mulai.balasan_ai);
  assert.equal(t.kelebihan, 0);
  assert.equal(t.total, PAKET.mulai.harga_bulanan);
});

test("lewat kuota ditagih pokok ditambah tarif kelebihan", () => {
  const t = susun_tagihan("mulai", PAKET.mulai.balasan_ai + 50);
  assert.equal(t.kelebihan, 50);
  assert.equal(t.biaya_kelebihan, 50 * PAKET.mulai.tarif_kelebihan);
  assert.equal(t.total, PAKET.mulai.harga_bulanan + 50 * PAKET.mulai.tarif_kelebihan);
});

test("angka paket ikut disalin, bukan ditunjuk", () => {
  // Baris tagihan harus membawa harga dan tarifnya sendiri, supaya
  // menaikkan harga paket bulan depan tidak mengubah tagihan lama.
  const t = susun_tagihan("tumbuh", 3000);
  assert.equal(t.harga_pokok, PAKET.tumbuh.harga_bulanan);
  assert.equal(t.tarif_kelebihan, PAKET.tumbuh.tarif_kelebihan);
  assert.equal(t.kuota, PAKET.tumbuh.balasan_ai);
});

test("batas kelebihan tenant tidak mengurangi yang ditagih", () => {
  // Batas itu rem pemakaian di tengah bulan. Di sini bulannya sudah lewat,
  // dan yang dihitung apa yang benar-benar terpakai.
  const t = susun_tagihan("mulai", 900);
  assert.equal(t.terpakai, 900);
  assert.equal(t.kelebihan, 150);
});

test("pemakaian nol tetap ditagih pokoknya", () => {
  // Langganan, bukan pulsa. Tenant yang sebulan tidak dipakai tetap
  // memegang nomor, materi, dan kontaknya.
  const t = susun_tagihan("penuh", 0);
  assert.equal(t.total, PAKET.penuh.harga_bulanan);
});

test("bulan diambil dari zona tenant, bukan zona server", () => {
  // 1 September 2026 pukul 07.00 WITA masih 31 Agustus di UTC. Memakai
  // zona server berarti menagih bulan yang salah tepat di hari penagihan.
  const saat = new Date("2026-08-31T23:00:00Z");
  assert.deepEqual(bulan_di_zona(saat, "Asia/Makassar"), { tahun: 2026, bulan: 9 });
  assert.deepEqual(bulan_di_zona(saat, "UTC"), { tahun: 2026, bulan: 8 });
});

test("periode sebelumnya menyeberangi tahun dengan benar", () => {
  assert.deepEqual(periode_sebelumnya({ tahun: 2027, bulan: 1 }), {
    tahun: 2026,
    bulan: 12,
  });
  assert.deepEqual(periode_sebelumnya({ tahun: 2026, bulan: 9 }), {
    tahun: 2026,
    bulan: 8,
  });
});

test("periode selalu ditulis sebagai tanggal 1", () => {
  assert.equal(teks_periode({ tahun: 2026, bulan: 8 }), "2026-08-01");
  assert.equal(teks_periode({ tahun: 2026, bulan: 12 }), "2026-12-01");
});

test("periode dibaca dari teks, yang tidak masuk akal ditolak", () => {
  assert.deepEqual(baca_periode("2026-08"), { tahun: 2026, bulan: 8 });
  assert.deepEqual(baca_periode("2026-08-01"), { tahun: 2026, bulan: 8 });
  assert.equal(baca_periode("2026-13"), null);
  assert.equal(baca_periode("2026-00"), null);
  assert.equal(baca_periode("agustus"), null);
  assert.equal(baca_periode(""), null);
});

test("label bulan ditulis sendiri, tidak lewat Intl", () => {
  assert.equal(label_periode({ tahun: 2026, bulan: 8 }), "Agustus 2026");
  assert.equal(label_periode({ tahun: 2026, bulan: 1 }), "Januari 2026");
  assert.equal(label_periode({ tahun: 2026, bulan: 12 }), "Desember 2026");
});
