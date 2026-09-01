"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { klien_layanan } from "@/lib/supabase/layanan";
import { tenant_saya } from "@/lib/data/pengaturan";
import { enkripsi } from "@/lib/rahasia";
import { kredensial_gateway } from "@/lib/gudang-supabase";
import { normalkan_nomor, pilih_gateway } from "@/lib/gateway";
import type { HasilQr } from "@/lib/gateway/jenis";
import type { ModeBalas } from "@/tipe";

export type KeadaanPengaturan = {
  galat: string | null;
  pesan: string | null;
};

const MODE_SAH: ModeBalas[] = ["hybrid", "draf", "otomatis"];
const GATEWAY_SAH = ["mock", "fonnte"];
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

function angka(nilai: FormDataEntryValue | null, bawaan: number): number {
  const n = Number(String(nilai ?? "").trim());
  return Number.isFinite(n) ? n : bawaan;
}

export async function simpan_pengaturan(
  _sebelumnya: KeadaanPengaturan,
  data: FormData,
): Promise<KeadaanPengaturan> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis. Masuk lagi ya.", pesan: null };

  const gateway = String(data.get("gateway") ?? "mock");
  const mode_balas = String(data.get("mode_balas") ?? "hybrid") as ModeBalas;
  const jam_mulai = String(data.get("jam_mulai") ?? "").trim();
  const jam_selesai = String(data.get("jam_selesai") ?? "").trim();
  const zona_waktu = String(data.get("zona_waktu") ?? "Asia/Makassar");
  const pesan_di_luar_jam = String(data.get("pesan_di_luar_jam") ?? "").trim();
  const ambang = angka(data.get("ambang_keyakinan"), 85);
  const kuota = angka(data.get("kuota_pesan_harian"), 300);
  const nomor_mentah = String(data.get("nomor_wa") ?? "").trim();
  const token_baru = String(data.get("token") ?? "").trim();

  if (!GATEWAY_SAH.includes(gateway)) {
    return { galat: "Penyedia gateway tidak dikenali.", pesan: null };
  }
  if (!MODE_SAH.includes(mode_balas)) {
    return { galat: "Mode balas tidak dikenali.", pesan: null };
  }
  if (!POLA_JAM.test(jam_mulai) || !POLA_JAM.test(jam_selesai)) {
    return { galat: "Jam aktif harus dalam bentuk HH:MM.", pesan: null };
  }
  if (ambang < 50 || ambang > 100) {
    return { galat: "Ambang keyakinan harus antara 50 dan 100.", pesan: null };
  }
  if (kuota < 1 || kuota > 2000) {
    return { galat: "Kuota harian harus antara 1 dan 2000.", pesan: null };
  }
  try {
    Intl.DateTimeFormat("en-GB", { timeZone: zona_waktu });
  } catch {
    return { galat: `Zona waktu "${zona_waktu}" tidak dikenali.`, pesan: null };
  }

  let nomor_wa: string | null = null;
  if (nomor_mentah) {
    nomor_wa = normalkan_nomor(nomor_mentah);
    if (!nomor_wa) {
      return {
        galat: `Nomor "${nomor_mentah}" tidak terbaca sebagai nomor WhatsApp.`,
        pesan: null,
      };
    }
  }

  // Kolom biasa ditulis lewat klien bersesi, jadi tetap kena RLS.
  const db = await klien_server();
  const { error } = await db
    .from("pengaturan_tenant")
    .update({
      gateway,
      nomor_wa,
      mode_balas,
      ambang_keyakinan: ambang / 100,
      jam_mulai,
      jam_selesai,
      zona_waktu,
      pesan_di_luar_jam: pesan_di_luar_jam || null,
      kuota_pesan_harian: kuota,
    })
    .eq("tenant_id", tenant_id);

  if (error) return { galat: `Gagal menyimpan: ${error.message}`, pesan: null };

  // Token disandi dulu, dan ditulis lewat service role karena kolomnya
  // memang dicabut dari peran authenticated. Kosong berarti tidak diubah,
  // bukan dihapus, supaya tidak hilang gara-gara form disimpan ulang.
  let catatan_token = "";
  if (token_baru) {
    try {
      await klien_layanan()
        .from("pengaturan_tenant")
        .update({ gateway_token_terenkripsi: enkripsi(token_baru) })
        .eq("tenant_id", tenant_id);
      catatan_token = " Token gateway diperbarui.";
    } catch (e) {
      return {
        galat: `Pengaturan tersimpan, tapi token gagal disandi: ${
          e instanceof Error ? e.message : String(e)
        }`,
        pesan: null,
      };
    }
  }

  revalidatePath("/pengaturan");
  revalidatePath("/dasbor");
  return { galat: null, pesan: `Pengaturan tersimpan.${catatan_token}` };
}

/** Menghapus token gateway. Disediakan terpisah supaya tidak pernah tidak sengaja. */
export async function hapus_token(): Promise<KeadaanPengaturan> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis.", pesan: null };

  await klien_layanan()
    .from("pengaturan_tenant")
    .update({ gateway_token_terenkripsi: null })
    .eq("tenant_id", tenant_id);

  revalidatePath("/pengaturan");
  return { galat: null, pesan: "Token gateway dihapus." };
}

export async function ambil_qr(): Promise<HasilQr> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { keadaan: "gagal", alasan: "Sesi kamu sudah habis." };

  const layanan = klien_layanan();
  const kredensial = await kredensial_gateway(layanan, tenant_id);

  if (kredensial?.gateway === "fonnte" && !kredensial.token) {
    return {
      keadaan: "gagal",
      alasan: "Token Fonnte belum diisi. Simpan tokennya dulu di atas.",
    };
  }

  const gateway = pilih_gateway({
    gateway: kredensial?.gateway ?? "mock",
    token: kredensial?.token ?? null,
  });
  return gateway.qr();
}
