import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { susun_instruksi } from "./ai/instruksi";
import { susun_balasan, type Jejak } from "./ai/balas";
import { catat_pesan_keluar, kredensial_gateway } from "./gudang-supabase";
import { pilih_gateway } from "./gateway";
import { izin_kuota, paket_sah, type NamaPaket } from "./paket";
import type { ButirPengetahuan, ModeBalas, Pesan } from "@/tipe";

/**
 * Merangkai satu putaran balasan otomatis, dari membaca materi admin sampai
 * pesannya benar-benar terkirim.
 *
 * Dipanggil dari jalur webhook yang memakai service role, jadi setiap query
 * menyaring tenant_id sendiri. Kegagalan di sini tidak boleh menjatuhkan
 * webhook: pesan client sudah tersimpan, dan itu bagian yang tidak boleh
 * hilang. Yang gagal cuma balasannya, dan percakapannya dilempar ke manusia.
 */

export type HasilBalasOtomatis = {
  tindakan: "kirim" | "draf" | "eskalasi" | "lewat";
  alasan: string | null;
};

/**
 * Sisa kuota balasan AI bulan ini.
 *
 * Diperiksa sebelum model dipanggil, bukan sesudah. Memanggil model lalu
 * membuang hasilnya tetap dibayar, dan itu persis biaya yang kuotanya
 * seharusnya cegah.
 */
async function boleh_pakai_kuota(
  db: SupabaseClient,
  tenant_id: string,
): Promise<{ boleh: boolean; sebab: string | null }> {
  const { data } = await db.rpc("kuota_bulan_ini", { p_tenant_id: tenant_id });
  if (!data) return { boleh: true, sebab: null };

  const m = data as unknown as Record<string, unknown>;
  const paket = m.paket;
  // Paket yang tidak dikenali tidak boleh menghentikan balasan. Kesalahan
  // konfigurasi kita tidak boleh berujung client tenant tidak dibalas.
  if (!paket_sah(paket)) return { boleh: true, sebab: null };

  const batas = m.batas_kelebihan;
  const izin = izin_kuota({
    paket: paket as NamaPaket,
    terpakai: Number(m.terpakai ?? 0),
    batas_kelebihan:
      batas === null || batas === undefined ? null : Number(batas),
  });
  return { boleh: izin.boleh, sebab: izin.sebab };
}

async function catat_jejak(
  db: SupabaseClient,
  tenant_id: string,
  pesan_id: string | null,
  jejak: Jejak,
  keyakinan: number | null,
  dieskalasi: boolean,
  alasan: string | null,
) {
  await db.from("jalan_ai").insert({
    tenant_id,
    pesan_id,
    model: jejak.model,
    token_masuk: jejak.token_masuk,
    token_keluar: jejak.token_keluar,
    token_cache_baca: jejak.token_cache_baca,
    token_cache_tulis: jejak.token_cache_tulis,
    latensi_ms: jejak.latensi_ms,
    keyakinan,
    dieskalasi,
    alasan,
  });
}

