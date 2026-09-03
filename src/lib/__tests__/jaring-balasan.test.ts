import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALASAN_TAK_TERDUGA,
  dengan_jaring,
  type HasilBalasOtomatis,
} from "@/lib/jaring-balasan";

const KONTEKS = { tenant_id: "tenant-1", percakapan_id: "percakapan-1" };

/** Menahan console selama uji, supaya baris log tidak mengotori keluaran. */
async function tanpa_bising<T>(jalankan: () => Promise<T>): Promise<T> {
  const asli = console.error;
  console.error = () => {};
  try {
    return await jalankan();
  } finally {
    console.error = asli;
  }
}

test("putaran yang berhasil dilewatkan apa adanya", async () => {
  const hasil = await dengan_jaring(
    KONTEKS,
    async () => ({ tindakan: "kirim", alasan: null }) as HasilBalasOtomatis,
    async () => assert.fail("tidak boleh dieskalasi kalau tidak ada yang gagal"),
  );

  assert.equal(hasil.tindakan, "kirim");
});

test("galat tak terduga tidak dilempar ke pemanggil", async () => {
  const hasil = await tanpa_bising(() =>
    dengan_jaring(
      KONTEKS,
      async () => {
        throw new Error("koneksi database putus");
      },
      async () => {},
    ),
  );

  assert.equal(hasil.tindakan, "eskalasi");
  assert.equal(hasil.alasan, ALASAN_TAK_TERDUGA);
});

test("percakapannya dilempar ke manusia, bukan ditinggal berstatus ai", async () => {
  // Ini inti masalahnya. Percakapan yang tetap berstatus ai terlihat persis
  // sama dengan chat yang memang sedang dipegang AI, padahal tidak akan
  // pernah ada yang membalas.
  const dieskalasi: string[] = [];

  await tanpa_bising(() =>
    dengan_jaring(
      KONTEKS,
      async () => {
        throw new Error("koneksi database putus");
      },
      async (alasan) => void dieskalasi.push(alasan),
    ),
  );

  assert.deepEqual(dieskalasi, [ALASAN_TAK_TERDUGA]);
});

test("alasannya bisa dibaca pemilik, bukan pesan galat mentah", async () => {
  assert.ok(!ALASAN_TAK_TERDUGA.includes("Error"));
  assert.ok(ALASAN_TAK_TERDUGA.length > 20);

  const dieskalasi: string[] = [];
  await tanpa_bising(() =>
    dengan_jaring(
      KONTEKS,
      async () => {
        throw new Error("koneksi database putus");
      },
      async (alasan) => void dieskalasi.push(alasan),
    ),
  );

  assert.ok(!dieskalasi[0].includes("koneksi database putus"));
});

test("database yang mati total pun tidak membuatnya melempar", async () => {
  const hasil = await tanpa_bising(() =>
    dengan_jaring(
      KONTEKS,
      async () => {
        throw new Error("koneksi database putus");
      },
      async () => {
        throw new Error("database mati");
      },
    ),
  );

  assert.equal(hasil.tindakan, "eskalasi");
  assert.equal(hasil.alasan, ALASAN_TAK_TERDUGA);
});

test("nilai yang dilempar bukan Error tetap tertangkap", async () => {
  const hasil = await tanpa_bising(() =>
    dengan_jaring(
      KONTEKS,
      async () => {
        throw "cuma teks";
      },
      async () => {},
    ),
  );

  assert.equal(hasil.tindakan, "eskalasi");
});
