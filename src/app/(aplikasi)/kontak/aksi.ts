"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { tenant_saya } from "@/lib/data/pengaturan";
import { normalkan_nomor } from "@/lib/gateway/nomor";
import { baca_csv, baca_xlsx } from "@/lib/impor/tabel";
import type { KeadaanKontak } from "./keadaan";

const MAKS_BERKAS = 5 * 1024 * 1024;
const MAKS_BARIS = 2000;

function gagal(alasan: string): KeadaanKontak {
  return { galat: alasan, pesan: null };
}

/** Memecah "prospek, kuliner" jadi larik tag yang bersih. */
function pecah_tag(mentah: unknown): string[] {
  return String(mentah ?? "")
    .split(/[,;|]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);
}

export async function tambah_kontak(
  _sebelumnya: KeadaanKontak,
  data: FormData,
): Promise<KeadaanKontak> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis. Masuk lagi ya.");

  const nomor = normalkan_nomor(String(data.get("nomor") ?? ""));
  if (!nomor) {
    return gagal(
      "Nomornya tidak terbaca. Tulis seperti 08123456789 atau +62 812 3456 789.",
    );
  }

  const nama = String(data.get("nama") ?? "").trim().slice(0, 120);
  const db = await klien_server();

  // Kontak yang sudah ada tidak ditimpa diam-diam. Nomor yang sama berarti
  // orang yang sama, dan menimpa namanya bisa menghapus catatan yang sudah
  // dipakai di percakapan berjalan.
  const { data: ada } = await db
    .from("kontak")
    .select("id")
    .eq("nomor_wa", nomor)
    .maybeSingle();
  if (ada) return gagal("Nomor itu sudah ada di daftar kontak.");

  const { error } = await db.from("kontak").insert({
    tenant_id,
    nomor_wa: nomor,
    nama: nama || null,
    tag: pecah_tag(data.get("tag")),
    sumber: "manual",
  });
  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  revalidatePath("/kontak");
  return { galat: null, pesan: `${nama || nomor} masuk daftar kontak.` };
}

export async function impor_kontak(
  _sebelumnya: KeadaanKontak,
  data: FormData,
): Promise<KeadaanKontak> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis. Masuk lagi ya.");

  const berkas = data.get("berkas");
  if (!(berkas instanceof File) || berkas.size === 0) {
    return gagal("Pilih berkas CSV atau XLSX dulu.");
  }
  if (berkas.size > MAKS_BERKAS) return gagal("Berkasnya lebih dari 5 MB.");

  const akhiran = berkas.name.toLowerCase().split(".").pop() ?? "";
  let baris: string[][];
  try {
    baris =
      akhiran === "csv" || akhiran === "txt"
        ? baca_csv(await berkas.text())
        : await baca_xlsx(await berkas.arrayBuffer());
  } catch (e) {
    return gagal(`Gagal membaca berkas: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (baris.length === 0) return gagal("Berkasnya kosong.");

  // Kolom dicari lewat nama di baris pertama, bukan lewat urutan. Orang
  // menyusun spreadsheet sesukanya, dan menebak kolom dari posisi berarti
  // suatu saat nama orang masuk ke kolom nomor.
  const kepala = baris[0].map((k) => k.trim().toLowerCase());
  const cari = (...calon: string[]) =>
    kepala.findIndex((k) => calon.some((c) => k.includes(c)));

  const i_nomor = cari("nomor", "telepon", "hp", "wa", "phone");
  const i_nama = cari("nama", "name");
  const i_tag = cari("tag", "label", "segmen", "kategori");

  if (i_nomor === -1) {
    return gagal(
      `Tidak ada kolom nomor. Beri judul kolomnya "nomor" atau "telepon". Yang terbaca: ${kepala.join(", ")}.`,
    );
  }

  const terlihat = new Set<string>();
  const bersih: {
    tenant_id: string;
    nomor_wa: string;
    nama: string | null;
    tag: string[];
    sumber: "impor";
  }[] = [];
  let ditolak = 0;

  for (const b of baris.slice(1, MAKS_BARIS + 1)) {
    const nomor = normalkan_nomor(b[i_nomor]);
    if (!nomor || terlihat.has(nomor)) {
      if (!nomor && b.some((sel) => sel.trim())) ditolak++;
      continue;
    }
    terlihat.add(nomor);
    bersih.push({
      tenant_id,
      nomor_wa: nomor,
      nama: i_nama === -1 ? null : String(b[i_nama] ?? "").trim().slice(0, 120) || null,
      tag: i_tag === -1 ? [] : pecah_tag(b[i_tag]),
      sumber: "impor",
    });
  }

  if (bersih.length === 0) {
    return gagal("Tidak ada satu pun nomor yang terbaca dari berkas itu.");
  }

  const db = await klien_server();
  // Nomor yang sudah ada dilewati, bukan ditimpa. Impor ulang berkas yang
  // sama tidak boleh menghapus nama yang sudah dirapikan tangan.
  const { data: masuk, error } = await db
    .from("kontak")
    .upsert(bersih, { onConflict: "tenant_id,nomor_wa", ignoreDuplicates: true })
    .select("id");
  if (error) return gagal(`Gagal menyimpan: ${error.message}`);

  const baru = masuk?.length ?? 0;
  const lama = bersih.length - baru;
  const bagian = [`${baru} kontak baru masuk`];
  if (lama > 0) bagian.push(`${lama} sudah ada dan dilewati`);
  if (ditolak > 0) bagian.push(`${ditolak} baris nomornya tidak terbaca`);

  revalidatePath("/kontak");
  return { galat: null, pesan: `${bagian.join(", ")}.` };
}

export async function hapus_kontak(id: string): Promise<{ galat: string | null }> {
  const db = await klien_server();
  const { error } = await db.from("kontak").delete().eq("id", id);
  if (error) return { galat: `Gagal menghapus: ${error.message}` };
  revalidatePath("/kontak");
  return { galat: null };
}
