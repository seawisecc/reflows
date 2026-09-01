import type {
  Gateway,
  HasilKirim,
  HasilProfil,
  HasilQr,
  PermintaanKirim,
  PesanMasuk,
} from "./jenis";
import { normalkan_nomor } from "./nomor";

const ENDPOINT_KIRIM = "https://api.fonnte.com/send";
const ENDPOINT_QR = "https://api.fonnte.com/qr";
const ENDPOINT_PERANGKAT = "https://api.fonnte.com/device";

/** Fonnte memakai kalimat ini saat perangkatnya sudah tersambung. */
const PENANDA_TERSAMBUNG = "already connect";

/**
 * Bentuk muatan webhook Fonnte. Fonnte mengirim JSON dan tidak
 * menandatanganinya sama sekali, jadi keaslian permintaan tidak bisa
 * dibuktikan dari isinya. Pengaman ada di dua tempat lain: token rahasia di
 * jalur URL webhook, dan pencocokan field device dengan nomor milik tenant.
 */
type MuatanFonnte = {
  device?: unknown;
  sender?: unknown;
  message?: unknown;
  text?: unknown;
  name?: unknown;
  member?: unknown;
  timestamp?: unknown;
  inboxid?: unknown;
  url?: unknown;
  filename?: unknown;
  extension?: unknown;
  location?: unknown;
  pollname?: unknown;
  choices?: unknown;
};

function teks(nilai: unknown): string | null {
  if (typeof nilai === "string") {
    const bersih = nilai.trim();
    return bersih === "" ? null : bersih;
  }
  if (typeof nilai === "number") return String(nilai);
  return null;
}

/** Fonnte mengirim timestamp dalam detik, kadang sebagai teks, kadang kosong. */
function waktu_dari(nilai: unknown): string {
  const angka = Number(teks(nilai));
  if (!Number.isFinite(angka) || angka <= 0) return new Date().toISOString();
  // Sebagian gateway mengirim milidetik. Angka detik yang wajar tidak akan
  // pernah sebesar itu, jadi bisa dibedakan dari besarannya.
  const md = angka > 1e12 ? angka : angka * 1000;
  const tanggal = new Date(md);
  return Number.isNaN(tanggal.getTime())
    ? new Date().toISOString()
    : tanggal.toISOString();
}

export function baca_webhook_fonnte(muatan: unknown): PesanMasuk | null {
  if (!muatan || typeof muatan !== "object") return null;
  const m = muatan as MuatanFonnte;

  const perangkat = normalkan_nomor(teks(m.device));
  if (!perangkat) return null;

  // member terisi kalau pesannya dari grup. Reflows tidak melayani grup,
  // karena balasan otomatis di grup mengganggu semua anggotanya.
  if (teks(m.member)) return null;

  const pengirim = normalkan_nomor(teks(m.sender));
  if (!pengirim) return null;

  // message untuk pesan biasa, text untuk balasan tombol.
  const isi = teks(m.message) ?? teks(m.text);
  const berkas = teks(m.url);
  if (!isi && !berkas) return null;

  return {
    nomor_pengirim: pengirim,
    nama_pengirim: teks(m.name),
    isi: isi ?? "",
    nomor_perangkat: perangkat,
    wa_message_id: teks(m.inboxid),
    waktu: waktu_dari(m.timestamp),
    lampiran: berkas
      ? {
          url: berkas,
          nama: teks(m.filename),
          ekstensi: teks(m.extension),
        }
      : null,
  };
}

export function gateway_fonnte(token: string): Gateway {
  return {
    nama: "fonnte",

    async kirim({ ke, isi }: PermintaanKirim): Promise<HasilKirim> {
      const tujuan = normalkan_nomor(ke);
      if (!tujuan) return { ok: false, alasan: `Nomor tujuan tidak sah: ${ke}` };

      let jawaban: Response;
      try {
        jawaban = await fetch(ENDPOINT_KIRIM, {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target: tujuan, message: isi }),
        });
      } catch (e) {
        return {
          ok: false,
          alasan: `Gagal menghubungi Fonnte: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      let hasil: unknown;
      try {
        hasil = await jawaban.json();
      } catch {
        return {
          ok: false,
          alasan: `Jawaban Fonnte bukan JSON (HTTP ${jawaban.status})`,
        };
      }

      const h = hasil as { status?: unknown; reason?: unknown; id?: unknown };
      if (h.status !== true) {
        return {
          ok: false,
          alasan: teks(h.reason) ?? `Fonnte menolak (HTTP ${jawaban.status})`,
        };
      }

      const daftar_id = Array.isArray(h.id) ? h.id : [];
      return { ok: true, wa_message_id: teks(daftar_id[0]) };
    },

    baca_webhook: baca_webhook_fonnte,

    async profil(): Promise<HasilProfil> {
      let jawaban: Response;
      try {
        jawaban = await fetch(ENDPOINT_PERANGKAT, {
          method: "POST",
          headers: { Authorization: token, "Content-Type": "application/json" },
          body: "{}",
        });
      } catch (e) {
        return {
          ok: false,
          alasan: `Gagal menghubungi Fonnte: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      let hasil: unknown;
      try {
        hasil = await jawaban.json();
      } catch {
        return { ok: false, alasan: `Jawaban Fonnte bukan JSON (HTTP ${jawaban.status})` };
      }

      const h = hasil as Record<string, unknown>;
      if (h.status !== true) {
        return {
          ok: false,
          alasan: teks(h.reason) ?? `Fonnte menolak (HTTP ${jawaban.status})`,
        };
      }

      const kuota = Number(teks(h.quota));
      return {
        ok: true,
        profil: {
          nomor: normalkan_nomor(teks(h.device)),
          // Fonnte memakai kata "connect" dan "disconnect", bukan boolean.
          tersambung: teks(h.device_status)?.toLowerCase() === "connect",
          nama: teks(h.name),
          paket: teks(h.package),
          kuota: Number.isFinite(kuota) ? kuota : null,
          kedaluwarsa: teks(h.expired),
        },
      };
    },

    async qr(): Promise<HasilQr> {
      let jawaban: Response;
      try {
        jawaban = await fetch(ENDPOINT_QR, {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "qr" }),
        });
      } catch (e) {
        return {
          keadaan: "gagal",
          alasan: `Gagal menghubungi Fonnte: ${e instanceof Error ? e.message : String(e)}`,
        };
      }

      let hasil: unknown;
      try {
        hasil = await jawaban.json();
      } catch {
        return {
          keadaan: "gagal",
          alasan: `Jawaban Fonnte bukan JSON (HTTP ${jawaban.status})`,
        };
      }

      const h = hasil as { status?: unknown; url?: unknown; reason?: unknown };
      const alasan = teks(h.reason) ?? "";

      // Penolakan karena sudah tersambung itu kabar baik, bukan kegagalan.
      if (h.status !== true) {
        if (alasan.toLowerCase().includes(PENANDA_TERSAMBUNG)) {
          return { keadaan: "tersambung" };
        }
        return {
          keadaan: "gagal",
          alasan: alasan || `Fonnte menolak (HTTP ${jawaban.status})`,
        };
      }

      const gambar = teks(h.url);
      if (!gambar) {
        return { keadaan: "gagal", alasan: "Fonnte tidak mengirim gambar QR" };
      }

      // Fonnte mengirim base64 telanjang. Kalau suatu saat mereka mengubahnya
      // jadi data URL utuh, jangan sampai awalannya dobel.
      const data_url = gambar.startsWith("data:")
        ? gambar
        : `data:image/png;base64,${gambar}`;
      return { keadaan: "perlu-scan", gambar: data_url };
    },
  };
}
