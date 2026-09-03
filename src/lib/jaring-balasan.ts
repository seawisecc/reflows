import { catat_galat } from "./log";

/**
 * Jaring pengaman putaran balasan otomatis.
 *
 * Dipisah dari balas-otomatis.ts yang ber-"server-only" supaya bisa diuji.
 * Modul server-only tidak bisa diimpor dari uji, sama seperti penerimaan.ts
 * yang juga sengaja bersih dari adapter demi alasan yang sama.
 *
 * Yang dijaga di sini satu hal: sebuah percakapan tidak boleh ditinggal
 * berstatus ai setelah mesinnya gagal. Di layar, percakapan berstatus ai
 * terlihat persis sama dengan chat yang memang sedang dipegang AI, jadi
 * pemilik tidak punya cara membedakan "sedang disusun" dari "tidak akan
 * pernah dibalas".
 */

export type HasilBalasOtomatis = {
  tindakan: "kirim" | "draf" | "eskalasi" | "lewat";
  alasan: string | null;
};

/**
 * Kalimat yang dibaca pemilik di inbox saat mesinnya sendiri yang rusak.
 *
 * Sengaja tidak menyebut nama galat. Yang perlu diketahui pemilik cuma
 * bahwa chat ini sekarang giliran dia, bukan kelas exception apa yang
 * dilempar. Rinciannya ada di log server.
 */
export const ALASAN_TAK_TERDUGA =
  "AI berhenti di tengah karena galat tak terduga. Chat ini menunggu kamu.";

export async function dengan_jaring(
  konteks: { tenant_id: string; percakapan_id: string },
  jalankan: () => Promise<HasilBalasOtomatis>,
  ke_manual: (alasan: string) => Promise<void>,
): Promise<HasilBalasOtomatis> {
  try {
    return await jalankan();
  } catch (e) {
    catat_galat("balasan.tak-terduga", e, konteks);

    try {
      await ke_manual(ALASAN_TAK_TERDUGA);
    } catch (galat_eskalasi) {
      // Databasenya sendiri yang tidak bisa dihubungi. Tidak ada lagi yang
      // bisa diselamatkan selain meninggalkan jejak di log.
      catat_galat("balasan.eskalasi-gagal", galat_eskalasi, konteks);
    }

    return { tindakan: "eskalasi", alasan: ALASAN_TAK_TERDUGA };
  }
}
