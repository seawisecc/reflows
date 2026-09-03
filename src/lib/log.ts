/**
 * Log terstruktur satu baris, untuk jalur server yang selama ini diam.
 *
 * Sebelum berkas ini ada, tidak ada satu pun console di seluruh src, jadi
 * log fungsi di Vercel benar-benar kosong. Kegagalan yang tidak sampai ke
 * layar berarti tidak ada yang tahu, dan pemilik baru sadar setelah client
 * mengeluh tidak dibalas.
 *
 * Yang boleh masuk log dibatasi keras, dan ini bukan sekadar sopan santun.
 * Fitur Inbox Fonnte sengaja dimatikan supaya isi chat client tidak
 * menginap di server orang lain. Menuliskan isi chat ke log Vercel
 * membatalkan keputusan itu lewat pintu belakang.
 *
 * Karena itu keluarannya disusun dengan memilih kunci satu per satu dari
 * daftar di bawah, bukan menyebar apa pun yang dikirim pemanggil. Kunci di
 * luar daftar hilang, walaupun pemanggilnya memaksa lewat cast. Nomor
 * WhatsApp ikut dilarang: itu data pribadi client tenant, bukan milik kita.
 */

export type RincianLog = {
  tenant_id?: string;
  percakapan_id?: string;
  pesan_id?: string;
  kampanye_id?: string;
  sasaran_id?: string;
  /** Sebab yang disusun kode kita sendiri, bukan isi chat. */
  sebab?: string;
  /** Nama kelas galatnya, misalnya TypeError. */
  galat?: string;
  jenis?: string;
  status?: string;
  tindakan?: string;
  lama_ms?: number;
  jumlah?: number;
};

/** Satu-satunya kunci yang boleh terbit. Sengaja ditulis sebagai nilai,
 *  bukan cuma tipe, supaya penyaringnya benar-benar berjalan saat program
 *  jalan dan bukan cuma saat dikompilasi. */
const KUNCI_BOLEH = [
  "tenant_id",
  "percakapan_id",
  "pesan_id",
  "kampanye_id",
  "sasaran_id",
  "sebab",
  "galat",
  "jenis",
  "status",
  "tindakan",
  "lama_ms",
  "jumlah",
] as const;

/** Sebab yang kepanjangan biasanya berarti ada yang menempelkan isi pesan
 *  ke dalamnya. Dipotong, bukan dibuang, supaya jejaknya tetap ada. */
const BATAS_SEBAB = 300;

export function saring_rincian(rincian: RincianLog): Record<string, unknown> {
  const bersih: Record<string, unknown> = {};
  const sumber = rincian as Record<string, unknown>;

  for (const kunci of KUNCI_BOLEH) {
    const nilai = sumber[kunci];
    if (nilai === undefined || nilai === null) continue;
    bersih[kunci] =
      typeof nilai === "string" && nilai.length > BATAS_SEBAB
        ? `${nilai.slice(0, BATAS_SEBAB)}...`
        : nilai;
  }

  return bersih;
}

function tulis(
  saluran: "log" | "error",
  peristiwa: string,
  rincian: RincianLog,
) {
  // Log yang melempar akan menjatuhkan jalur yang justru sedang gagal.
  try {
    const baris = JSON.stringify({ peristiwa, ...saring_rincian(rincian) });
    console[saluran](`[reflows] ${baris}`);
  } catch {
    // Sudah tidak ada lagi yang bisa dilakukan di sini.
  }
}

/** Peristiwa biasa yang layak dilihat di log, misalnya keputusan webhook. */
export function catat(peristiwa: string, rincian: RincianLog = {}) {
  tulis("log", peristiwa, rincian);
}

/** Kegagalan. Nama kelas galat dan pesannya ikut, isi chat tidak pernah. */
export function catat_galat(
  peristiwa: string,
  e: unknown,
  rincian: RincianLog = {},
) {
  tulis("error", peristiwa, {
    ...rincian,
    galat: e instanceof Error ? e.name : typeof e,
    sebab: rincian.sebab ?? (e instanceof Error ? e.message : String(e)),
  });
}
