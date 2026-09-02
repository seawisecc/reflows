"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { tenant_saya } from "@/lib/data/pengaturan";
import { ekstrak_materi } from "@/lib/impor/ekstrak";
import { ambil_halaman } from "@/lib/impor/web";
import { baca_csv, baca_xlsx, tabel_ke_teks } from "@/lib/impor/tabel";
import type { Sumber } from "@/lib/impor/jenis";
import type { TipePengetahuan } from "@/tipe";

const MAKS_BERKAS = 10 * 1024 * 1024;

import type { KeadaanImpor, KeadaanSimpan, KeadaanTambah } from "./keadaan";

// Konstanta tidak boleh diekspor dari berkas "use server": berkas itu hanya
// boleh mengekspor fungsi async. Kalau dilanggar, build dan lint tetap lolos
// tapi halamannya ambruk saat dibuka. Nilai awalnya ada di keadaan.ts.
const KOSONG: KeadaanImpor = {
  galat: null,
  label: null,
  hasil: null,
  biaya: null,
};

function gagal(alasan: string): KeadaanImpor {
  return { ...KOSONG, galat: alasan };
}

/** Menyiapkan sumber dari berkas atau alamat, sebelum dibaca Claude. */
async function siapkan_sumber(data: FormData): Promise<Sumber | { galat: string }> {
  const alamat = String(data.get("url") ?? "").trim();
  const berkas = data.get("berkas");

  if (alamat) {
    const halaman = await ambil_halaman(alamat);
    if (!halaman.ok) return { galat: halaman.alasan };
    if (halaman.teks.length < 40) {
      return {
        galat:
          "Halaman itu hampir tidak berisi teks. Kemungkinan isinya dibangun JavaScript, coba simpan jadi PDF lalu unggah.",
      };
    }
    return {
      jenis: "web",
      label: halaman.judul ? `${halaman.judul} (${halaman.url_akhir})` : halaman.url_akhir,
      teks: halaman.teks,
    };
  }

  if (!(berkas instanceof File) || berkas.size === 0) {
    return { galat: "Pilih berkas dulu, atau isi alamat halaman web." };
  }
  if (berkas.size > MAKS_BERKAS) {
    return { galat: "Berkasnya lebih dari 10 MB. Coba yang lebih kecil." };
  }

  const nama = berkas.name;
  const akhiran = nama.toLowerCase().split(".").pop() ?? "";

  if (akhiran === "pdf") {
    const isi = Buffer.from(await berkas.arrayBuffer());
    // Base64 tidak boleh mengandung baris baru saat dikirim ke API.
    return { jenis: "pdf", label: nama, pdf_base64: isi.toString("base64") };
  }

  if (akhiran === "csv" || akhiran === "txt") {
    const teks = await berkas.text();
    const baris = akhiran === "csv" ? baca_csv(teks) : [];
    return {
      jenis: akhiran === "csv" ? "tabel" : "teks",
      label: nama,
      teks: akhiran === "csv" ? tabel_ke_teks(baris) : teks,
    };
  }

  if (akhiran === "xlsx" || akhiran === "xlsm") {
    try {
      const baris = await baca_xlsx(await berkas.arrayBuffer());
      if (baris.length === 0) return { galat: "Berkas Excel itu kosong." };
      return { jenis: "tabel", label: nama, teks: tabel_ke_teks(baris) };
    } catch (e) {
      return {
        galat: `Gagal membaca Excel: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return {
    galat: `Jenis berkas ".${akhiran}" belum didukung. Yang bisa: PDF, CSV, XLSX, dan TXT.`,
  };
}

export async function impor_materi(
  _sebelumnya: KeadaanImpor,
  data: FormData,
): Promise<KeadaanImpor> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis. Masuk lagi ya.");

  const sumber = await siapkan_sumber(data);
  if ("galat" in sumber) return gagal(sumber.galat);

  const hasil = await ekstrak_materi(sumber);
  if (!hasil.ok) return gagal(hasil.alasan);

  const kosong =
    hasil.hasil.layanan.length === 0 &&
    hasil.hasil.faq.length === 0 &&
    hasil.hasil.kutipan.length === 0 &&
    hasil.hasil.catatan.length === 0;

  if (kosong) {
    return {
      ...KOSONG,
      label: sumber.label,
      galat:
        "Tidak ada layanan maupun pertanyaan yang bisa ditarik dari sumber ini.",
    };
  }

  // Sengaja belum disimpan. Hasil bacaan mesin harus lewat mata manusia
  // dulu, terutama angka harganya.
  return {
    galat: null,
    label: sumber.label,
    hasil: hasil.hasil,
    biaya: { token_masuk: hasil.token_masuk, token_keluar: hasil.token_keluar },
  };
}

/** Menyimpan entri yang sudah disetujui pemilik. */
export async function simpan_materi(
  _sebelumnya: KeadaanSimpan,
  data: FormData,
): Promise<KeadaanSimpan> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis.", pesan: null };

  let butir: { tipe: TipePengetahuan; judul: string; isi: string; harga: number | null }[];
  try {
    butir = JSON.parse(String(data.get("butir") ?? "[]"));
  } catch {
    return { galat: "Daftar materinya tidak terbaca.", pesan: null };
  }

  const bersih = butir
    .filter((b) => b.judul?.trim() && b.isi?.trim())
    .map((b) => ({
      tenant_id,
      tipe: b.tipe,
      judul: b.judul.trim().slice(0, 200),
      isi: b.isi.trim().slice(0, 4000),
      harga:
        typeof b.harga === "number" && Number.isFinite(b.harga) && b.harga >= 0
          ? Math.round(b.harga)
          : null,
      aktif: true,
    }));

  if (bersih.length === 0) {
    return { galat: "Tidak ada satu pun entri yang dicentang.", pesan: null };
  }

  const db = await klien_server();
  const { error } = await db.from("pengetahuan").insert(bersih);
  if (error) return { galat: `Gagal menyimpan: ${error.message}`, pesan: null };

  revalidatePath("/pengetahuan");
  return {
    galat: null,
    pesan: `${bersih.length} entri tersimpan ke materi admin.`,
  };
}

export async function hapus_materi(id: string): Promise<{ galat: string | null }> {
  const db = await klien_server();
  const { error } = await db.from("pengetahuan").delete().eq("id", id);
  if (error) return { galat: `Gagal menghapus: ${error.message}` };
  revalidatePath("/pengetahuan");
  return { galat: null };
}

export async function ubah_aktif(
  id: string,
  aktif: boolean,
): Promise<{ galat: string | null }> {
  const db = await klien_server();
  const { error } = await db.from("pengetahuan").update({ aktif }).eq("id", id);
  if (error) return { galat: `Gagal mengubah: ${error.message}` };
  revalidatePath("/pengetahuan");
  return { galat: null };
}

const TIPE_SAH: TipePengetahuan[] = ["layanan", "faq", "gaya", "catatan", "dokumen"];

function tipe_terbaca(nilai: unknown): TipePengetahuan | null {
  return TIPE_SAH.includes(nilai as TipePengetahuan)
    ? (nilai as TipePengetahuan)
    : null;
}

/** Harga dari formulir: "4.500.000" dan "4500000" sama-sama diterima. */
function harga_terbaca(mentah: unknown): number | null {
  const teks = String(mentah ?? "").replace(/[^\d]/g, "");
  if (!teks) return null;
  const nilai = Number(teks);
  return Number.isFinite(nilai) && nilai >= 0 ? Math.round(nilai) : null;
}

/**
 * Menambah satu butir materi dengan tangan.
 *
 * Sebelum ini satu-satunya jalan mengisi materi adalah lewat impor dokumen.
 * Padahal yang paling sering terjadi justru sebaliknya: satu harga berubah,
 * atau satu pertanyaan baru sering masuk, dan itu tidak perlu PDF.
 */
export async function tambah_materi(
  _sebelumnya: KeadaanTambah,
  data: FormData,
): Promise<KeadaanTambah> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis. Masuk lagi ya.", pesan: null };

  const tipe = tipe_terbaca(data.get("tipe"));
  if (!tipe) return { galat: "Jenis materinya belum dipilih.", pesan: null };

  const judul = String(data.get("judul") ?? "").trim().slice(0, 200);
  const isi = String(data.get("isi") ?? "").trim().slice(0, 4000);
  if (!judul || !isi) {
    return { galat: "Judul dan isinya harus diisi dua-duanya.", pesan: null };
  }

  const db = await klien_server();
  const { error } = await db.from("pengetahuan").insert({
    tenant_id,
    tipe,
    judul,
    isi,
    harga: tipe === "layanan" ? harga_terbaca(data.get("harga")) : null,
    aktif: true,
  });
  if (error) return { galat: `Gagal menyimpan: ${error.message}`, pesan: null };

  revalidatePath("/pengetahuan");
  return { galat: null, pesan: `"${judul}" masuk ke materi admin.` };
}

/** Menyunting satu butir yang sudah ada, langsung dari daftarnya. */
export async function ubah_materi(
  id: string,
  ubahan: { judul: string; isi: string; harga: number | null },
): Promise<{ galat: string | null }> {
  const judul = ubahan.judul.trim().slice(0, 200);
  const isi = ubahan.isi.trim().slice(0, 4000);
  if (!judul || !isi) return { galat: "Judul dan isinya tidak boleh kosong." };

  const db = await klien_server();
  const { error } = await db
    .from("pengetahuan")
    .update({
      judul,
      isi,
      harga:
        ubahan.harga === null || !Number.isFinite(ubahan.harga) || ubahan.harga < 0
          ? null
          : Math.round(ubahan.harga),
    })
    .eq("id", id);
  if (error) return { galat: `Gagal menyimpan: ${error.message}` };

  revalidatePath("/pengetahuan");
  return { galat: null };
}
