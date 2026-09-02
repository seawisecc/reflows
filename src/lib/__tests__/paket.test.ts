import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AMBANG_PERINGATAN,
  izin_kuota,
  PAKET,
  paket_sah,
  tagihan_bulan_ini,
} from "@/lib/paket";

test("tiga paket, semuanya naik kuota dan naik harga", () => {
  const urut = ["mulai", "tumbuh", "penuh"] as const;
  for (let i = 1; i < urut.length; i++) {
    assert.ok(
      PAKET[urut[i]].balasan_ai > PAKET[urut[i - 1]].balasan_ai,
      `${urut[i]} kuotanya tidak lebih besar`,
    );
    assert.ok(
      PAKET[urut[i]].harga_bulanan > PAKET[urut[i - 1]].harga_bulanan,
      `${urut[i]} harganya tidak lebih besar`,
    );
  }
});

test("tarif kelebihan selalu jauh di atas biaya per balasan", () => {
  // Biaya kasar Rp 80 per balasan. Tarif kelebihan yang lebih murah dari itu
  // berarti tenant yang boros justru merugikan Seawise, dan kuota berubah
  // dari pengaman jadi lubang.
  const BIAYA_KASAR = 80;
  for (const [nama, p] of Object.entries(PAKET)) {
    assert.ok(
      p.tarif_kelebihan >= BIAYA_KASAR * 2,
      `${nama} tarif kelebihannya cuma ${p.tarif_kelebihan}`,
    );
  }
});

test("harga paket menutup biaya AI walau kuotanya terpakai habis", () => {
  const BIAYA_KASAR = 80;
  for (const [nama, p] of Object.entries(PAKET)) {
    const biaya = p.balasan_ai * BIAYA_KASAR;
    assert.ok(
      biaya < p.harga_bulanan,
      `${nama} boncos: biaya ${biaya} dari harga ${p.harga_bulanan}`,
    );
  }
});

test("paket yang tidak dikenal ditolak", () => {
  assert.equal(paket_sah("mulai"), true);
  assert.equal(paket_sah("basic"), false);
  assert.equal(paket_sah(null), false);
});

// ---------- Kuota ----------

const AWAL = { paket: "mulai", batas_kelebihan: null } as const;

test("di dalam kuota, AI jalan tanpa peringatan", () => {
  const h = izin_kuota({ ...AWAL, terpakai: 100 });
  assert.equal(h.boleh, true);
  assert.equal(h.sisa, 650);
  assert.equal(h.kelebihan, 0);
  assert.equal(h.peringatan, false);
  assert.equal(h.sebab, null);
});

test("peringatan menyala di 80 persen, bukan setelah habis", () => {
  const tepat = izin_kuota({ ...AWAL, terpakai: Math.ceil(750 * AMBANG_PERINGATAN) });
  assert.equal(tepat.peringatan, true);
  assert.equal(tepat.boleh, true, "peringatan tidak boleh menghentikan AI");

  const belum = izin_kuota({ ...AWAL, terpakai: 500 });
  assert.equal(belum.peringatan, false);
});

test("kuota habis tanpa batas kelebihan tetap membalas, tapi dihitung", () => {
  // Client yang tidak dibalas lebih merugikan tenant daripada tagihan
  // kelebihan yang wajar.
  const h = izin_kuota({ ...AWAL, terpakai: 800 });
  assert.equal(h.boleh, true);
  assert.equal(h.kelebihan, 50);
  assert.equal(h.biaya_kelebihan, 50 * PAKET.mulai.tarif_kelebihan);
});

test("batas kelebihan nol menghentikan AI tepat di kuota", () => {
  const pas = izin_kuota({ paket: "mulai", terpakai: 750, batas_kelebihan: 0 });
  assert.equal(pas.boleh, false);
  assert.match(pas.sebab ?? "", /sudah habis/);

  const kurang = izin_kuota({ paket: "mulai", terpakai: 749, batas_kelebihan: 0 });
  assert.equal(kurang.boleh, true);
});

test("batas kelebihan yang disetel tenant dihormati sampai angkanya", () => {
  const masih = izin_kuota({ paket: "mulai", terpakai: 850, batas_kelebihan: 200 });
  assert.equal(masih.boleh, true);
  assert.equal(masih.kelebihan, 100);

  const mentok = izin_kuota({ paket: "mulai", terpakai: 950, batas_kelebihan: 200 });
  assert.equal(mentok.boleh, false);
});

test("angka terpakai yang aneh tidak membuat sisa jadi negatif", () => {
  const h = izin_kuota({ ...AWAL, terpakai: -50 });
  assert.equal(h.terpakai, 0);
  assert.equal(h.sisa, 750);
  assert.ok(h.sisa >= 0);
});

test("tagihan bulan ini pokok ditambah kelebihan", () => {
  assert.equal(
    tagihan_bulan_ini({ ...AWAL, terpakai: 700 }),
    PAKET.mulai.harga_bulanan,
  );
  assert.equal(
    tagihan_bulan_ini({ ...AWAL, terpakai: 800 }),
    PAKET.mulai.harga_bulanan + 50 * PAKET.mulai.tarif_kelebihan,
  );
});
