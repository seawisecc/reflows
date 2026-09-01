import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dalam_jam_aktif,
  jam_lokal,
  minta_berhenti,
  perlu_eskalasi,
} from "@/lib/aturan";

test("permintaan berhenti dikenali", () => {
  for (const isi of ["STOP", "stop", "Berhenti", "berhenti.", "unsubscribe", "BERHENTI!", "stop ya"]) {
    assert.equal(minta_berhenti(isi), true, `seharusnya opt-out: ${isi}`);
  }
});

test("kalimat panjang yang kebetulan memuat kata stop bukan permintaan berhenti", () => {
  const bukan = [
    "Stop dulu ya, saya mau tanya harga paket yang tadi",
    "Berhenti langganan hosting itu bagaimana caranya ya pak",
    "Boleh minta katalognya",
    "",
  ];
  for (const isi of bukan) {
    assert.equal(minta_berhenti(isi), false, `seharusnya bukan opt-out: ${isi}`);
  }
});

test("permintaan bicara dengan orang dieskalasi", () => {
  const hasil = perlu_eskalasi("Bisa ngobrol langsung sama orangnya?");
  assert.equal(hasil.eskalasi, true);
  assert.equal(
    hasil.eskalasi === true ? hasil.alasan : "",
    "Kontak minta bicara dengan orang",
  );
});

test("kata sensitif dieskalasi dan alasannya disebut", () => {
  const hasil = perlu_eskalasi("Saya mau komplain, hasilnya tidak sesuai");
  assert.equal(hasil.eskalasi, true);
  assert.match(hasil.eskalasi === true ? hasil.alasan : "", /komplain/);
});

test("kata sensitif diperiksa lebih dulu daripada permintaan bicara", () => {
  const hasil = perlu_eskalasi("Saya mau refund, panggilkan adminnya");
  assert.match(hasil.eskalasi === true ? hasil.alasan : "", /refund/);
});

test("pertanyaan biasa tidak dieskalasi", () => {
  for (const isi of [
    "Bikin website katering berapa ya?",
    "Berapa lama pengerjaannya",
    "Boleh lihat portofolionya",
  ]) {
    assert.equal(perlu_eskalasi(isi).eskalasi, false, `seharusnya aman: ${isi}`);
  }
});

test("jam lokal dibaca di zona waktu tenant, bukan zona server", () => {
  const siang_utc = new Date("2026-09-01T05:00:00Z");
  assert.equal(jam_lokal(siang_utc, "Asia/Makassar"), "13:00");
  assert.equal(jam_lokal(siang_utc, "Asia/Jakarta"), "12:00");
  assert.equal(jam_lokal(siang_utc, "Asia/Jayapura"), "14:00");
});

test("jam aktif biasa", () => {
  const zona = "Asia/Makassar";
  const pada = (utc: string) => new Date(utc);
  // 05:00Z sama dengan 13:00 WITA
  assert.equal(dalam_jam_aktif(pada("2026-09-01T05:00:00Z"), "08:00", "20:00", zona), true);
  // 23:00Z sama dengan 07:00 WITA, masih sebelum buka
  assert.equal(dalam_jam_aktif(pada("2026-09-01T23:00:00Z"), "08:00", "20:00", zona), false);
  // 12:00Z sama dengan 20:00 WITA, batas atas tidak termasuk
  assert.equal(dalam_jam_aktif(pada("2026-09-01T12:00:00Z"), "08:00", "20:00", zona), false);
});

test("jam aktif yang melewati tengah malam", () => {
  const zona = "Asia/Makassar";
  // 14:00Z sama dengan 22:00 WITA
  assert.equal(dalam_jam_aktif(new Date("2026-09-01T14:00:00Z"), "20:00", "08:00", zona), true);
  // 22:00Z sama dengan 06:00 WITA
  assert.equal(dalam_jam_aktif(new Date("2026-09-01T22:00:00Z"), "20:00", "08:00", zona), true);
  // 05:00Z sama dengan 13:00 WITA
  assert.equal(dalam_jam_aktif(new Date("2026-09-01T05:00:00Z"), "20:00", "08:00", zona), false);
});

test("jam mulai sama dengan jam selesai berarti buka sehari penuh", () => {
  assert.equal(dalam_jam_aktif(new Date(), "00:00", "00:00"), true);
});

test("jam yang tidak masuk akal tidak mengunci pesan", () => {
  assert.equal(dalam_jam_aktif(new Date(), "bukan jam", "20:00"), true);
});
