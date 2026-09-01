import { test } from "node:test";
import assert from "node:assert/strict";
import { gateway_mock } from "@/lib/gateway/mock";
import { baca_webhook_fonnte, gateway_fonnte } from "@/lib/gateway/fonnte";
import { pilih_gateway } from "@/lib/gateway";

const MUATAN_WAJAR = {
  device: "6281338291000",
  sender: "081338291044",
  name: "Bu Ratna",
  message: "Bikin website katering berapa ya?",
  timestamp: "1788228000",
  inboxid: "80367170",
};

test("muatan webhook wajar terbaca dan nomornya dinormalkan", () => {
  const hasil = baca_webhook_fonnte(MUATAN_WAJAR);
  assert.ok(hasil);
  assert.equal(hasil.nomor_pengirim, "6281338291044");
  assert.equal(hasil.nomor_perangkat, "6281338291000");
  assert.equal(hasil.nama_pengirim, "Bu Ratna");
  assert.equal(hasil.isi, "Bikin website katering berapa ya?");
  assert.equal(hasil.wa_message_id, "80367170");
  assert.equal(hasil.waktu, new Date(1788228000 * 1000).toISOString());
  assert.equal(hasil.lampiran, null);
});

test("pesan grup diabaikan", () => {
  const hasil = baca_webhook_fonnte({ ...MUATAN_WAJAR, member: "6281234567890" });
  assert.equal(hasil, null, "balasan otomatis di grup mengganggu semua anggota");
});

test("muatan tanpa isi dan tanpa lampiran diabaikan", () => {
  assert.equal(baca_webhook_fonnte({ ...MUATAN_WAJAR, message: "" }), null);
  assert.equal(baca_webhook_fonnte({ device: "6281338291000" }), null);
});

test("muatan bukan objek tidak bikin ambruk", () => {
  for (const buruk of [null, undefined, "halo", 42, []]) {
    assert.equal(baca_webhook_fonnte(buruk), null, `gagal pada: ${String(buruk)}`);
  }
});

test("balasan tombol dibaca dari field text", () => {
  const hasil = baca_webhook_fonnte({
    ...MUATAN_WAJAR,
    message: "",
    text: "Ya, lanjut",
  });
  assert.equal(hasil?.isi, "Ya, lanjut");
});

test("lampiran ikut terbaca", () => {
  const hasil = baca_webhook_fonnte({
    ...MUATAN_WAJAR,
    message: "",
    url: "https://contoh.test/brief.pdf",
    filename: "brief",
    extension: "pdf",
  });
  assert.deepEqual(hasil?.lampiran, {
    url: "https://contoh.test/brief.pdf",
    nama: "brief",
    ekstensi: "pdf",
  });
});

test("timestamp kosong atau ngawur diganti waktu sekarang", () => {
  const sebelum = Date.now();
  const hasil = baca_webhook_fonnte({ ...MUATAN_WAJAR, timestamp: "bukan angka" });
  const waktu = new Date(hasil!.waktu).getTime();
  assert.ok(waktu >= sebelum && waktu <= Date.now() + 1000);
});

test("gateway tiruan mencatat pesan tanpa menyentuh jaringan", async () => {
  const g = gateway_mock();
  const hasil = await g.kirim({ ke: "081338291044", isi: "Halo" });
  assert.equal(hasil.ok, true);
  assert.equal(g.terkirim.length, 1);
  assert.equal(g.terkirim[0]?.ke, "6281338291044", "nomor disimpan sudah ternormalkan");
});

test("gateway tiruan menolak nomor tidak sah dan pesan kosong", async () => {
  const g = gateway_mock();
  assert.equal((await g.kirim({ ke: "abc", isi: "Halo" })).ok, false);
  assert.equal((await g.kirim({ ke: "081338291044", isi: "   " })).ok, false);
  assert.equal(g.terkirim.length, 0, "tidak ada yang boleh tercatat saat ditolak");
});

test("pengiriman Fonnte memakai header dan bentuk badan yang benar", async () => {
  const asli = globalThis.fetch;
  let dicatat: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    dicatat = { url, init };
    return new Response(
      JSON.stringify({ status: true, id: ["80367170"], process: "pending" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  try {
    const hasil = await gateway_fonnte("token-uji").kirim({
      ke: "081338291044",
      isi: "Halo Bu Ratna",
    });
    assert.equal(hasil.ok, true);
    assert.equal(hasil.ok === true ? hasil.wa_message_id : null, "80367170");
    assert.ok(dicatat);
    const { url, init } = dicatat as { url: string; init: RequestInit };
    assert.equal(url, "https://api.fonnte.com/send");
    assert.equal(init.method, "POST");
    const kepala = init.headers as Record<string, string>;
    assert.equal(kepala.Authorization, "token-uji", "Fonnte tidak memakai awalan Bearer");
    assert.deepEqual(JSON.parse(String(init.body)), {
      target: "6281338291044",
      message: "Halo Bu Ratna",
    });
  } finally {
    globalThis.fetch = asli;
  }
});

test("penolakan Fonnte diteruskan dengan alasannya", async () => {
  const asli = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ status: false, reason: "token invalid" }), {
      status: 200,
    })) as unknown as typeof fetch;
  try {
    const hasil = await gateway_fonnte("salah").kirim({ ke: "081338291044", isi: "Halo" });
    assert.equal(hasil.ok, false);
    assert.equal(hasil.ok === false ? hasil.alasan : "", "token invalid");
  } finally {
    globalThis.fetch = asli;
  }
});

test("jaringan mati tidak melempar, tapi mengembalikan kegagalan", async () => {
  const asli = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("getaddrinfo ENOTFOUND api.fonnte.com");
  }) as unknown as typeof fetch;
  try {
    const hasil = await gateway_fonnte("token").kirim({ ke: "081338291044", isi: "Halo" });
    assert.equal(hasil.ok, false);
    assert.match(hasil.ok === false ? hasil.alasan : "", /ENOTFOUND/);
  } finally {
    globalThis.fetch = asli;
  }
});

test("tanpa token, penyedia apa pun jatuh ke gateway tiruan", () => {
  assert.equal(pilih_gateway({ gateway: "fonnte", token: null }).nama, "mock");
  assert.equal(pilih_gateway({ gateway: "fonnte", token: "" }).nama, "mock");
  assert.equal(pilih_gateway({ gateway: "fonnte", token: "ada" }).nama, "fonnte");
  assert.equal(pilih_gateway({ gateway: "mock", token: "ada" }).nama, "mock");
});
