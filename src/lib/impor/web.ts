import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Mengambil isi halaman web yang alamatnya diketik pengguna.
 *
 * Ini permukaan serangan yang serius. Server kita punya akses ke jaringan
 * dalam dan ke metadata penyedia cloud, sedangkan alamatnya ditentukan orang
 * luar. Tanpa penyaringan, seseorang bisa menyuruh Reflows membaca
 * 169.254.169.254 atau localhost lalu menampilkan hasilnya di layar.
 *
 * Karena itu setiap alamat diperiksa sampai ke nomor IP hasil resolusi, dan
 * pengalihan diikuti satu per satu dengan pemeriksaan yang sama.
 */

const MAKS_PENGALIHAN = 3;
const MAKS_BYTE = 2 * 1024 * 1024;
const BATAS_WAKTU_MS = 15_000;

/** Rentang yang tidak boleh disentuh dari sisi server. */
function ip_terlarang(ip: string): boolean {
  const versi = isIP(ip);

  if (versi === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === undefined || b === undefined) return true;
    if (a === 0) return true; // "alamat ini"
    if (a === 10) return true; // jaringan dalam
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local dan metadata cloud
    if (a === 172 && b >= 16 && b <= 31) return true; // jaringan dalam
    if (a === 192 && b === 168) return true; // jaringan dalam
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast dan cadangan
    return false;
  }

  if (versi === 6) {
    const bawah = ip.toLowerCase();
    if (bawah === "::1" || bawah === "::") return true;
    if (bawah.startsWith("fe80")) return true; // link-local
    if (/^f[cd]/.test(bawah)) return true; // unique local
    // IPv4 yang dibungkus IPv6, misalnya ::ffff:127.0.0.1
    const cocok = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(bawah);
    if (cocok?.[1]) return ip_terlarang(cocok[1]);
    return false;
  }

  return true;
}

export type HasilPeriksaUrl =
  | { boleh: true; url: URL }
  | { boleh: false; alasan: string };

export async function periksa_url(mentah: string): Promise<HasilPeriksaUrl> {
  let url: URL;
  try {
    url = new URL(mentah.trim());
  } catch {
    return { boleh: false, alasan: "Alamatnya tidak terbaca sebagai URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { boleh: false, alasan: "Cuma alamat http dan https yang bisa dibuka." };
  }

  const tuan_rumah = url.hostname;

  // Nama seperti localhost tidak selalu ada di DNS, jadi disaring lebih dulu.
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(tuan_rumah)) {
    return { boleh: false, alasan: "Alamat jaringan dalam tidak boleh dibuka." };
  }

  if (isIP(tuan_rumah)) {
    if (ip_terlarang(tuan_rumah)) {
      return { boleh: false, alasan: "Alamat jaringan dalam tidak boleh dibuka." };
    }
    return { boleh: true, url };
  }

  let alamat: { address: string }[];
  try {
    alamat = await lookup(tuan_rumah, { all: true });
  } catch {
    return { boleh: false, alasan: `Nama ${tuan_rumah} tidak bisa ditemukan.` };
  }

  if (alamat.length === 0) {
    return { boleh: false, alasan: `Nama ${tuan_rumah} tidak menunjuk ke mana pun.` };
  }

  // Semua hasil resolusi harus aman, bukan cuma yang pertama. Nama yang
  // menunjuk ke beberapa IP bisa dipakai menyelipkan satu alamat dalam.
  for (const { address } of alamat) {
    if (ip_terlarang(address)) {
      return { boleh: false, alasan: "Alamat jaringan dalam tidak boleh dibuka." };
    }
  }

  return { boleh: true, url };
}

/** Mengubah HTML jadi teks yang enak dibaca model, tanpa tag dan tanpa skrip. */
export function html_ke_teks(html: string): string {
  let teks = html;

  // Isi script, style, dan nav dibuang seluruhnya, bukan cuma tagnya.
  teks = teks.replace(
    /<(script|style|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );

  // Tag yang memisahkan blok diganti baris baru supaya struktur tidak hilang.
  teks = teks.replace(/<\/(p|div|section|article|li|tr|h[1-6]|br)\s*>/gi, "\n");
  teks = teks.replace(/<br\s*\/?>/gi, "\n");
  teks = teks.replace(/<\/td>/gi, "\t");

  teks = teks.replace(/<[^>]+>/g, " ");

  const entitas: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&rsquo;": "'",
    "&ldquo;": '"',
    "&rdquo;": '"',
  };
  teks = teks.replace(/&[a-z#0-9]+;/gi, (e) => entitas[e.toLowerCase()] ?? " ");

  return teks
    .split("\n")
    .map((baris) => baris.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type HasilAmbilWeb =
  | { ok: true; teks: string; judul: string | null; url_akhir: string }
  | { ok: false; alasan: string };

export async function ambil_halaman(mentah: string): Promise<HasilAmbilWeb> {
  let sekarang = mentah;

  for (let lompatan = 0; lompatan <= MAKS_PENGALIHAN; lompatan++) {
    const periksa = await periksa_url(sekarang);
    if (!periksa.boleh) return { ok: false, alasan: periksa.alasan };

    let jawaban: Response;
    try {
      jawaban = await fetch(periksa.url, {
        // Pengalihan diikuti sendiri supaya setiap tujuan ikut diperiksa.
        redirect: "manual",
        signal: AbortSignal.timeout(BATAS_WAKTU_MS),
        headers: { "User-Agent": "Reflows/1.0 (pengimpor materi admin)" },
      });
    } catch (e) {
      return {
        ok: false,
        alasan: `Gagal membuka halaman: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    if (jawaban.status >= 300 && jawaban.status < 400) {
      const tujuan = jawaban.headers.get("location");
      if (!tujuan) return { ok: false, alasan: "Halaman dialihkan tanpa tujuan." };
      sekarang = new URL(tujuan, periksa.url).toString();
      continue;
    }

    if (!jawaban.ok) {
      return { ok: false, alasan: `Halaman menjawab HTTP ${jawaban.status}.` };
    }

    const jenis = jawaban.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(jenis)) {
      return {
        ok: false,
        alasan: `Isinya bukan halaman web biasa (${jenis || "tanpa tipe"}).`,
      };
    }

    const panjang = Number(jawaban.headers.get("content-length") ?? 0);
    if (panjang > MAKS_BYTE) {
      return { ok: false, alasan: "Halamannya terlalu besar." };
    }

    const mentah_isi = await jawaban.text();
    if (mentah_isi.length > MAKS_BYTE) {
      return { ok: false, alasan: "Halamannya terlalu besar." };
    }

    const judul = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(mentah_isi)?.[1];
    return {
      ok: true,
      teks: html_ke_teks(mentah_isi),
      judul: judul ? html_ke_teks(judul) : null,
      url_akhir: periksa.url.toString(),
    };
  }

  return { ok: false, alasan: "Terlalu banyak pengalihan." };
}
