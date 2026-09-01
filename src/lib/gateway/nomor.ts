/**
 * Normalisasi nomor WhatsApp Indonesia ke bentuk 62xxxxxxxxx.
 *
 * Nomor datang dari mana-mana: diketik manual, diimpor dari spreadsheet,
 * dikirim gateway. Bentuknya bisa 0812, +62 812, 62-812, atau 812 saja.
 * Semua harus jadi satu bentuk, kalau tidak satu orang bisa tersimpan
 * sebagai tiga kontak berbeda.
 */

const PANJANG_MIN = 9; // sisa digit setelah kode negara 62
const PANJANG_MAKS = 13;

export function normalkan_nomor(mentah: string | null | undefined): string | null {
  if (!mentah) return null;

  let teks = String(mentah).trim();

  // Gateway kadang menempelkan akhiran WhatsApp pada nomor.
  const potong = teks.indexOf("@");
  if (potong !== -1) {
    // Grup memakai @g.us dan tidak pernah punya nomor perorangan.
    if (teks.slice(potong).includes("g.us")) return null;
    teks = teks.slice(0, potong);
  }

  // Id grup gaya lama berbentuk 62xxx-1592837465, yaitu nomor pembuat grup
  // dan stempel waktu yang disambung tanda hubung. Yang ditolak hanya pola
  // persis itu. Tanda hubung sebagai pemanis penulisan, misalnya
  // +62 813-3829-1044, tetap diterima karena orang memang menulis begitu.
  if (/^\+?\d{6,}-\d{8,}$/.test(teks.replace(/\s/g, ""))) return null;

  const digit = teks.replace(/\D/g, "");
  if (!digit) return null;

  let inti: string;
  if (digit.startsWith("62")) {
    inti = digit.slice(2);
  } else if (digit.startsWith("0")) {
    inti = digit.replace(/^0+/, "");
  } else if (digit.startsWith("8")) {
    inti = digit;
  } else {
    // Nomor luar negeri dibiarkan apa adanya kalau panjangnya masuk akal,
    // karena client Seawise tidak semuanya di Indonesia.
    return digit.length >= 8 && digit.length <= 15 ? digit : null;
  }

  // Nomor seluler Indonesia selalu mulai dengan 8 setelah kode negara.
  if (!inti.startsWith("8")) return null;
  if (inti.length < PANJANG_MIN || inti.length > PANJANG_MAKS) return null;

  return `62${inti}`;
}

/** Bentuk enak dibaca untuk ditampilkan: +62 812-3456-7890 */
export function tampilkan_nomor(nomor: string): string {
  if (!nomor.startsWith("62")) return `+${nomor}`;
  const inti = nomor.slice(2);
  const bagian = [inti.slice(0, 3), inti.slice(3, 7), inti.slice(7)].filter(Boolean);
  return `+62 ${bagian.join("-")}`;
}

export function nomor_sama(a: string | null, b: string | null): boolean {
  const x = normalkan_nomor(a);
  const y = normalkan_nomor(b);
  return x !== null && x === y;
}
