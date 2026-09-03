import { test } from "node:test";
import assert from "node:assert/strict";
import { catat, catat_galat, saring_rincian, type RincianLog } from "@/lib/log";

/** Menangkap apa yang benar-benar keluar ke console selama satu panggilan. */
function tangkap(jalankan: () => void): string[] {
  const asli_log = console.log;
  const asli_error = console.error;
  const baris: string[] = [];
  console.log = (t: unknown) => void baris.push(String(t));
  console.error = (t: unknown) => void baris.push(String(t));
  try {
    jalankan();
  } finally {
    console.log = asli_log;
    console.error = asli_error;
  }
  return baris;
}

test("kunci di luar daftar tidak pernah terbit, walaupun dipaksa masuk", () => {
  // Ini pertahanan yang sebenarnya. Fitur Inbox Fonnte dimatikan supaya isi
  // chat tidak menginap di server orang lain, dan menuliskannya ke log
  // Vercel membatalkan keputusan itu lewat pintu belakang.
  const nakal = {
    tenant_id: "tenant-1",
    isi: "Halo pak, saya mau tanya harga paket wedding",
    nomor: "6281338291000",
    token: "rahasia-gateway",
  } as unknown as RincianLog;

  const hasil = saring_rincian(nakal);

  assert.deepEqual(Object.keys(hasil), ["tenant_id"]);
  assert.equal(hasil.isi, undefined);
  assert.equal(hasil.nomor, undefined);
  assert.equal(hasil.token, undefined);
});

test("penyaringan itu terjadi saat program jalan, bukan cuma saat dikompilasi", () => {
  const baris = tangkap(() =>
    catat("uji.peristiwa", {
      tenant_id: "tenant-1",
      isi: "harga paket wedding berapa ya",
    } as unknown as RincianLog),
  );

  assert.equal(baris.length, 1);
  assert.ok(!baris[0].includes("wedding"), `isi chat bocor: ${baris[0]}`);
  assert.ok(baris[0].includes("tenant-1"));
});

test("sebab yang kepanjangan dipotong, bukan dibuang", () => {
  const panjang = "x".repeat(500);
  const hasil = saring_rincian({ sebab: panjang });
  const sebab = hasil.sebab as string;

  assert.ok(sebab.length < panjang.length);
  assert.ok(sebab.endsWith("..."));
});

test("barisnya satu, berawalan tetap, dan isinya JSON yang sah", () => {
  const baris = tangkap(() =>
    catat("wa.masuk", { tenant_id: "tenant-1", tindakan: "kirim" }),
  );

  assert.equal(baris.length, 1);
  assert.ok(baris[0].startsWith("[reflows] "));

  const isi = JSON.parse(baris[0].slice("[reflows] ".length));
  assert.equal(isi.peristiwa, "wa.masuk");
  assert.equal(isi.tenant_id, "tenant-1");
  assert.equal(isi.tindakan, "kirim");
});

test("catat_galat menyebut kelas galat dan pesannya", () => {
  const baris = tangkap(() =>
    catat_galat("kampanye.putaran-gagal", new TypeError("token hilang"), {
      kampanye_id: "kmp-1",
    }),
  );

  const isi = JSON.parse(baris[0].slice("[reflows] ".length));
  assert.equal(isi.galat, "TypeError");
  assert.equal(isi.sebab, "token hilang");
  assert.equal(isi.kampanye_id, "kmp-1");
});

test("nilai yang bukan Error tetap tercatat tanpa melempar", () => {
  const baris = tangkap(() => catat_galat("uji.aneh", "cuma teks"));
  const isi = JSON.parse(baris[0].slice("[reflows] ".length));

  assert.equal(isi.galat, "string");
  assert.equal(isi.sebab, "cuma teks");
});

test("log tidak boleh menjatuhkan jalur yang sedang gagal", () => {
  // Nilai melingkar membuat JSON.stringify melempar. Yang memanggil log
  // biasanya sedang menangani kegagalan, jadi log yang ikut melempar
  // menukar satu masalah dengan masalah yang lebih besar.
  const melingkar: Record<string, unknown> = { sebab: "a" };
  melingkar.diri = melingkar;

  assert.doesNotThrow(() =>
    tangkap(() => catat("uji.melingkar", melingkar as RincianLog)),
  );
});
