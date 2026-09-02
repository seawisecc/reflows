import { test } from "node:test";
import assert from "node:assert/strict";
import { terima_pesan } from "@/lib/penerimaan";
import { gudang_memori, TENANT_UJI } from "./gudang-memori";
import type { PesanMasuk } from "@/lib/gateway";

const SIANG = new Date("2026-09-01T05:00:00Z"); // 13:00 WITA, dalam jam kerja
const MALAM = new Date("2026-09-01T15:00:00Z"); // 23:00 WITA, di luar jam kerja

function pesan(ubah: Partial<PesanMasuk> = {}): PesanMasuk {
  return {
    nomor_pengirim: "6281338291044",
    nama_pengirim: "Bu Ratna",
    isi: "Bikin website katering berapa ya?",
    nomor_perangkat: "6281338291000",
    wa_message_id: "wa-1",
    waktu: SIANG.toISOString(),
    lampiran: null,
    ...ubah,
  };
}

test("rahasia webhook yang salah ditolak sebelum menyentuh data", async () => {
  const { gudang, pesan: tersimpan } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: "tebakan-ngawur",
    pesan: pesan(),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis, "ditolak");
  assert.equal(tersimpan.length, 0, "tidak boleh ada yang tersimpan");
});

test("pesan ke nomor perangkat lain ditolak walau rahasianya benar", async () => {
  const { gudang, rahasia_benar, pesan: tersimpan } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ nomor_perangkat: "6289999999999" }),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis, "ditolak");
  assert.match(
    hasil.jenis === "ditolak" ? hasil.sebab : "",
    /nomor perangkat/,
  );
  assert.equal(tersimpan.length, 0);
});

test("pesan wajar tersimpan dan percakapan tetap dipegang AI", async () => {
  const { gudang, rahasia_benar, pesan: tersimpan } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan(),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis, "tersimpan");
  if (hasil.jenis !== "tersimpan") return;
  assert.equal(hasil.status, "ai");
  assert.equal(hasil.alasan_eskalasi, null);
  assert.equal(hasil.balasan_otomatis, null);
  assert.equal(tersimpan.length, 1);
});

test("webhook yang dikirim dua kali tidak menyimpan pesan dobel", async () => {
  const { gudang, rahasia_benar, pesan: tersimpan } = gudang_memori();
  const kirim = () =>
    terima_pesan(gudang, { rahasia: rahasia_benar, pesan: pesan(), sekarang: SIANG });

  const pertama = await kirim();
  const kedua = await kirim();

  assert.equal(pertama.jenis, "tersimpan");
  assert.equal(kedua.jenis, "dobel");
  assert.equal(tersimpan.length, 1, "hanya satu pesan yang boleh tercatat");
});

test("dua pesan berbeda dari kontak yang sama masuk ke satu percakapan", async () => {
  const { gudang, rahasia_benar, percakapan, kontak } = gudang_memori();
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-1" }),
    sekarang: SIANG,
  });
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-2", isi: "Halo?" }),
    sekarang: SIANG,
  });
  assert.equal(kontak.size, 1);
  assert.equal(percakapan.size, 1);
});

test("nomor dengan penulisan berbeda tetap satu kontak", async () => {
  const { gudang, rahasia_benar, kontak } = gudang_memori();
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-1", nomor_pengirim: "6281338291044" }),
    sekarang: SIANG,
  });
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-2", nomor_pengirim: "6281338291044" }),
    sekarang: SIANG,
  });
  assert.equal(kontak.size, 1);
});

test("permintaan berhenti menutup percakapan dan tidak dibalas apa pun", async () => {
  const { gudang, rahasia_benar, kontak } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ isi: "STOP" }),
    sekarang: MALAM,
  });
  assert.equal(hasil.jenis, "tersimpan");
  if (hasil.jenis !== "tersimpan") return;
  assert.equal(hasil.opt_out, true);
  assert.equal(hasil.status, "selesai");
  assert.equal(
    hasil.balasan_otomatis,
    null,
    "membalas orang yang minta berhenti justru memperburuk",
  );
  assert.ok([...kontak.values()][0]?.opt_out_at, "waktu opt-out harus tercatat");
});

test("kata sensitif melempar percakapan ke manusia", async () => {
  const { gudang, rahasia_benar } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ isi: "Saya mau komplain, hasilnya tidak sesuai" }),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis === "tersimpan" && hasil.status, "manual");
  assert.match(
    hasil.jenis === "tersimpan" ? (hasil.alasan_eskalasi ?? "") : "",
    /komplain/,
  );
});

test("mode draf membuat semua percakapan menunggu manusia", async () => {
  const { gudang, rahasia_benar } = gudang_memori({
    ...TENANT_UJI,
    mode_balas: "draf",
  });
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan(),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis === "tersimpan" && hasil.status, "manual");
});

