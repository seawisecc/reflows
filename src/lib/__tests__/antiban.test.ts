import { test } from "node:test";
import assert from "node:assert/strict";
import {
  batas_hari_ke,
  boleh_kirim,
  jeda_acak,
  perlu_direm,
  pilih_varian,
  susun_pesan,
  SAPAAN_CADANGAN,
  type KeadaanKirim,
} from "@/lib/kampanye/antiban";

// ---------- Warm-up ----------

test("hari pertama memakai batas awal apa adanya", () => {
  assert.equal(batas_hari_ke(20, 150, 1), 20);
});

test("batas naik tiap hari tapi tidak pernah melewati maksimum", () => {
  const deret = [1, 2, 3, 4, 5, 6, 7, 8, 9, 30].map((h) =>
    batas_hari_ke(20, 150, h),
  );
  // Naik terus, tidak pernah turun.
  for (let i = 1; i < deret.length; i++) {
    assert.ok(deret[i] >= deret[i - 1], `hari ke-${i + 1} turun: ${deret}`);
  }
  assert.ok(deret.every((n) => n <= 150), `ada yang lewat batas: ${deret}`);
  assert.equal(deret[deret.length - 1], 150, "setelah sebulan harus mentok");
});

test("warm-up tidak melompat ke batas maksimum di minggu pertama", () => {
  // Ini pokoknya. Kalau suatu saat lajunya dinaikkan sampai hari ketiga
  // sudah 150, nomor baru akan kena blokir dan tes ini yang menahannya.
  assert.ok(
    batas_hari_ke(20, 150, 3) < 60,
    `hari ketiga terlalu besar: ${batas_hari_ke(20, 150, 3)}`,
  );
});

test("hari nol atau negatif tetap dianggap hari pertama", () => {
  assert.equal(batas_hari_ke(20, 150, 0), 20);
  assert.equal(batas_hari_ke(20, 150, -5), 20);
});

// ---------- Jeda ----------

test("jeda selalu di dalam rentang, di kedua ujungnya", () => {
  assert.equal(jeda_acak(40, 120, () => 0), 40);
  assert.equal(jeda_acak(40, 120, () => 0.999999), 120);
  for (let i = 0; i < 200; i++) {
    const j = jeda_acak(40, 120);
    assert.ok(j >= 40 && j <= 120, `di luar rentang: ${j}`);
  }
});

test("rentang terbalik tidak menghasilkan jeda negatif", () => {
  const j = jeda_acak(120, 40, () => 0.5);
  assert.ok(j >= 120, `jeda malah mengecil: ${j}`);
});

// ---------- Varian kalimat ----------

test("varian dipilih tetap sama untuk kunci yang sama", () => {
  const v = ["Halo A", "Halo B", "Halo C"];
  assert.equal(pilih_varian(v, "sasaran-1"), pilih_varian(v, "sasaran-1"));
});

test("varian tersebar, tidak semua sasaran dapat kalimat yang sama", () => {
  const v = ["A", "B", "C"];
  const kena = new Set(
    Array.from({ length: 60 }, (_, i) => pilih_varian(v, `sasaran-${i}`)),
  );
  assert.equal(kena.size, 3, `hanya kena ${[...kena].join(", ")}`);
});

test("varian kosong dan spasi doang dibuang", () => {
  assert.equal(pilih_varian(["", "   ", "Halo"], "apa pun"), "Halo");
  assert.equal(pilih_varian([], "apa pun"), "");
});

// ---------- Templat ----------

test("penanda nama dan bisnis terisi", () => {
  const hasil = susun_pesan("Halo {{nama}}, saya dari {{bisnis}}.", {
    nama: "Bu Ratna",
    bisnis: "Seawise Studio",
  });
  assert.equal(hasil, "Halo Bu Ratna, saya dari Seawise Studio.");
});

test("kontak tanpa nama dapat sapaan cadangan, bukan kalimat rusak", () => {
  const hasil = susun_pesan("Halo {{nama}}, apa kabar?", {
    nama: null,
    bisnis: "Seawise Studio",
  });
  assert.equal(hasil, `Halo ${SAPAAN_CADANGAN}, apa kabar?`);
  assert.doesNotMatch(hasil, /\{\{|\}\}/);
});

test("penanda yang tidak dikenal tidak pernah lolos ke pesan", () => {
  // Mengirim "Halo {{nama_depan}}" ke calon client jauh lebih memalukan
  // daripada kehilangan satu kata.
  const hasil = susun_pesan("Halo {{nama_depan}}, promo {{diskon}} nih.", {
    nama: "Ratna",
    bisnis: "Seawise",
  });
  assert.doesNotMatch(hasil, /\{\{|\}\}/, `masih ada penanda: ${hasil}`);
  assert.doesNotMatch(hasil, /  /, `ada spasi ganda: ${hasil}`);
  assert.equal(hasil, "Halo, promo nih.");
});

test("penanda ditulis dengan spasi tetap terbaca", () => {
  assert.equal(
    susun_pesan("Halo {{ nama }}", { nama: "Dimas", bisnis: "X" }),
    "Halo Dimas",
  );
});

// ---------- Rem otomatis ----------

const REM = { rem_min_terkirim: 30, rem_rasio_balas: 0.05 };

test("rem diam selama jumlah pesan masih sedikit", () => {
  // Nol balasan dari lima kontak belum berarti apa-apa.
  assert.deepEqual(perlu_direm({ tersentuh: 5, dibalas: 0, ...REM }), {
    rem: false,
  });
});

