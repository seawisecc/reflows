"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { klien_layanan } from "@/lib/supabase/layanan";
import { catat_pesan_keluar, kredensial_gateway } from "@/lib/gudang-supabase";
import { pilih_gateway } from "@/lib/gateway";
import type { StatusPercakapan } from "@/tipe";

export type KeadaanKirim = {
  galat: string | null;
  terkirim: boolean;
};

const BATAS_ISI = 4096;

/**
 * Memastikan percakapan itu memang milik tenant pengguna yang sedang masuk.
 *
 * Pemeriksaannya lewat klien bersesi, jadi yang menolak adalah Row Level
 * Security, bukan perbandingan tenant_id yang ditulis tangan di sini. Ini
 * disengaja: pengiriman pesan berikutnya memakai service role yang melewati
 * RLS, jadi gerbangnya harus di sini dan harus benar-benar RLS.
 */
async function percakapan_milik_saya(percakapan_id: string) {
  const db = await klien_server();
  const { data } = await db
    .from("percakapan")
    .select("id, tenant_id, kontak:kontak_id ( nomor_wa, opt_out_at )")
    .eq("id", percakapan_id)
    .maybeSingle();

  if (!data) return null;
  const kontak = data.kontak as unknown as {
    nomor_wa: string;
    opt_out_at: string | null;
  } | null;
  if (!kontak) return null;

  return {
    id: data.id as string,
    tenant_id: data.tenant_id as string,
    nomor_wa: kontak.nomor_wa,
    opt_out_at: kontak.opt_out_at,
  };
}

export async function kirim_balasan(
  _sebelumnya: KeadaanKirim,
  data: FormData,
): Promise<KeadaanKirim> {
  const percakapan_id = String(data.get("percakapan_id") ?? "");
  const isi = String(data.get("isi") ?? "").trim();

  if (!isi) return { galat: "Pesannya masih kosong.", terkirim: false };
  if (isi.length > BATAS_ISI) {
    return { galat: `Pesan maksimal ${BATAS_ISI} karakter.`, terkirim: false };
  }

  const percakapan = await percakapan_milik_saya(percakapan_id);
  if (!percakapan) {
    return { galat: "Percakapan tidak ditemukan.", terkirim: false };
  }

  // Kontak yang sudah minta berhenti tidak boleh dikirimi apa pun lagi,
  // termasuk oleh manusia. Kalau memang perlu dihubungi, opt-outnya harus
  // dicabut lebih dulu dengan sadar, bukan dilewati diam-diam.
  if (percakapan.opt_out_at) {
    return {
      galat: "Kontak ini sudah minta berhenti dihubungi.",
      terkirim: false,
    };
  }

  const layanan = klien_layanan();
  const kredensial = await kredensial_gateway(layanan, percakapan.tenant_id);
  const gateway = pilih_gateway({
    gateway: kredensial?.gateway ?? "mock",
    token: kredensial?.token ?? null,
  });

  const hasil = await gateway.kirim({ ke: percakapan.nomor_wa, isi });

  await catat_pesan_keluar(layanan, {
    tenant_id: percakapan.tenant_id,
    percakapan_id: percakapan.id,
    isi,
    pengirim: "manusia",
    status_kirim: hasil.ok ? "terkirim" : "gagal",
    wa_message_id: hasil.ok ? hasil.wa_message_id : null,
  });

  // Begitu manusia ikut bicara, percakapan dipegang manusia sampai
  // dilepas lagi. AI menyela di tengah percakapan yang sedang ditangani
  // orang cuma bikin client bingung.
  await layanan
    .from("percakapan")
    .update({
      status: "manual",
      belum_dibaca: 0,
      pesan_terakhir_at: new Date().toISOString(),
    })
    .eq("id", percakapan.id);

  revalidatePath("/percakapan");
  revalidatePath("/dasbor");

  if (!hasil.ok) {
    return {
      galat: `Gagal terkirim: ${hasil.alasan}. Pesannya tetap tercatat.`,
      terkirim: false,
    };
  }
  return { galat: null, terkirim: true };
}

export async function ubah_status(
  percakapan_id: string,
  status: StatusPercakapan,
): Promise<{ galat: string | null }> {
  const percakapan = await percakapan_milik_saya(percakapan_id);
  if (!percakapan) return { galat: "Percakapan tidak ditemukan." };

  const db = await klien_server();
  const { error } = await db
    .from("percakapan")
    .update({
      status,
      // Alasan eskalasi cuma berlaku selama percakapan masih di tangan
      // manusia. Dilepas lagi ke AI berarti alasannya sudah tidak relevan.
      alasan_eskalasi: status === "manual" ? undefined : null,
      belum_dibaca: 0,
    })
    .eq("id", percakapan_id);

  if (error) return { galat: `Gagal mengubah status: ${error.message}` };

  revalidatePath("/percakapan");
  revalidatePath("/dasbor");
  return { galat: null };
}

/** Menandai percakapan sudah dibaca saat dibuka di inbox. */
export async function tandai_dibaca(percakapan_id: string) {
  const db = await klien_server();
  await db.from("percakapan").update({ belum_dibaca: 0 }).eq("id", percakapan_id);
  revalidatePath("/dasbor");
}