test("di luar jam kerja kontak diberi kabar, tapi hanya sekali", async () => {
  const { gudang, rahasia_benar } = gudang_memori();

  const pertama = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-1" }),
    sekarang: MALAM,
  });
  assert.equal(
    pertama.jenis === "tersimpan" ? pertama.balasan_otomatis : null,
    TENANT_UJI.pesan_di_luar_jam,
  );

  const kedua = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-2", isi: "Halo?" }),
    sekarang: new Date(MALAM.getTime() + 5 * 60_000),
  });
  assert.equal(
    kedua.jenis === "tersimpan" ? kedua.balasan_otomatis : "belum diperiksa",
    null,
    "lima pesan jam sebelas malam tidak boleh dibalas lima kali",
  );
});

test("pemberitahuan luar jam boleh diulang di malam berikutnya", async () => {
  const { gudang, rahasia_benar } = gudang_memori();
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-1" }),
    sekarang: MALAM,
  });
  // Sengaja 24 jam, bukan 13. Tiga belas jam setelah pukul 23.00 sudah
  // masuk jam kerja lagi, jadi tidak akan ada pemberitahuan apa pun.
  const besoknya = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-2" }),
    sekarang: new Date(MALAM.getTime() + 24 * 3600_000),
  });
  assert.equal(
    besoknya.jenis === "tersimpan" ? besoknya.balasan_otomatis : null,
    TENANT_UJI.pesan_di_luar_jam,
  );
});

test("dalam jam kerja tidak ada balasan otomatis", async () => {
  const { gudang, rahasia_benar } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan(),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis === "tersimpan" ? hasil.balasan_otomatis : "x", null);
});

test("percakapan yang sudah selesai hidup lagi saat ada pesan baru", async () => {
  const { gudang, rahasia_benar, percakapan } = gudang_memori();
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-1", isi: "Terima kasih ya" }),
    sekarang: SIANG,
  });
  const id = [...percakapan.keys()][0]!;
  await gudang.ubah_status_percakapan(id, "selesai", null);

  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-2", isi: "Eh, mau tanya lagi" }),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis === "tersimpan" && hasil.status, "ai");
});

test("pesan tanpa id gateway tetap tersimpan, tidak dianggap dobel", async () => {
  const { gudang, rahasia_benar, pesan: tersimpan } = gudang_memori();
  for (const isi of ["Halo", "Masih di sana?"]) {
    const hasil = await terima_pesan(gudang, {
      rahasia: rahasia_benar,
      pesan: pesan({ wa_message_id: null, isi }),
      sekarang: SIANG,
    });
    assert.equal(hasil.jenis, "tersimpan");
  }
  assert.equal(tersimpan.length, 2);
});

// ---------- Kampanye berhenti begitu kontak membalas ----------

test("balasan kontak menghentikan sequence kampanye yang mengantre", async () => {
  const { gudang, rahasia_benar, daftarkan_sasaran, sasaran } = gudang_memori();

  // Kontak dibuat lebih dulu lewat satu pesan, lalu didaftarkan ke kampanye.
  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-awal" }),
    sekarang: SIANG,
  });
  daftarkan_sasaran("kontak-1", 2);

  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ isi: "Oh boleh, minta detailnya dong", wa_message_id: "wa-2" }),
    sekarang: SIANG,
  });

  assert.equal(hasil.jenis, "tersimpan");
  if (hasil.jenis !== "tersimpan") return;
  assert.equal(hasil.kampanye_dihentikan, 2);
  assert.equal(sasaran.get("kontak-1")?.antre, 0);
  assert.equal(sasaran.get("kontak-1")?.alasan, "Kontak membalas");
});

test("permintaan berhenti mencatat alasan yang berbeda dari sekadar membalas", async () => {
  // Bedanya penting saat menilai kampanye. Kontak yang membalas itu hasil
  // bagus, kontak yang minta berhenti itu hasil buruk, dan keduanya
  // sama-sama membuat sequence berhenti.
  const { gudang, rahasia_benar, daftarkan_sasaran, sasaran } = gudang_memori();

  await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ wa_message_id: "wa-awal" }),
    sekarang: SIANG,
  });
  daftarkan_sasaran("kontak-1", 3);

  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan({ isi: "STOP", wa_message_id: "wa-stop" }),
    sekarang: SIANG,
  });

  assert.equal(hasil.jenis, "tersimpan");
  if (hasil.jenis !== "tersimpan") return;
  assert.equal(hasil.opt_out, true);
  assert.equal(hasil.kampanye_dihentikan, 3);
  assert.equal(sasaran.get("kontak-1")?.alasan, "Kontak minta berhenti dihubungi");
});

test("kontak tanpa kampanye apa pun tidak terganggu", async () => {
  const { gudang, rahasia_benar } = gudang_memori();
  const hasil = await terima_pesan(gudang, {
    rahasia: rahasia_benar,
    pesan: pesan(),
    sekarang: SIANG,
  });
  assert.equal(hasil.jenis, "tersimpan");
  if (hasil.jenis !== "tersimpan") return;
  assert.equal(hasil.kampanye_dihentikan, 0);
});
