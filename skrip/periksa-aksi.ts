/**
 * Memastikan berkas Server Action cuma mengekspor fungsi async.
 *
 * Next.js melarang berkas ber-"use server" mengekspor nilai selain fungsi
 * async. Yang berbahaya, pelanggarannya lolos TypeScript dan lolos ESLint,
 * lalu baru meledak saat pengguna menekan tombol di produksi dengan pesan
 * "A server error occurred" yang tidak menjelaskan apa-apa.
 *
 * Kejadian sekali waktu menggarap impor materi, karena itu pemeriksaan ini
 * dibuat dan ikut dijalankan setiap npm run periksa.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Menyusuri src sendiri, bukan lewat fs.globSync, karena tipe Node yang
 *  terpasang belum mengenalnya walaupun runtime-nya sudah mendukung. */
function telusuri(dir: string): string[] {
  const hasil: string[] = [];
  for (const isi of readdirSync(dir, { withFileTypes: true })) {
    const jalur = join(dir, isi.name);
    if (isi.isDirectory()) hasil.push(...telusuri(jalur));
    else if (/\.tsx?$/.test(isi.name)) hasil.push(jalur);
  }
  return hasil;
}

const BERKAS = telusuri("src");

/** Nilai yang boleh: fungsi async, baik deklarasi maupun panah. */
const NILAI_FUNGSI = /^\s*(async\s+)?(function\b|\(|[A-Za-z_$][\w$]*\s*=>)/;

let masalah = 0;

for (const berkas of BERKAS) {
  const isi = readFileSync(berkas, "utf8");
  const baris_awal = isi.split("\n").slice(0, 3).join("\n");
  if (!/^\s*["']use server["']/m.test(baris_awal)) continue;

  const baris = isi.split("\n");
  baris.forEach((teks, i) => {
    // export type dan export interface aman, tipenya hilang saat dikompilasi.
    if (/^export\s+(type|interface)\b/.test(teks)) return;

    const cocok_const = /^export\s+(const|let|var)\s+[\w$]+\s*(:[^=]+)?=\s*(.*)$/.exec(teks);
    if (cocok_const) {
      const nilai = cocok_const[3] ?? "";
      if (!NILAI_FUNGSI.test(nilai)) {
        console.error(
          `  ${berkas}:${i + 1}  mengekspor nilai, bukan fungsi async\n    ${teks.trim()}`,
        );
        masalah++;
      }
      return;
    }

    if (/^export\s+(class|enum)\b/.test(teks)) {
      console.error(`  ${berkas}:${i + 1}  mengekspor class atau enum\n    ${teks.trim()}`);
      masalah++;
    }
  });
}

if (masalah > 0) {
  console.error(
    `\n${masalah} pelanggaran. Pindahkan nilainya ke berkas biasa, lalu impor dari sana.\n`,
  );
  process.exit(1);
}

console.log("Berkas Server Action bersih: semua ekspornya fungsi async.");
