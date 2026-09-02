/**
 * Aritmetika invoice.
 *
 * Fungsi murni tanpa akses database, karena angka yang sama harus keluar di
 * tiga tempat: layar penyusun, PDF yang dikirim ke client, dan kolom total
 * yang tersimpan. Kalau masing-masing menghitung sendiri, suatu saat PDF
 * yang sudah sampai ke client berbeda dari yang tercatat di sistem, dan
 * tidak ada cara membuktikan mana yang benar.
 *
 * Semua nilai rupiah bilangan bulat. Rupiah tidak punya pecahan yang dipakai
 * sehari-hari, dan menyimpan sen cuma menghasilkan selisih satu rupiah yang
 * membuat orang meragukan seluruh invoicenya.
 */

export type BarisHitung = {
  /** Boleh pecahan, misalnya 1,5 jam kerja. */
  jumlah: number;
  harga_satuan: number;
};

export type HasilHitung = {
  subtotal: number;
  diskon: number;
  /** Subtotal dikurangi diskon. Ini yang dikenai PPN. */
  dasar: number;
  ppn_persen: number;
  nilai_ppn: number;
  total: number;
};

/** Pembulatan setengah ke atas, sama seperti kebiasaan orang menghitung. */
function bulat(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.round(nilai);
}

export function total_baris(baris: BarisHitung): number {
  const jumlah = Number(baris.jumlah);
  const harga = Number(baris.harga_satuan);
  if (!Number.isFinite(jumlah) || !Number.isFinite(harga)) return 0;
  if (jumlah <= 0 || harga < 0) return 0;
  return bulat(jumlah * harga);
}

/**
 * Menghitung seluruh invoice.
 *
 * Urutannya penting dan tidak boleh dibalik: diskon dipotong lebih dulu,
 * baru PPN dihitung dari sisanya. Menghitung PPN dari subtotal penuh lalu
 * memotong diskon menghasilkan pajak atas uang yang tidak pernah ditagih.
 *
 * Diskon dijepit supaya tidak melebihi subtotal. Invoice bertotal negatif
 * bukan invoice, dan kalau lolos ke PDF akan terlihat seperti kesalahan
 * sistem di mata client.
 */
export function hitung_invoice(masukan: {
  baris: BarisHitung[];
  diskon?: number;
  ppn_persen?: number;
}): HasilHitung {
  const subtotal = masukan.baris.reduce((n, b) => n + total_baris(b), 0);

  const diminta = Number(masukan.diskon ?? 0);
  const diskon = Math.min(
    subtotal,
    Number.isFinite(diminta) && diminta > 0 ? bulat(diminta) : 0,
  );

  const dasar = subtotal - diskon;

  const persen_diminta = Number(masukan.ppn_persen ?? 0);
  const ppn_persen =
    Number.isFinite(persen_diminta) && persen_diminta > 0
      ? Math.min(100, persen_diminta)
      : 0;

  const nilai_ppn = bulat((dasar * ppn_persen) / 100);

  return {
    subtotal,
    diskon,
    dasar,
    ppn_persen,
    nilai_ppn,
    total: dasar + nilai_ppn,
  };
}

/**
 * Tanggal jatuh tempo, dihitung dari tanggal terbit.
 * Dikembalikan sebagai YYYY-MM-DD karena kolomnya date, bukan timestamp.
 */
export function jatuh_tempo(terbit: string, tempo_hari: number): string {
  const mulai = new Date(`${terbit}T00:00:00Z`);
  if (Number.isNaN(mulai.getTime())) return terbit;
  const hari = Number.isFinite(tempo_hari) ? Math.max(0, Math.floor(tempo_hari)) : 0;
  mulai.setUTCDate(mulai.getUTCDate() + hari);
  return mulai.toISOString().slice(0, 10);
}

/** Sisa hari sampai jatuh tempo. Negatif berarti sudah lewat. */
export function sisa_hari(jatuh_tempo_at: string, sekarang = new Date()): number {
  const tempo = new Date(`${jatuh_tempo_at}T00:00:00Z`).getTime();
  if (!Number.isFinite(tempo)) return 0;
  const hari_ini = Date.UTC(
    sekarang.getUTCFullYear(),
    sekarang.getUTCMonth(),
    sekarang.getUTCDate(),
  );
  return Math.round((tempo - hari_ini) / 86400_000);
}
