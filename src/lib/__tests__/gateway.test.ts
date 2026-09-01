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

test("QR Fonnte dibungkus jadi data URL siap pakai", async () => {
  const asli = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ status: true, url: "iVBORw0KGgoAAAA" }), {
      status: 200,
    })) as unknown as typeof fetch;
  try {
    const hasil = await gateway_fonnte("token").qr();
    assert.equal(hasil.keadaan, "perlu-scan");
    assert.equal(
      hasil.keadaan === "perlu-scan" ? hasil.gambar : "",
      "data:image/png;base64,iVBORw0KGgoAAAA",
    );
  } finally {
    globalThis.fetch = asli;
  }
});

test("awalan data URL tidak dipasang dobel", async () => {
  const asli = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ status: true, url: "data:image/png;base64,iVBORw0KGgo" }),
      { status: 200 },
    )) as unknown as typeof fetch;
  try {
    const hasil = await gateway_fonnte("token").qr();
    assert.equal(
      hasil.keadaan === "perlu-scan" ? hasil.gambar : "",
      "data:image/png;base64,iVBORw0KGgo",
    );
  } finally {
    globalThis.fetch = asli;
  }
});

test("penolakan karena sudah tersambung dibaca sebagai kabar baik", async () => {
  const asli = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ status: false, reason: "device already connect" }),
      { status: 200 },
    )) as unknown as typeof fetch;
  try {
    const hasil = await gateway_fonnte("token").qr();
    assert.equal(
      hasil.keadaan,
      "tersambung",
      "Fonnte menolak memberi QR untuk perangkat yang sudah hidup, dan itu bukan galat",
    );
  } finally {
    globalThis.fetch = asli;
  }
});

test("penolakan lain tetap dilaporkan sebagai gagal beserta alasannya", async () => {
  const asli = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ status: false, reason: "token invalid" }), {
      status: 200,
    })) as unknown as typeof fetch;
  try {
    const hasil = await gateway_fonnte("salah").qr();
    assert.equal(hasil.keadaan, "gagal");
    assert.equal(hasil.keadaan === "gagal" ? hasil.alasan : "", "token invalid");
  } finally {
    globalThis.fetch = asli;
  }
});

test("gateway tiruan selalu mengaku tersambung", async () => {
  assert.equal((await gateway_mock().qr()).keadaan, "tersambung");
});

test("tanpa inboxid, id pesan diturunkan dari isinya", () => {
  const tanpa_id = { ...MUATAN_WAJAR, inboxid: undefined };
  const hasil = baca_webhook_fonnte(tanpa_id);
  assert.ok(hasil, "muatan tanpa inboxid tetap harus terbaca");
  const id = hasil.wa_message_id;
  assert.ok(id !== null, "id pesan tidak boleh kosong");
  assert.ok(id.startsWith("sidik-"));
  assert.equal(id.length, 38, "awalan sidik- ditambah 32 karakter heksadesimal");
});

test("kiriman ulang yang persis sama menghasilkan sidik yang sama", () => {
  const tanpa_id = { ...MUATAN_WAJAR, inboxid: undefined };
  assert.equal(
    baca_webhook_fonnte(tanpa_id)?.wa_message_id,
    baca_webhook_fonnte({ ...tanpa_id })?.wa_message_id,
    "kalau berbeda, kiriman ulang Fonnte akan tersimpan dua kali",
  );
});

test("pesan berbeda menghasilkan sidik berbeda", () => {
  const dasar = { ...MUATAN_WAJAR, inboxid: undefined };
  const sidik = new Set([
    baca_webhook_fonnte(dasar)?.wa_message_id,
    baca_webhook_fonnte({ ...dasar, message: "Pesan lain" })?.wa_message_id,
    baca_webhook_fonnte({ ...dasar, timestamp: "1788228999" })?.wa_message_id,
    baca_webhook_fonnte({ ...dasar, sender: "081338291045" })?.wa_message_id,
  ]);
  assert.equal(sidik.size, 4, "empat kiriman berbeda harus punya empat sidik berbeda");
});

test("inboxid tetap dipakai kalau gateway mengirimkannya", () => {
  assert.equal(baca_webhook_fonnte(MUATAN_WAJAR)?.wa_message_id, "80367170");
});

test("inboxid nol diperlakukan sebagai kosong, bukan sebagai id", () => {
  // Fonnte mengirim inboxid 0 saat fitur Inbox dimatikan. Kalau nilai itu
  // dipakai apa adanya, semua pesan punya id sama dan pesan kedua dan
  // seterusnya dibuang karena dikira kiriman ulang.
  for (const nol of [0, "0", -1, "-1"]) {
    const hasil = baca_webhook_fonnte({ ...MUATAN_WAJAR, inboxid: nol });
    assert.ok(
      hasil?.wa_message_id?.startsWith("sidik-"),
      `inboxid ${JSON.stringify(nol)} seharusnya diabaikan, dapat ${hasil?.wa_message_id}`,
    );
  }
});

test("dua pesan berbeda dengan inboxid nol tetap punya id berbeda", () => {
  const a = baca_webhook_fonnte({ ...MUATAN_WAJAR, inboxid: 0, message: "Halo" });
  const b = baca_webhook_fonnte({
    ...MUATAN_WAJAR,
    inboxid: 0,
    message: "Mau tanya harga",
    timestamp: "1788228999",
  });
  assert.notEqual(
    a?.wa_message_id,
    b?.wa_message_id,
    "kalau sama, pesan kedua client akan hilang tanpa jejak",
  );
});
