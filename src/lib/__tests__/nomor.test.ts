import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalkan_nomor,
  nomor_sama,
  tampilkan_nomor,
} from "@/lib/gateway/nomor";

test("bentuk nomor Indonesia yang lazim jadi satu bentuk", () => {
  const sama = [
    "081338291044",
    "6281338291044",
    "+6281338291044",
    "+62 813-3829-1044",
    "62 813 3829 1044",
    "81338291044",
    "6281338291044@s.whatsapp.net",
    "  081338291044  ",
  ];
  for (const bentuk of sama) {
    assert.equal(normalkan_nomor(bentuk), "6281338291044", `gagal pada: ${bentuk}`);
  }
});

test("nol di depan tidak menempel jadi 620", () => {
  assert.equal(normalkan_nomor("08123456789"), "628123456789");
  assert.ok(!normalkan_nomor("08123456789")?.startsWith("620"));
});

test("id grup ditolak", () => {
  assert.equal(normalkan_nomor("6281338291044-1592837465@g.us"), null);
  assert.equal(normalkan_nomor("120363012345678901@g.us"), null);
  assert.equal(normalkan_nomor("6281338291044-1592837465"), null);
});

test("masukan sampah ditolak", () => {
  for (const buruk of ["", "   ", "abc", "62", "0", null, undefined, "6212345"]) {
    assert.equal(normalkan_nomor(buruk), null, `seharusnya ditolak: ${buruk}`);
  }
});

test("nomor Indonesia wajib mulai 8 setelah kode negara", () => {
  assert.equal(normalkan_nomor("62211234567"), null, "nomor rumah Jakarta bukan WhatsApp seluler");
});

test("nomor luar negeri dibiarkan apa adanya", () => {
  assert.equal(normalkan_nomor("+61412345678"), "61412345678");
  assert.equal(normalkan_nomor("+1 415 555 0132"), "14155550132");
});

test("panjang di luar batas ditolak", () => {
  assert.equal(normalkan_nomor("6281"), null);
  assert.equal(normalkan_nomor("628123456789012345"), null);
});

test("nomor_sama membandingkan setelah dinormalkan", () => {
  assert.equal(nomor_sama("081338291044", "+62 813-3829-1044"), true);
  assert.equal(nomor_sama("081338291044", "081338291045"), false);
  assert.equal(nomor_sama(null, null), false, "dua nomor kosong bukan berarti sama");
});

test("tampilan nomor enak dibaca", () => {
  assert.equal(tampilkan_nomor("6281338291044"), "+62 813-3829-1044");
});

test("kode negara 999 yang dicadangkan ITU tetap terbaca sebagai nomor", () => {
  // Dipakai skrip uji supaya balasan otomatis tidak pernah nyasar ke orang
  // sungguhan. Harus lolos normalisasi, tapi tidak akan bisa dikirimi.
  assert.equal(normalkan_nomor("9991234567"), "9991234567");
});
