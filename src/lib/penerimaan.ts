import type { PesanMasuk } from "./gateway";
import { dalam_jam_aktif, minta_berhenti, perlu_eskalasi } from "./aturan";
import { nomor_sama } from "./gateway/nomor";
import type { ModeBalas, StatusPercakapan } from "@/tipe";

/** Jeda minimum sebelum pemberitahuan di luar jam kerja boleh diulang. */
export const JEDA_PESAN_LUAR_JAM_JAM = 12;

export type KonteksTenant = {
  tenant_id: string;
  nomor_wa: string | null;
  mode_balas: ModeBalas;
  jam_mulai: string;
  jam_selesai: string;
  zona_waktu: string;
  pesan_di_luar_jam: string | null;
};

export type BarisKontak = { id: string; opt_out_at: string | null };

export type BarisPercakapan = {
  id: string;
  status: StatusPercakapan;
  luar_jam_dibalas_at: string | null;
};

/**
 * Port penyimpanan. Logika penerimaan tidak boleh tahu soal Supabase,
 * supaya bisa diuji tanpa database dan supaya penggantian penyimpanan
 * tidak menyentuh aturan bisnisnya.
 */
export interface Gudang {
  tenant_dari_rahasia(rahasia: string): Promise<KonteksTenant | null>;
  pesan_sudah_ada(tenant_id: string, wa_message_id: string): Promise<boolean>;
  pastikan_kontak(
    tenant_id: string,
    nomor: string,
    nama: string | null,
  ): Promise<BarisKontak>;
  pastikan_percakapan(
    tenant_id: string,
    kontak_id: string,
  ): Promise<BarisPercakapan>;
  catat_pesan_masuk(masukan: {
    tenant_id: string;
    percakapan_id: string;
    isi: string;
    wa_message_id: string | null;
    waktu: string;
  }): Promise<string>;
  tandai_opt_out(kontak_id: string, waktu: string): Promise<void>;
  ubah_status_percakapan(
    percakapan_id: string,
    status: StatusPercakapan,
    alasan_eskalasi: string | null,
  ): Promise<void>;
  catat_luar_jam_dibalas(percakapan_id: string, waktu: string): Promise<void>;
}

export type HasilTerima =
  | { jenis: "ditolak"; sebab: string }
  | { jenis: "dobel"; pesan_id: null }
  | {
      jenis: "tersimpan";
      pesan_id: string;
      tenant_id: string;
      percakapan_id: string;
      status: StatusPercakapan;
      alasan_eskalasi: string | null;
      opt_out: boolean;
      /** Teks yang harus dikirim balik, atau null kalau tidak perlu. */
      balasan_otomatis: string | null;
    };

function lewat_jeda(terakhir: string | null, sekarang: Date): boolean {
  if (!terakhir) return true;
  const selisih = sekarang.getTime() - new Date(terakhir).getTime();
  if (Number.isNaN(selisih)) return true;
  return selisih >= JEDA_PESAN_LUAR_JAM_JAM * 3600_000;
}

/**
 * Menerima satu pesan masuk dan memutuskan perlakuannya.
 *
 * Urutan pemeriksaannya disengaja. Rahasia dan nomor perangkat diperiksa
 * lebih dulu karena webhook Fonnte tidak ditandatangani, jadi permintaan
 * palsu harus ditolak sebelum menyentuh data. Pemeriksaan dobel menyusul
 * karena gateway bisa mengirim ulang webhook yang sama.
 */
export async function terima_pesan(
  gudang: Gudang,
  masukan: { rahasia: string; pesan: PesanMasuk; sekarang?: Date },
): Promise<HasilTerima> {
  const sekarang = masukan.sekarang ?? new Date();
  const { pesan } = masukan;

  const tenant = await gudang.tenant_dari_rahasia(masukan.rahasia);
  if (!tenant) return { jenis: "ditolak", sebab: "rahasia webhook tidak dikenali" };

  // Rahasia yang benar pun tidak cukup. Nomor perangkat harus nomor tenant
  // itu, kalau tidak satu rahasia yang bocor bisa dipakai menyuntik pesan
  // seolah-olah datang ke nomor mana saja.
  if (tenant.nomor_wa && !nomor_sama(tenant.nomor_wa, pesan.nomor_perangkat)) {
    return { jenis: "ditolak", sebab: "nomor perangkat bukan milik tenant ini" };
  }

  if (pesan.wa_message_id) {
    const ada = await gudang.pesan_sudah_ada(tenant.tenant_id, pesan.wa_message_id);
    if (ada) return { jenis: "dobel", pesan_id: null };
  }

  const kontak = await gudang.pastikan_kontak(
    tenant.tenant_id,
    pesan.nomor_pengirim,
    pesan.nama_pengirim,
  );
  const percakapan = await gudang.pastikan_percakapan(tenant.tenant_id, kontak.id);

  const pesan_id = await gudang.catat_pesan_masuk({
    tenant_id: tenant.tenant_id,
    percakapan_id: percakapan.id,
    isi: pesan.isi,
    wa_message_id: pesan.wa_message_id,
    waktu: pesan.waktu,
  });

  // Permintaan berhenti menutup semuanya. Tidak ada balasan otomatis, tidak
  // ada eskalasi. Membalas orang yang minta berhenti justru memperburuk.
  if (minta_berhenti(pesan.isi)) {
    await gudang.tandai_opt_out(kontak.id, sekarang.toISOString());
    await gudang.ubah_status_percakapan(percakapan.id, "selesai", null);
    return {
      jenis: "tersimpan",
      pesan_id,
      tenant_id: tenant.tenant_id,
      percakapan_id: percakapan.id,
      status: "selesai",
      alasan_eskalasi: null,
      opt_out: true,
      balasan_otomatis: null,
    };
  }

  const eskalasi = perlu_eskalasi(pesan.isi);
  let status: StatusPercakapan = percakapan.status === "selesai" ? "ai" : percakapan.status;
  let alasan: string | null = null;

  if (eskalasi.eskalasi) {
    status = "manual";
    alasan = eskalasi.alasan;
  } else if (tenant.mode_balas === "draf") {
    // Mode draf berarti tidak ada yang terkirim tanpa persetujuan manusia.
    status = "manual";
    alasan = "Mode draf, semua balasan menunggu persetujuan";
  }

  if (status !== percakapan.status || alasan !== null) {
    await gudang.ubah_status_percakapan(percakapan.id, status, alasan);
  }

  let balasan: string | null = null;
  const di_luar_jam = !dalam_jam_aktif(
    sekarang,
    tenant.jam_mulai,
    tenant.jam_selesai,
    tenant.zona_waktu,
  );
  if (
    di_luar_jam &&
    tenant.pesan_di_luar_jam &&
    lewat_jeda(percakapan.luar_jam_dibalas_at, sekarang)
  ) {
    balasan = tenant.pesan_di_luar_jam;
    await gudang.catat_luar_jam_dibalas(percakapan.id, sekarang.toISOString());
  }

  return {
    jenis: "tersimpan",
    pesan_id,
    tenant_id: tenant.tenant_id,
    percakapan_id: percakapan.id,
    status,
    alasan_eskalasi: alasan,
    opt_out: false,
    balasan_otomatis: balasan,
  };
}
