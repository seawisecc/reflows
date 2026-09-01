/**
 * Pembacaan tabel dari CSV dan Excel.
 *
 * Spreadsheet yang datang dari pengguna Indonesia hampir selalu punya dua
 * jebakan: pemisah kolomnya titik koma, bukan koma, karena itu bawaan Excel
 * dengan pengaturan wilayah Indonesia. Dan angkanya memakai titik sebagai
 * pemisah ribuan, jadi "4.500.000" itu empat setengah juta, bukan 4,5.
 */

/** Menebak pemisah kolom dari baris pertama yang bukan kosong. */
export function tebak_pemisah(teks: string): "," | ";" | "\t" {
  const baris = teks.split(/\r?\n/).find((b) => b.trim());
  if (!baris) return ",";

  const hitung = (p: string) => (baris.match(new RegExp(`\\${p}`, "g")) ?? []).length;
  const koma = hitung(",");
  const titik_koma = hitung(";");
  const tab = (baris.match(/\t/g) ?? []).length;

  if (tab > koma && tab > titik_koma) return "\t";
  if (titik_koma >= koma && titik_koma > 0) return ";";
  return ",";
}

/**
 * Pembaca CSV yang menghormati tanda kutip, jadi koma dan baris baru di
 * dalam kutipan tidak memecah kolom. Ditulis tangan karena kebutuhannya
 * sesederhana ini dan tidak sepadan dengan menambah satu paket lagi.
 */
export function baca_csv(teks: string, pemisah?: string): string[][] {
  const p = pemisah ?? tebak_pemisah(teks);
  const baris: string[][] = [];
  let sel: string[] = [];
  let nilai = "";
  let dalam_kutip = false;

  const bersih = teks.replace(/^﻿/, ""); // buang penanda urutan byte

  for (let i = 0; i < bersih.length; i++) {
    const c = bersih[i]!;

    if (dalam_kutip) {
      if (c === '"') {
        if (bersih[i + 1] === '"') {
          nilai += '"';
          i++;
        } else {
          dalam_kutip = false;
        }
      } else {
        nilai += c;
      }
      continue;
    }

    if (c === '"') {
      dalam_kutip = true;
    } else if (c === p) {
      sel.push(nilai.trim());
      nilai = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && bersih[i + 1] === "\n") i++;
      sel.push(nilai.trim());
      nilai = "";
      if (sel.some((s) => s !== "")) baris.push(sel);
      sel = [];
    } else {
      nilai += c;
    }
  }

  sel.push(nilai.trim());
  if (sel.some((s) => s !== "")) baris.push(sel);

  return baris;
}

/**
 * Membaca angka rupiah dari teks apa adanya.
 *
 * Bentuk yang harus dikenali: "Rp 4.500.000", "4500000", "Rp4.500.000,00",
 * "4,5 juta", "Rp 12jt". Yang tidak jelas dikembalikan null, karena menebak
 * harga lebih berbahaya daripada mengaku tidak tahu.
 */
export function baca_rupiah(mentah: string): number | null {
  const teks = mentah.toLowerCase().trim();
  if (!teks) return null;

  const pengali = /\b(jt|juta)\b|jt\b/.test(teks)
    ? 1_000_000
    : /\b(rb|ribu|k)\b/.test(teks)
      ? 1_000
      : 1;

  // Ambil gugus angka pertama beserta titik dan komanya.
  const cocok = /(\d[\d.,]*)/.exec(teks);
  if (!cocok?.[1]) return null;
  let angka = cocok[1];

  if (pengali > 1) {
    // Dengan pengali, koma dan titik berperan sebagai koma desimal.
    angka = angka.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const n = Number(angka);
    return Number.isFinite(n) ? Math.round(n * pengali) : null;
  }

  // Tanpa pengali, titik adalah pemisah ribuan dan koma adalah desimal.
  const bagian_koma = angka.split(",");
  let utuh = bagian_koma[0]!.replace(/\./g, "");
  // Bentuk gaya Inggris seperti "4,500,000" juga diterima.
  if (bagian_koma.length > 2) utuh = angka.replace(/[.,]/g, "");

  const n = Number(utuh);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Menyusun tabel jadi teks berbaris supaya mudah dibaca model. */
export function tabel_ke_teks(baris: string[][], maks_baris = 500): string {
  return baris
    .slice(0, maks_baris)
    .map((b) => b.join(" | "))
    .join("\n");
}

/** Membaca berkas Excel jadi baris teks. Semua lembar digabung. */
export async function baca_xlsx(isi: ArrayBuffer): Promise<string[][]> {
  const { default: ExcelJS } = await import("exceljs");
  const buku = new ExcelJS.Workbook();
  await buku.xlsx.load(isi);

  const semua: string[][] = [];
  buku.eachSheet((lembar) => {
    if (semua.length) semua.push([`--- lembar: ${lembar.name} ---`]);
    lembar.eachRow((baris) => {
      const sel: string[] = [];
      baris.eachCell({ includeEmpty: true }, (isi_sel) => {
        const nilai = isi_sel.value;
        if (nilai === null || nilai === undefined) {
          sel.push("");
        } else if (typeof nilai === "object" && "result" in nilai) {
          // Sel rumus: yang berarti hasilnya, bukan rumusnya.
          sel.push(String(nilai.result ?? ""));
        } else if (typeof nilai === "object" && "text" in nilai) {
          sel.push(String(nilai.text ?? ""));
        } else {
          sel.push(String(nilai));
        }
      });
      if (sel.some((s) => s.trim() !== "")) semua.push(sel.map((s) => s.trim()));
    });
  });

  return semua;
}