export async function balas_otomatis(
  db: SupabaseClient,
  masukan: {
    tenant_id: string;
    percakapan_id: string;
    nomor_kontak: string;
    mode_balas: ModeBalas;
    ambang_keyakinan: number;
  },
): Promise<HasilBalasOtomatis> {
  const kuota = await boleh_pakai_kuota(db, masukan.tenant_id);
  if (!kuota.boleh) {
    // Dilempar ke manusia dengan alasan yang jelas, bukan didiamkan.
    // Percakapan yang berhenti tanpa penjelasan terlihat seperti kerusakan.
    await db
      .from("percakapan")
      .update({ status: "manual", alasan_eskalasi: kuota.sebab })
      .eq("id", masukan.percakapan_id);
    return { tindakan: "eskalasi", alasan: kuota.sebab };
  }

  const [{ data: tenant }, { data: materi }, { data: riwayat }] = await Promise.all([
    db.from("tenants").select("nama").eq("id", masukan.tenant_id).maybeSingle(),
    db
      .from("pengetahuan")
      .select("id, tipe, judul, isi, harga, aktif")
      .eq("tenant_id", masukan.tenant_id),
    db
      .from("pesan")
      .select("id, arah, pengirim, isi, status_kirim, dibuat_at")
      .eq("percakapan_id", masukan.percakapan_id)
      .order("dibuat_at", { ascending: true })
      .limit(30),
  ]);

  const pesan: Pesan[] = (riwayat ?? [])
    // Draf yang belum disetujui bukan bagian percakapan. Kalau ikut dikirim
    // ke model, AI mengira dirinya sudah membalas padahal belum.
    .filter((p) => !(p.arah === "keluar" && p.status_kirim === "antre"))
    .map((p) => ({
      id: p.id as string,
      arah: p.arah as Pesan["arah"],
      pengirim: p.pengirim as Pesan["pengirim"],
      isi: p.isi as string,
      status_kirim: p.status_kirim as Pesan["status_kirim"],
      waktu: p.dibuat_at as string,
    }));

  const instruksi = susun_instruksi(
    (tenant?.nama as string) ?? "Bisnis ini",
    ((materi ?? []) as unknown as ButirPengetahuan[]).map((b) => ({
      ...b,
      harga: b.harga === null ? null : Number(b.harga),
    })),
  );

  const keputusan = await susun_balasan({
    instruksi,
    pesan,
    mode_balas: masukan.mode_balas,
    ambang_keyakinan: masukan.ambang_keyakinan,
  });

  if (keputusan.jenis === "gagal") {
    await db
      .from("percakapan")
      .update({ status: "manual", alasan_eskalasi: keputusan.alasan })
      .eq("id", masukan.percakapan_id);
    return { tindakan: "eskalasi", alasan: keputusan.alasan };
  }

  if (keputusan.jenis === "eskalasi") {
    if (keputusan.jejak) {
      await catat_jejak(
        db,
        masukan.tenant_id,
        null,
        keputusan.jejak,
        null,
        true,
        keputusan.alasan,
      );
    }
    await db
      .from("percakapan")
      .update({ status: "manual", alasan_eskalasi: keputusan.alasan })
      .eq("id", masukan.percakapan_id);
    return { tindakan: "eskalasi", alasan: keputusan.alasan };
  }

  if (keputusan.jenis === "draf") {
    // Draf disimpan sebagai pesan keluar berstatus antre. Belum dikirim ke
    // mana pun, menunggu pemilik menyetujuinya di inbox.
    const pesan_id = await catat_pesan_keluar(db, {
      tenant_id: masukan.tenant_id,
      percakapan_id: masukan.percakapan_id,
      isi: keputusan.teks,
      pengirim: "ai",
      status_kirim: "antre",
      wa_message_id: null,
    });
    await catat_jejak(
      db,
      masukan.tenant_id,
      pesan_id,
      keputusan.jejak,
      keputusan.keyakinan,
      false,
      keputusan.alasan,
    );
    await db
      .from("percakapan")
      .update({ status: "manual", alasan_eskalasi: keputusan.alasan })
      .eq("id", masukan.percakapan_id);
    return { tindakan: "draf", alasan: keputusan.alasan };
  }

  const kredensial = await kredensial_gateway(db, masukan.tenant_id);
  const gateway = pilih_gateway({
    gateway: kredensial?.gateway ?? "mock",
    token: kredensial?.token ?? null,
  });
  const terkirim = await gateway.kirim({
    ke: masukan.nomor_kontak,
    isi: keputusan.teks,
  });

  const pesan_id = await catat_pesan_keluar(db, {
    tenant_id: masukan.tenant_id,
    percakapan_id: masukan.percakapan_id,
    isi: keputusan.teks,
    pengirim: "ai",
    status_kirim: terkirim.ok ? "terkirim" : "gagal",
    wa_message_id: terkirim.ok ? terkirim.wa_message_id : null,
  });

  await catat_jejak(
    db,
    masukan.tenant_id,
    pesan_id,
    keputusan.jejak,
    keputusan.keyakinan,
    false,
    null,
  );

  if (!terkirim.ok) {
    // Balasannya bagus tapi gagal keluar. Itu urusan manusia, bukan urusan
    // model, jadi percakapan dilempar ke antrean manual dengan alasan jelas.
    await db
      .from("percakapan")
      .update({
        status: "manual",
        alasan_eskalasi: `Balasan AI gagal terkirim: ${terkirim.alasan}`,
      })
      .eq("id", masukan.percakapan_id);
    return { tindakan: "eskalasi", alasan: terkirim.alasan };
  }

  await db
    .from("percakapan")
    .update({ pesan_terakhir_at: new Date().toISOString() })
    .eq("id", masukan.percakapan_id);

  return { tindakan: "kirim", alasan: null };
}
