import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL, hitung_biaya, model_sah, opsi_penalaran } from "@/lib/ai/model";

test("Haiku ditandai tidak mendukung penalaran adaptif", () => {
  assert.equal(
    MODEL["claude-haiku-4-5"].penalaran_adaptif,
    false,
    "mengirim adaptive thinking ke Haiku menghasilkan galat 400",
  );
});

test("Haiku ditandai tidak mendukung fallback penolakan", () => {
  assert.equal(
    MODEL["claude-haiku-4-5"].fallback_penolakan,
    false,
    "mengirim fallbacks ke Haiku menghasilkan galat 400",
  );
});

test("model keluarga baru mendukung keduanya", () => {
  for (const m of ["claude-sonnet-5", "claude-opus-5"] as const) {
    assert.equal(MODEL[m].penalaran_adaptif, true, m);
    assert.equal(MODEL[m].fallback_penolakan, true, m);
  }
});

test("opsi penalaran kosong untuk model lama", () => {
  assert.deepEqual(opsi_penalaran("claude-haiku-4-5"), {});
});

test("opsi penalaran berisi untuk model baru", () => {
  const opsi = opsi_penalaran("claude-sonnet-5", "low");
  assert.deepEqual(opsi.thinking, { type: "adaptive" });
  assert.deepEqual(opsi.output_config_tambahan, { effort: "low" });
});

test("nama model divalidasi", () => {
  assert.equal(model_sah("claude-haiku-4-5"), true);
  assert.equal(model_sah("claude-haiku-4-5-20251001"), false, "id bertanggal bukan yang dipakai");
  assert.equal(model_sah("gpt-4"), false);
  assert.equal(model_sah(undefined), false);
  assert.equal(model_sah(""), false);
});

test("perhitungan biaya sesuai daftar harga", () => {
  // Haiku: 1 dolar per juta token masuk, 5 dolar per juta keluar.
  assert.equal(hitung_biaya("claude-haiku-4-5", 1_000_000, 0), 1);
  assert.equal(hitung_biaya("claude-haiku-4-5", 0, 1_000_000), 5);
  assert.equal(hitung_biaya("claude-opus-5", 1_000_000, 1_000_000), 30);
});

test("Haiku memang jauh lebih murah dari Opus untuk beban yang sama", () => {
  const beban = { masuk: 2000, keluar: 700 };
  const haiku = hitung_biaya("claude-haiku-4-5", beban.masuk, beban.keluar);
  const opus = hitung_biaya("claude-opus-5", beban.masuk, beban.keluar);
  assert.ok(opus / haiku > 4, `selisihnya cuma ${(opus / haiku).toFixed(1)} kali`);
});
