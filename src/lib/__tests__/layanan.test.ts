import { test } from "node:test";
import assert from "node:assert/strict";
import { izin_layanan, lama_dijeda } from "@/lib/layanan";

test("tenant biasa boleh melakukan semuanya", () => {
  const h = izin_layanan({ aktif: true, dijeda_at: null });
  assert.equal(h.jenis, "menyala");
  assert.equal(h.menyala, true);
  assert.equal(h.balas_ai, true);
  assert.equal(h.kampanye, true);
  assert.equal(h.kirim_manual, true);
  assert.equal(h.sebab, null);
});

test("dijeda sendiri mematikan AI dan kampanye, tapi tidak tombol kirim", () => {
  // Yang menjeda biasanya mau memegang chatnya sendiri dulu. Mematikan
  // tombol kirimnya malah memaksa dia pindah ke WhatsApp biasa, dan
  // riwayatnya terbelah dua.
  const h = izin_layanan({ aktif: true, dijeda_at: "2026-09-01T00:00:00Z" });
  assert.equal(h.jenis, "dijeda");
  assert.equal(h.balas_ai, false);
  assert.equal(h.kampanye, false);
  assert.equal(h.kirim_manual, true);
});

test("disuspensi mematikan semuanya, termasuk kirim manual", () => {
  const h = izin_layanan({ aktif: false, dijeda_at: null });
  assert.equal(h.jenis, "disuspensi");
  assert.equal(h.balas_ai, false);
  assert.equal(h.kampanye, false);
  assert.equal(h.kirim_manual, false);
});

test("suspensi menang atas jeda, bukan sebaliknya", () => {
  // Tenant yang menjeda sendiri lalu disuspensi tidak boleh bisa lepas dari
  // suspensi hanya dengan menyalakan kembali jedanya.
  const h = izin_layanan({ aktif: false, dijeda_at: "2026-09-01T00:00:00Z" });
  assert.equal(h.jenis, "disuspensi");
  assert.equal(h.kirim_manual, false);
});

test("pesan masuk selalu dicatat, apa pun keadaannya", () => {
  // Ini pokoknya. Layanan yang mati boleh berhenti membalas, tapi tidak
  // boleh membuang chat client. Kalau dibuang, menyalakan lagi berarti
  // pemiliknya kehilangan semua yang masuk selama mati.
  for (const k of [
    { aktif: true, dijeda_at: null },
    { aktif: true, dijeda_at: "2026-09-01T00:00:00Z" },
    { aktif: false, dijeda_at: null },
    { aktif: false, dijeda_at: "2026-09-01T00:00:00Z" },
  ]) {
    assert.equal(
      izin_layanan(k).catat_pesan_masuk,
      true,
      `keadaan ${JSON.stringify(k)} membuang pesan masuk`,
    );
  }
});

test("setiap keadaan mati punya sebab yang bisa dibaca orang", () => {
  for (const k of [
    { aktif: true, dijeda_at: "2026-09-01T00:00:00Z" },
    { aktif: false, dijeda_at: null },
  ]) {
    const h = izin_layanan(k);
    assert.ok(h.sebab && h.sebab.length > 20, `sebab terlalu pendek: ${h.sebab}`);
  }
});

test("lama dijeda dihitung dalam hari penuh", () => {
  const sekarang = new Date("2026-09-10T12:00:00Z");
  assert.equal(lama_dijeda("2026-09-01T12:00:00Z", sekarang), 9);
  assert.equal(lama_dijeda("2026-09-10T11:00:00Z", sekarang), 0);
  assert.equal(lama_dijeda(null, sekarang), null);
  assert.equal(lama_dijeda("bukan tanggal", sekarang), null);
});

test("waktu jeda di masa depan tidak menghasilkan angka negatif", () => {
  const sekarang = new Date("2026-09-01T00:00:00Z");
  assert.equal(lama_dijeda("2026-09-05T00:00:00Z", sekarang), 0);
});
