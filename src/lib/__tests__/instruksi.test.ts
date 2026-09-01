import { test } from "node:test";
import assert from "node:assert/strict";
import { susun_instruksi } from "@/lib/ai/instruksi";
import type { ButirPengetahuan } from "@/tipe";

function butir(u: Partial<ButirPengetahuan>): ButirPengetahuan {
  return {
    id: Math.random().toString(36),
    tipe: "layanan",
    judul: "Layanan",
    isi: "Keterangan",
    harga: null,
    aktif: true,
    ...u,
  };
}

const CONTOH: ButirPengetahuan[] = [
  butir({ tipe: "layanan", judul: "Website Toko Online", harga: 9_500_000, isi: "Katalog dan keranjang" }),
  butir({ tipe: "layanan", judul: "Company Profile", harga: 4_500_000, isi: "5 halaman" }),
  butir({ tipe: "faq", judul: "Berapa lama?", isi: "10 sampai 14 hari" }),
  butir({ tipe: "gaya", judul: "Gaya", isi: "Santai tapi sopan" }),
  butir({ tipe: "catatan", judul: "Larangan", isi: "Jangan beri diskon" }),
];

test("instruksi memuat semua bagian materi", () => {
  const teks = susun_instruksi("Seawise Studio", CONTOH);
  assert.match(teks, /Seawise Studio/);
  assert.match(teks, /Website Toko Online/);
  assert.match(teks, /Berapa lama\?/);
  assert.match(teks, /Santai tapi sopan/);
  assert.match(teks, /Jangan beri diskon/);
});

test("harga ditulis dalam rupiah yang utuh, bukan angka telanjang", () => {
  const teks = susun_instruksi("Seawise Studio", CONTOH);
  assert.match(teks, /Rp\s?9\.500\.000/);
  assert.match(teks, /Rp\s?4\.500\.000/);
});

test("layanan tanpa harga ditandai supaya tidak ditebak", () => {
  const teks = susun_instruksi("Uji", [butir({ judul: "Konsultasi", harga: null })]);
  assert.match(teks, /harga belum ditentukan, serahkan ke manusia/);
});

test("butir nonaktif tidak ikut", () => {
  const teks = susun_instruksi("Uji", [
    butir({ judul: "Layanan Aktif", harga: 1000 }),
    butir({ judul: "Layanan Nonaktif", harga: 2000, aktif: false }),
  ]);
  assert.match(teks, /Layanan Aktif/);
  assert.doesNotMatch(teks, /Layanan Nonaktif/);
});

test("hasilnya stabil walau urutan masukan diacak", () => {
  const acak = [...CONTOH].reverse();
  assert.equal(
    susun_instruksi("Seawise Studio", CONTOH),
    susun_instruksi("Seawise Studio", acak),
    "urutan yang tidak stabil membatalkan prompt cache setiap balasan",
  );
});

test("tidak ada stempel waktu atau nilai acak di dalamnya", () => {
  const a = susun_instruksi("Seawise Studio", CONTOH);
  const b = susun_instruksi("Seawise Studio", CONTOH);
  assert.equal(a, b, "isi yang berubah tiap panggilan membuat cache tidak pernah kena");
  assert.doesNotMatch(a, /20\d\d-\d\d-\d\d/);
});

test("tanpa materi sama sekali, AI diperintahkan menyerah", () => {
  const teks = susun_instruksi("Bisnis Baru", []);
  assert.match(teks, /belum mengisi daftar layanan/);
  assert.match(teks, /Serahkan\s+semua pertanyaan ke manusia/);
});

test("aturan pokok selalu ada, apa pun materinya", () => {
  for (const materi of [[], CONTOH]) {
    const teks = susun_instruksi("Uji", materi);
    assert.match(teks, /Harga hanya boleh disebut/);
    assert.match(teks, /Jangan pernah memberi diskon/);
  }
});

test("instruksi melarang AI menyanggupi panggilan atau pertemuan", () => {
  const teks = susun_instruksi("Uji", CONTOH);
  assert.match(teks, /minta bicara dengan orang/);
  assert.match(teks, /Serahkan ke\s+manusia/);
});