test("rem menyala saat rasio balasan anjlok setelah cukup banyak terkirim", () => {
  const h = perlu_direm({ tersentuh: 40, dibalas: 1, ...REM });
  assert.equal(h.rem, true);
  if (h.rem) assert.match(h.alasan, /2\.5 persen/);
});

test("rasio pas di ambang tidak dianggap anjlok", () => {
  assert.deepEqual(perlu_direm({ tersentuh: 40, dibalas: 2, ...REM }), {
    rem: false,
  });
});

test("penyebut rem adalah kontak yang sudah tersentuh, bukan seluruh daftar", () => {
  // Daftar 1000 kontak, baru 20 yang dikirimi, 5 membalas. Rasionya 25
  // persen dan bagus. Kalau penyebutnya 1000, rasionya 0,5 persen dan rem
  // menyala padahal kampanyenya justru berhasil.
  assert.deepEqual(perlu_direm({ tersentuh: 20, dibalas: 5, ...REM }), {
    rem: false,
  });
});

// ---------- Gerbang kirim ----------

const SIANG = new Date("2026-09-02T05:00:00Z"); // 13.00 WITA

function keadaan(ubah: Partial<KeadaanKirim> = {}): KeadaanKirim {
  return {
    status: "jalan",
    sekarang: SIANG,
    jam_mulai: "08:00",
    jam_selesai: "20:00",
    zona_waktu: "Asia/Makassar",
    boleh_kirim_lagi_at: null,
    batas_harian_awal: 20,
    batas_harian_maks: 150,
    hari_ke: 1,
    terkirim_hari_ini: 0,
    antre: 10,
    jumlah_langkah: 2,
    sisa_kuota_tenant: 100,
    ...ubah,
  };
}

test("keadaan wajar boleh mengirim", () => {
  const h = boleh_kirim(keadaan());
  assert.equal(h.kirim, true);
  assert.equal(h.batas_hari_ini, 20);
});

test("kampanye draf, jeda, dan dihentikan tidak pernah mengirim", () => {
  for (const status of ["draf", "jeda", "selesai", "dihentikan"]) {
    const h = boleh_kirim(keadaan({ status }));
    assert.equal(h.kirim, false, `status ${status} malah mengirim`);
    if (!h.kirim) assert.equal(h.jenis, "status");
  }
});

test("di luar jam aktif tidak mengirim", () => {
  // 02.00 WITA, jauh di luar 08.00 sampai 20.00.
  const h = boleh_kirim(
    keadaan({ sekarang: new Date("2026-09-02T18:00:00Z") }),
  );
  assert.equal(h.kirim, false);
  if (!h.kirim) assert.equal(h.jenis, "luar-jam");
});

test("jeda antar pesan dihormati sampai detik terakhir", () => {
  const belum = boleh_kirim(
    keadaan({ boleh_kirim_lagi_at: new Date(SIANG.getTime() + 30_000).toISOString() }),
  );
  assert.equal(belum.kirim, false);
  if (!belum.kirim) assert.equal(belum.jenis, "jeda");

  const sudah = boleh_kirim(
    keadaan({ boleh_kirim_lagi_at: new Date(SIANG.getTime() - 1_000).toISOString() }),
  );
  assert.equal(sudah.kirim, true);
});

test("batas harian warm-up menghentikan pengiriman", () => {
  const h = boleh_kirim(keadaan({ hari_ke: 1, terkirim_hari_ini: 20 }));
  assert.equal(h.kirim, false);
  if (!h.kirim) assert.equal(h.jenis, "batas-harian");

  // Hari kelima batasnya sudah lebih besar, jadi 20 pesan belum mentok.
  assert.equal(boleh_kirim(keadaan({ hari_ke: 5, terkirim_hari_ini: 20 })).kirim, true);
});

test("kuota harian tenant menang atas batas kampanye", () => {
  // Kuota itu milik nomornya, dibagi bersama balasan AI. Kampanye tidak
  // boleh menghabiskannya sampai chat client tidak bisa dibalas.
  const h = boleh_kirim(keadaan({ sisa_kuota_tenant: 0 }));
  assert.equal(h.kirim, false);
  if (!h.kirim) assert.equal(h.jenis, "kuota-tenant");
});

test("kampanye tanpa langkah tidak mengirim apa pun", () => {
  const h = boleh_kirim(keadaan({ jumlah_langkah: 0 }));
  assert.equal(h.kirim, false);
  if (!h.kirim) assert.equal(h.jenis, "tanpa-langkah");
});

test("antrean kosong bukan kegagalan, cuma tidak ada yang dikirim", () => {
  const h = boleh_kirim(keadaan({ antre: 0 }));
  assert.equal(h.kirim, false);
  if (!h.kirim) assert.equal(h.jenis, "antrean-kosong");
});

test("alasan yang dilaporkan selalu yang paling pokok", () => {
  // Dijeda sekaligus di luar jam kerja. Yang berguna disampaikan ke pemilik
  // adalah statusnya, karena itu yang bisa dia ubah sekarang juga.
  const h = boleh_kirim(
    keadaan({ status: "jeda", sekarang: new Date("2026-09-02T18:00:00Z") }),
  );
  assert.equal(h.kirim, false);
  if (!h.kirim) assert.equal(h.jenis, "status");
});
