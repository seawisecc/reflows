import { test } from "node:test";
import assert from "node:assert/strict";
import { boleh_tanpa_sesi } from "@/lib/jalur-terbuka";

test("halaman depan terbuka, karena memang halaman jualan", () => {
  assert.equal(boleh_tanpa_sesi("/"), true);
});

test("halaman depan yang terbuka tidak ikut membuka seluruh aplikasi", () => {
  // Ini ujinya yang paling penting. Menaruh "/" di daftar yang mencocokkan
  // awalan membuat setiap jalur cocok, dan seluruh data pelanggan terbuka
  // tanpa sesi. Tidak ada galat yang muncul saat itu terjadi.
  for (const jalur of [
    "/dasbor",
    "/percakapan",
    "/kontak",
    "/pengaturan",
    "/platform",
    "/invoice/abc",
  ]) {
    assert.equal(boleh_tanpa_sesi(jalur), false, `${jalur} tidak boleh terbuka`);
  }
});

test("webhook dan antrean kampanye terbuka beserta anaknya", () => {
  assert.equal(boleh_tanpa_sesi("/api/wa"), true);
  assert.equal(boleh_tanpa_sesi("/api/wa/masuk/rahasia-panjang"), true);
  assert.equal(boleh_tanpa_sesi("/api/kampanye/jalan"), true);
});

test("gambar merek terbuka supaya crawler tidak kena pengalihan", () => {
  assert.equal(boleh_tanpa_sesi("/opengraph-image"), true);
  assert.equal(boleh_tanpa_sesi("/apple-icon"), true);
});

test("jalur api lain tidak ikut terbuka", () => {
  assert.equal(boleh_tanpa_sesi("/api"), false);
  assert.equal(boleh_tanpa_sesi("/api/rahasia"), false);
});

test("nama yang kebetulan berawalan sama tidak lolos", () => {
  // "/masuk-diam-diam" bukan anak dari "/masuk", cuma berawalan sama.
  assert.equal(boleh_tanpa_sesi("/masuk-diam-diam"), false);
  assert.equal(boleh_tanpa_sesi("/apple-icon-palsu"), false);
});
