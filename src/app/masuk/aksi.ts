"use server";

import { redirect } from "next/navigation";
import { klien_server } from "@/lib/supabase/server";

export type KeadaanMasuk = { galat: string | null };

/**
 * Pesan galat sengaja tidak membedakan email salah dari sandi salah.
 * Membedakannya memberi tahu orang asing bahwa suatu email terdaftar,
 * dan itu memudahkan penebakan sandi.
 */
const GALAT_UMUM = "Email atau kata sandi salah.";

export async function masuk(
  _sebelumnya: KeadaanMasuk,
  data: FormData,
): Promise<KeadaanMasuk> {
  const email = String(data.get("email") ?? "").trim();
  const sandi = String(data.get("sandi") ?? "");
  const lanjut = String(data.get("lanjut") ?? "/dasbor");

  if (!email || !sandi) {
    return { galat: "Email dan kata sandi harus diisi." };
  }

  const db = await klien_server();
  const { error } = await db.auth.signInWithPassword({ email, password: sandi });

  if (error) {
    return { galat: GALAT_UMUM };
  }

  // Hanya jalur di dalam aplikasi ini. Tanpa pemeriksaan ini, tautan
  // ?lanjut=https://situs-lain bisa dipakai memantulkan orang keluar.
  const tujuan = lanjut.startsWith("/") && !lanjut.startsWith("//") ? lanjut : "/dasbor";
  redirect(tujuan);
}

export async function keluar() {
  const db = await klien_server();
  await db.auth.signOut();
  redirect("/masuk");
}
