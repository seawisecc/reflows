import { test } from "node:test";
import assert from "node:assert/strict";
import {
  baca_csv,
  baca_rupiah,
  tabel_ke_teks,
  tebak_pemisah,
} from "@/lib/impor/tabel";

test("pemisah titik koma dikenali, karena itu bawaan Excel Indonesia", () => {
  assert.equal(tebak_pemisah("Layanan;Harga\nWebsite;4500000"), ";");
  assert.equal(tebak_pemisah("Layanan,Harga\nWebsite,4500000"), ",");
  assert.equal(tebak_pemisah("Layanan\tHarga\nWebsite\t4500000"), "\t");
});

test("CSV biasa terbaca", () => {
  const hasil = baca_csv("Layanan,Harga\nCompany Profile,4500000\nToko Online,9500000");
  assert.deepEqual(hasil, [
    ["Layanan", "Harga"],
    ["Company Profile", "4500000"],
    ["Toko Online", "9500000"],
  ]);
});

test("koma di dalam kutipan tidak memecah kolom", () => {
  const hasil = baca_csv('Layanan,Isi\n"Website, lengkap","5 halaman, responsif"');
  assert.deepEqual(hasil[1], ["Website, lengkap", "5 halaman, responsif"]);
});

test("baris baru di dalam kutipan tidak memecah baris", () => {
  const hasil = baca_csv('Judul,Isi\n"Paket A","Baris satu\nBaris dua"');
  assert.equal(hasil.length, 2);
  assert.equal(hasil[1]?.[1], "Baris satu\nBaris dua");
});

test("kutip ganda di dalam kutipan dibaca sebagai satu kutip", () => {
  const hasil = baca_csv('Judul\n"Paket ""Hemat"""');
  assert.equal(hasil[1]?.[0], 'Paket "Hemat"');
});

test("baris kosong dan penanda urutan byte diabaikan", () => {
  const hasil = baca_csv("﻿a,b\n\n\nc,d\n");
  assert.deepEqual(hasil, [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("angka rupiah gaya Indonesia terbaca benar", () => {
  assert.equal(baca_rupiah("Rp 4.500.000"), 4_500_000);
  assert.equal(baca_rupiah("4.500.000"), 4_500_000);
  assert.equal(baca_rupiah("Rp4.500.000,00"), 4_500_000);
  assert.equal(baca_rupiah("12.000.000"), 12_000_000);
  assert.equal(baca_rupiah("500000"), 500_000);
});

test("titik ribuan tidak salah dibaca sebagai desimal", () => {
  assert.equal(
    baca_rupiah("4.500.000"),
    4_500_000,
    "kalau salah, harga jadi 4 rupiah dan itu bencana",
  );
  assert.notEqual(baca_rupiah("4.500.000"), 4.5);
});

test("penulisan singkat juta dan ribu terbaca", () => {
  assert.equal(baca_rupiah("4,5 juta"), 4_500_000);
  assert.equal(baca_rupiah("Rp 12 jt"), 12_000_000);
  assert.equal(baca_rupiah("500 ribu"), 500_000);
});

test("gaya Inggris dengan koma ribuan juga diterima", () => {
  assert.equal(baca_rupiah("4,500,000"), 4_500_000);
});

test("yang tidak jelas dikembalikan null, bukan ditebak", () => {
  for (const buruk of ["", "hubungi kami", "nego", "-", "gratis"]) {
    assert.equal(baca_rupiah(buruk), null, `seharusnya null: ${buruk}`);
  }
});

test("tabel disusun jadi teks berbaris", () => {
  const teks = tabel_ke_teks([
    ["Layanan", "Harga"],
    ["Company Profile", "4500000"],
  ]);
  assert.equal(teks, "Layanan | Harga\nCompany Profile | 4500000");
});

test("tabel raksasa dipotong supaya tidak membanjiri model", () => {
  const banyak = Array.from({ length: 1000 }, (_, i) => [`baris ${i}`]);
  assert.equal(tabel_ke_teks(banyak, 10).split("\n").length, 10);
});
