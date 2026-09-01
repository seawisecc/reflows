import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Disetel sebelum tes jalan. Modulnya membaca kunci saat dipanggil, bukan
// saat diimpor, jadi impor statis biasa sudah cukup.
process.env.KUNCI_ENKRIPSI = randomBytes(32).toString("base64");

import { dekripsi, enkripsi, samarkan_token } from "@/lib/rahasia";

test("token kembali utuh setelah disandi dan dibuka", () => {
  const token = "abcDEF123-token-fonnte-panjang";
  assert.equal(dekripsi(enkripsi(token)), token);
});

test("dua penyandian token yang sama menghasilkan ciphertext berbeda", () => {
  const token = "token-yang-sama";
  assert.notEqual(
    enkripsi(token),
    enkripsi(token),
    "nonce acak mencegah dua tenant dengan token sama terlihat sama di database",
  );
});

test("ciphertext yang diutak-atik ditolak, bukan menghasilkan token ngawur", () => {
  const tersandi = enkripsi("token-asli");
  const buf = Buffer.from(tersandi, "base64");
  buf[buf.length - 1] ^= 0xff;
  assert.throws(() => dekripsi(buf.toString("base64")));
});

test("data terlalu pendek ditolak dengan pesan yang jelas", () => {
  assert.throws(() => dekripsi("YWJj"), /terlalu pendek/);
});

test("kunci dengan panjang salah ditolak", async () => {
  const simpan = process.env.KUNCI_ENKRIPSI;
  process.env.KUNCI_ENKRIPSI = Buffer.from("terlalu pendek").toString("base64");
  try {
    assert.throws(() => enkripsi("apa saja"), /32 byte/);
  } finally {
    process.env.KUNCI_ENKRIPSI = simpan;
  }
});

test("kunci yang belum diisi ditolak dengan petunjuk", async () => {
  const simpan = process.env.KUNCI_ENKRIPSI;
  delete process.env.KUNCI_ENKRIPSI;
  try {
    assert.throws(() => enkripsi("apa saja"), /KUNCI_ENKRIPSI belum diisi/);
  } finally {
    process.env.KUNCI_ENKRIPSI = simpan;
  }
});

test("token yang disandi dengan kunci lain tidak bisa dibuka", () => {
  const tersandi = enkripsi("token-asli");
  const simpan = process.env.KUNCI_ENKRIPSI;
  process.env.KUNCI_ENKRIPSI = randomBytes(32).toString("base64");
  try {
    assert.throws(() => dekripsi(tersandi));
  } finally {
    process.env.KUNCI_ENKRIPSI = simpan;
  }
});

test("penyamaran token menyisakan ujungnya saja", () => {
  assert.equal(samarkan_token("abcd1234efgh"), "abcd****efgh");
  assert.equal(samarkan_token("pendek"), "******");
});
