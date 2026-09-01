import type {
  Gateway,
  HasilKirim,
  PermintaanKirim,
  PesanMasuk,
} from "./jenis";
import { normalkan_nomor } from "./nomor";

const ENDPOINT = "https://api.fonnte.com/send";

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
        jawaban = await fetch(ENDPOINT, {
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
  };
}
