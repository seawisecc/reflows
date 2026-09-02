"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { klien_layanan } from "@/lib/supabase/layanan";
import { tenant_saya } from "@/lib/data/pengaturan";
import { enkripsi } from "@/lib/rahasia";
import { kredensial_gateway } from "@/lib/gudang-supabase";
import { normalkan_nomor, pilih_gateway } from "@/lib/gateway";
import type { HasilQr, ProfilPerangkat } from "@/lib/gateway/jenis";
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

export type HasilPeriksaPerangkat =
  | { ok: true; profil: ProfilPerangkat; nomor_diselaraskan: boolean }
  | { ok: false; alasan: string };

/**
 * Menanyakan keadaan perangkat ke gateway, menyimpannya, dan menyelaraskan
 * nomor pengirim dengan nomor yang benar-benar tersambung.
 *
 * Penyelarasan itu bukan kemewahan. Nomor pengirim dipakai memastikan pesan
 * masuk memang ditujukan ke tenant ini. Kalau nilainya meleset dari nomor
 * yang sungguhan, semua pesan client ditolak diam-diam dan tidak ada yang
 * tahu sampai ada yang mengeluh tidak dibalas.
 */
export async function periksa_perangkat(): Promise<HasilPeriksaPerangkat> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { ok: false, alasan: "Sesi kamu sudah habis." };

  const layanan = klien_layanan();
  const kredensial = await kredensial_gateway(layanan, tenant_id);

  if (kredensial?.gateway === "fonnte" && !kredensial.token) {
    return { ok: false, alasan: "Token Fonnte belum diisi." };
  }

  const gateway = pilih_gateway({
    gateway: kredensial?.gateway ?? "mock",
    token: kredensial?.token ?? null,
  });

  const hasil = await gateway.profil();
  if (!hasil.ok) return { ok: false, alasan: hasil.alasan };

  const p = hasil.profil;
  const perlu_selaras = Boolean(p.nomor) && p.nomor !== kredensial?.nomor_wa;

  await layanan
    .from("pengaturan_tenant")
    .update({
      perangkat_tersambung: p.tersambung,
      perangkat_nama: p.nama,
      perangkat_paket: p.paket,
      perangkat_kuota: p.kuota,
      perangkat_kedaluwarsa: p.kedaluwarsa,
      perangkat_diperiksa_at: new Date().toISOString(),
      ...(perlu_selaras ? { nomor_wa: p.nomor } : {}),
    })
    .eq("tenant_id", tenant_id);

  revalidatePath("/pengaturan");
  revalidatePath("/dasbor");
  revalidatePath("/percakapan");
  return { ok: true, profil: p, nomor_diselaraskan: perlu_selaras };
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

/**
 * Menjeda dan menyalakan kembali otomasi, dipegang pemilik sendiri.
 *
 * Tidak ada satu baris pun yang dihapus. Nomor WhatsApp, token gateway,
 * rahasia webhook, materi admin, kontak, kampanye, dan seluruh riwayat
 * percakapan tetap di tempatnya. Menyalakan lagi berarti mengosongkan satu
 * kolom, bukan menyiapkan ulang dari nol.
 *
 * Saklar ini TIDAK bisa melepas suspensi dari Seawise. Suspensi ada di
 * tabel tenants yang tidak punya kebijakan RLS untuk update, jadi permintaan
 * dari browser tidak menyentuh satu baris pun di sana.
 */
export async function ubah_jeda(
  jeda: boolean,
  alasan?: string,
): Promise<{ galat: string | null }> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis. Masuk lagi ya." };

  const db = await klien_server();
  const { error } = await db
    .from("pengaturan_tenant")
    .update(
      jeda
        ? {
            dijeda_at: new Date().toISOString(),
            alasan_jeda: (alasan ?? "").trim().slice(0, 200) || null,
          }
        : { dijeda_at: null, alasan_jeda: null },
    )
    .eq("tenant_id", tenant_id);

  if (error) return { galat: `Gagal mengubah: ${error.message}` };

  revalidatePath("/pengaturan");
  revalidatePath("/dasbor");
  revalidatePath("/percakapan");
  revalidatePath("/kampanye");
  return { galat: null };
}

/**
 * Identitas penerbit invoice.
 *
 * Terpisah dari simpan_pengaturan karena isinya beda urusan, dan karena
 * form yang terlalu panjang membuat orang menyimpan hal yang tidak sengaja
 * mereka ubah. Kolom-kolom ini cuma dibaca saat invoice diterbitkan, lalu
 * disalin ke barisnya, jadi mengubahnya tidak menyentuh invoice lama.
 */
export async function simpan_pengaturan_invoice(
  _sebelumnya: KeadaanPengaturan,
  data: FormData,
): Promise<KeadaanPengaturan> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis. Masuk lagi ya.", pesan: null };

  const ppn = Number(String(data.get("ppn_persen") ?? "0").replace(",", "."));
  if (!Number.isFinite(ppn) || ppn < 0 || ppn > 100) {
    return { galat: "PPN harus antara 0 dan 100 persen.", pesan: null };
  }

  const tempo = Number(String(data.get("tempo_hari") ?? "7").replace(/[^\d]/g, ""));
  if (!Number.isFinite(tempo) || tempo < 0 || tempo > 365) {
    return { galat: "Tempo pembayaran harus antara 0 dan 365 hari.", pesan: null };
  }

  const teks = (kunci: string, batas: number) =>
    String(data.get(kunci) ?? "").trim().slice(0, batas) || null;

  const db = await klien_server();
  const { error } = await db
    .from("pengaturan_tenant")
    .update({
      alamat_bisnis: teks("alamat_bisnis", 300),
      bank_nama: teks("bank_nama", 60),
      bank_rekening: teks("bank_rekening", 40),
      bank_atas_nama: teks("bank_atas_nama", 120),
      catatan_invoice: teks("catatan_invoice", 1000),
      ppn_persen: ppn,
      tempo_hari: tempo,
    })
    .eq("tenant_id", tenant_id);

  if (error) return { galat: `Gagal menyimpan: ${error.message}`, pesan: null };

  revalidatePath("/pengaturan");
  revalidatePath("/invoice");
  return {
    galat: null,
    pesan: "Identitas invoice tersimpan. Invoice yang sudah terbit tidak ikut berubah.",
  };
}

/**
 * Batas kelebihan kuota, dipegang tenant sendiri.
 *
 * Kosong berarti tanpa batas: AI terus membalas dan kelebihannya ditagih.
 * Nol berarti AI berhenti tepat saat kuota habis. Keduanya pilihan yang sah,
 * dan yang tidak sah adalah memilihkannya diam-diam untuk tenant.
 */
export async function simpan_batas_kelebihan(
  mentah: string,
): Promise<{ galat: string | null }> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis. Masuk lagi ya." };

  const bersih = mentah.trim();
  let nilai: number | null = null;
  if (bersih !== "") {
    const n = Number(bersih.replace(/[^\d]/g, ""));
    if (!Number.isFinite(n) || n < 0 || n > 100_000) {
      return { galat: "Batas kelebihan harus angka antara 0 dan 100.000." };
    }
    nilai = Math.floor(n);
  }

  const db = await klien_server();
  const { error } = await db
    .from("pengaturan_tenant")
    .update({ batas_kelebihan: nilai })
    .eq("tenant_id", tenant_id);
  if (error) return { galat: `Gagal menyimpan: ${error.message}` };

  revalidatePath("/pengaturan");
  revalidatePath("/penggunaan");
  revalidatePath("/dasbor");
  return { galat: null };
}
