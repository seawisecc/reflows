"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { tenant_saya } from "@/lib/data/pengaturan";
import type { KeadaanKampanye } from "./keadaan";

function gagal(alasan: string): KeadaanKampanye {
  return { galat: alasan, pesan: null, id: null };
}

/** Batas bawah yang tidak boleh ditembus dari layar, sekencang apa pun maunya. */
const JEDA_MIN_TERKECIL = 30;
const JEDA_MAKS_TERKECIL = 60;
const BATAS_AWAL_TERBESAR = 100;
const BATAS_MAKS_TERBESAR = 300;

function bilangan(nilai: unknown, bawaan: number): number {
  const n = Number(String(nilai ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : bawaan;
}

function pecah_baris(mentah: unknown): string[] {
  return String(mentah ?? "")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export async function buat_kampanye(
  _sebelumnya: KeadaanKampanye,
  data: FormData,
): Promise<KeadaanKampanye> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis. Masuk lagi ya.");

  const nama = String(data.get("nama") ?? "").trim().slice(0, 120);
  if (!nama) return gagal("Kampanyenya belum dinamai.");

  const tag = String(data.get("saringan_tag") ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  // Angka pembatas dijepit di sini, bukan cuma di skema. Galat constraint
  // database pesannya tidak bisa dibaca orang, dan yang mengisi form ini
  // pemilik bisnis, bukan pengembang.
  const jeda_min = Math.max(JEDA_MIN_TERKECIL, bilangan(data.get("jeda_min_detik"), 40));
  const jeda_maks = Math.max(
    JEDA_MAKS_TERKECIL,
    jeda_min,
    bilangan(data.get("jeda_maks_detik"), 120),
  );
  const batas_awal = Math.min(
    BATAS_AWAL_TERBESAR,
    bilangan(data.get("batas_harian_awal"), 20),
  );
  const batas_maks = Math.min(
    BATAS_MAKS_TERBESAR,
    Math.max(batas_awal, bilangan(data.get("batas_harian_maks"), 150)),
  );

  const db = await klien_server();
  const { data: baru, error } = await db
    .from("kampanye")
    .insert({
      tenant_id,
      nama,
      saringan_tag: tag,
      jeda_min_detik: jeda_min,
      jeda_maks_detik: jeda_maks,
      batas_harian_awal: batas_awal,
      batas_harian_maks: batas_maks,
    })
    .select("id")
    .single();

  if (error || !baru) {
    return gagal(`Gagal membuat kampanye: ${error?.message ?? "tanpa data"}`);
  }

  revalidatePath("/kampanye");
  return { galat: null, pesan: `Kampanye "${nama}" dibuat.`, id: baru.id as string };
}

export async function tambah_langkah(
  _sebelumnya: KeadaanKampanye,
  data: FormData,
): Promise<KeadaanKampanye> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis.");

  const kampanye_id = String(data.get("kampanye_id") ?? "");
  const varian = pecah_baris(data.get("varian"));
  if (varian.length === 0) {
    return gagal("Tulis minimal satu kalimat untuk langkah ini.");
  }
  if (varian.some((v) => v.length > 900)) {
    return gagal("Ada kalimat yang lebih dari 900 karakter. Persingkat dulu.");
  }

  const db = await klien_server();
  const { data: ada } = await db
    .from("langkah_kampanye")
    .select("urutan")
    .eq("kampanye_id", kampanye_id)
    .order("urutan", { ascending: false })
    .limit(1);

  const urutan = ada && ada.length > 0 ? Number(ada[0].urutan) + 1 : 0;
  // Langkah pertama selalu tanpa tunda. Menunda sapaan pertama tidak masuk
  // akal: sasaran baru masuk antrean pada saat itu juga.
  const tunda = urutan === 0 ? 0 : Math.min(90, bilangan(data.get("tunda_hari"), 3));

  const { error } = await db.from("langkah_kampanye").insert({
    tenant_id,
    kampanye_id,
    urutan,
    tunda_hari: tunda,
    varian,
  });
  if (error) return gagal(`Gagal menyimpan langkah: ${error.message}`);

  revalidatePath(`/kampanye/${kampanye_id}`);
  return {
    galat: null,
    pesan: `Langkah ${urutan + 1} tersimpan dengan ${varian.length} varian kalimat.`,
    id: kampanye_id,
  };
}

export async function hapus_langkah(id: string, kampanye_id: string) {
  const db = await klien_server();
  const { error } = await db.from("langkah_kampanye").delete().eq("id", id);
  if (error) return { galat: `Gagal menghapus: ${error.message}` };
  revalidatePath(`/kampanye/${kampanye_id}`);
  return { galat: null };
}

/**
 * Memasukkan kontak ke kampanye.
 *
 * Kontak yang sudah pernah masuk dilewati lewat kunci unik, bukan dicek
 * satu per satu, jadi menekan tombol ini dua kali tidak menggandakan siapa
 * pun. Yang sudah minta berhenti tidak pernah ikut.
 */
export async function daftarkan_kontak(
  _sebelumnya: KeadaanKampanye,
  data: FormData,
): Promise<KeadaanKampanye> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis.");

  const kampanye_id = String(data.get("kampanye_id") ?? "");
  const db = await klien_server();

  const { data: kam } = await db
    .from("kampanye")
    .select("saringan_tag")
    .eq("id", kampanye_id)
    .maybeSingle();
  if (!kam) return gagal("Kampanyenya tidak ditemukan.");

  const tag = (kam.saringan_tag ?? []) as string[];
  let cari = db.from("kontak").select("id").is("opt_out_at", null).limit(2000);
  // Kontak harus punya semua tag saringan, bukan salah satunya. Saringan
  // yang longgar lebih berbahaya di kampanye keluar daripada di layar biasa.
  if (tag.length > 0) cari = cari.contains("tag", tag);

  const { data: kontak, error } = await cari;
  if (error) return gagal(`Gagal membaca kontak: ${error.message}`);
  if (!kontak || kontak.length === 0) {
    return gagal(
      tag.length > 0
        ? `Tidak ada kontak yang punya semua tag: ${tag.join(", ")}.`
        : "Belum ada kontak yang bisa dimasukkan.",
    );
  }

  const { data: masuk, error: galat_simpan } = await db
    .from("sasaran_kampanye")
    .upsert(
      kontak.map((k) => ({
        tenant_id,
        kampanye_id,
        kontak_id: k.id as string,
      })),
      { onConflict: "kampanye_id,kontak_id", ignoreDuplicates: true },
    )
    .select("id");

  if (galat_simpan) return gagal(`Gagal mendaftarkan: ${galat_simpan.message}`);

  const baru = masuk?.length ?? 0;
  const lama = kontak.length - baru;
  revalidatePath(`/kampanye/${kampanye_id}`);
  return {
    galat: null,
    pesan:
      `${baru} kontak masuk antrean` +
      (lama > 0 ? `, ${lama} sudah terdaftar sebelumnya.` : "."),
    id: kampanye_id,
  };
}

/**
 * Mengubah status kampanye.
 *
 * Menjalankan kampanye tanpa langkah atau tanpa sasaran ditolak di sini,
 * bukan dibiarkan jalan lalu diam sendiri di antrean. Kampanye yang
 * statusnya "jalan" tapi tidak pernah mengirim apa pun adalah keadaan
 * paling membingungkan yang bisa dilihat pemilik.
 */
export async function ubah_status_kampanye(
  id: string,
  status: "jalan" | "jeda" | "dihentikan",
): Promise<{ galat: string | null }> {
  const db = await klien_server();

  if (status === "jalan") {
    const { data: k } = await db
      .from("kampanye")
      .select("mulai_at, langkah_kampanye ( id )")
      .eq("id", id)
      .maybeSingle();
    if (!k) return { galat: "Kampanyenya tidak ditemukan." };

    const langkah = (k.langkah_kampanye ?? []) as unknown[];
    if (langkah.length === 0) {
      return { galat: "Tambahkan minimal satu langkah dulu sebelum dijalankan." };
    }

    const { count } = await db
      .from("sasaran_kampanye")
      .select("id", { count: "exact", head: true })
      .eq("kampanye_id", id)
      .eq("status", "antre");
    if (!count) {
      return { galat: "Belum ada kontak di antrean. Daftarkan kontaknya dulu." };
    }

    // mulai_at cuma diisi sekali. Kalau ikut disetel ulang tiap kali kampanye
    // dilanjutkan setelah dijeda, warm-up kembali ke hari pertama dan
    // kampanye yang sudah berjalan sebulan tiba-tiba dibatasi 20 pesan.
    const { error } = await db
      .from("kampanye")
      .update({
        status: "jalan",
        rem_alasan: null,
        ...(k.mulai_at ? {} : { mulai_at: new Date().toISOString() }),
      })
      .eq("id", id);
    if (error) return { galat: `Gagal menjalankan: ${error.message}` };
  } else {
    const { error } = await db.from("kampanye").update({ status }).eq("id", id);
    if (error) return { galat: `Gagal mengubah status: ${error.message}` };
  }

  revalidatePath("/kampanye");
  revalidatePath(`/kampanye/${id}`);
  return { galat: null };
}

export async function hapus_kampanye(id: string): Promise<{ galat: string | null }> {
  const db = await klien_server();
  const { error } = await db.from("kampanye").delete().eq("id", id);
  if (error) return { galat: `Gagal menghapus: ${error.message}` };
  revalidatePath("/kampanye");
  return { galat: null };
}
