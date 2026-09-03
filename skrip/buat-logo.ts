/**
 * Menulis ulang berkas SVG logo dari satu sumber di src/lib/merek.ts.
 *
 * Berkasnya ikut masuk repo supaya favicon tetap terbit tanpa perlu
 * dirender saat permintaan datang. Kalau bentuk logonya diubah, jalankan
 * npm run buat-logo lagi supaya berkas turunannya ikut berubah.
 */
import { writeFileSync } from "node:fs";
import { svg_logo, WARNA_LOGO } from "../src/lib/merek";

const BERKAS: { jalur: string; isi: string; guna: string }[] = [
  {
    jalur: "src/app/icon.svg",
    isi: svg_logo({ alas: WARNA_LOGO.dasar, jarak: 4 }),
    guna: "Favicon. Beralas gelap supaya tetap terbaca di bilah tab terang",
  },
  {
    jalur: "public/logo.svg",
    isi: svg_logo(),
    guna: "Lambang tanpa alas, untuk ditempel di luar aplikasi",
  },
];

for (const berkas of BERKAS) {
  writeFileSync(berkas.jalur, `${berkas.isi}\n`);
  console.log(`  ${berkas.jalur}  ${berkas.guna}`);
}

console.log(`\n${BERKAS.length} berkas logo ditulis ulang.`);
