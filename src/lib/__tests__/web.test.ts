import { test } from "node:test";
import assert from "node:assert/strict";
import { html_ke_teks, periksa_url } from "@/lib/impor/web";

test("alamat jaringan dalam ditolak", async () => {
  const terlarang = [
    "http://localhost/rahasia",
    "http://127.0.0.1:8080/",
    "http://127.1/",
    "http://0.0.0.0/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://mesin.internal/",
    "http://server.local/",
  ];
  for (const url of terlarang) {
    const hasil = await periksa_url(url);
    assert.equal(hasil.boleh, false, `seharusnya ditolak: ${url}`);
  }
});

test("metadata cloud ditolak, ini yang paling sering diincar", async () => {
  const hasil = await periksa_url("http://169.254.169.254/latest/meta-data/iam/");
  assert.equal(hasil.boleh, false);
  assert.match(hasil.boleh === false ? hasil.alasan : "", /jaringan dalam/);
});

test("skema selain http dan https ditolak", async () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://contoh.test/berkas",
    "gopher://contoh.test/",
    "data:text/html,<h1>halo</h1>",
  ]) {
    const hasil = await periksa_url(url);
    assert.equal(hasil.boleh, false, `seharusnya ditolak: ${url}`);
  }
});

test("masukan yang bukan URL ditolak dengan pesan yang jelas", async () => {
  const hasil = await periksa_url("bukan url sama sekali");
  assert.equal(hasil.boleh, false);
  assert.match(hasil.boleh === false ? hasil.alasan : "", /tidak terbaca/);
});

test("alamat publik yang wajar diterima", async () => {
  const hasil = await periksa_url("https://example.com/layanan");
  assert.equal(hasil.boleh, true, hasil.boleh === false ? hasil.alasan : "");
});

test("skrip dan gaya dibuang seluruhnya, bukan cuma tagnya", () => {
  const html = `
    <html><head><style>.a{color:red}</style></head>
    <body>
      <script>alert('jangan ikut terbaca')</script>
      <h1>Layanan Kami</h1>
      <p>Website mulai Rp 4.500.000</p>
    </body></html>`;
  const teks = html_ke_teks(html);
  assert.ok(!teks.includes("alert"), "isi skrip tidak boleh ikut");
  assert.ok(!teks.includes("color:red"), "isi gaya tidak boleh ikut");
  assert.ok(teks.includes("Layanan Kami"));
  assert.ok(teks.includes("Rp 4.500.000"));
});

test("struktur baris tetap terjaga supaya daftar tidak menyatu", () => {
  const teks = html_ke_teks("<ul><li>Company Profile</li><li>Toko Online</li></ul>");
  assert.deepEqual(teks.split("\n"), ["Company Profile", "Toko Online"]);
});

test("entitas HTML dikembalikan jadi huruf biasa", () => {
  assert.equal(html_ke_teks("<p>Harga &amp; syarat &quot;khusus&quot;</p>"), 'Harga & syarat "khusus"');
  assert.equal(html_ke_teks("<p>a&nbsp;b</p>"), "a b");
});

test("tabel harga tidak menyatu jadi satu kata", () => {
  const teks = html_ke_teks(
    "<table><tr><td>Company Profile</td><td>Rp 4.500.000</td></tr><tr><td>Toko Online</td><td>Rp 9.500.000</td></tr></table>",
  );
  assert.match(teks, /Company Profile\s+Rp 4\.500\.000/);
  assert.match(teks, /Toko Online\s+Rp 9\.500\.000/);
  assert.equal(teks.split("\n").length, 2);
});

test("HTML kosong menghasilkan teks kosong, bukan ambruk", () => {
  assert.equal(html_ke_teks(""), "");
  assert.equal(html_ke_teks("<div></div>"), "");
});
