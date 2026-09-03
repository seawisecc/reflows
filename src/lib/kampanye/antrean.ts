import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  boleh_kirim,
  jeda_acak,
  perlu_direm,
  pilih_varian,
  susun_pesan,
  type SebabDiam,
} from "./antiban";
import { catat_pesan_keluar, kredensial_gateway } from "@/lib/gudang-supabase";
import { izin_layanan } from "@/lib/layanan";
import { pilih_gateway } from "@/lib/gateway";
import type { AngkaKampanye, LangkahKampanye } from "@/tipe";
import { catat_galat } from "@/lib/log";

/**
 * Satu putaran antrean kampanye.
 *
 * Dipanggil cron per menit lewat pg_cron di Supabase, jadi jalur ini memakai
 * service role dan setiap query menyaring tenant_id sendiri.
 *
 * Satu putaran mengirim paling banyak SATU pesan per kampanye. Terlihat
 * lambat, dan memang disengaja: yang menentukan kecepatan adalah jeda acak
 * antar pesan, bukan seberapa rajin cron dipanggil. Mengirim berkelompok
 * dalam satu putaran akan menghasilkan letupan yang persis seperti robot.
 */

export type HasilPutaran = {
  kampanye_id: string;
  nama: string;
  terkirim: boolean;
  jenis: SebabDiam | "terkirim" | "direm" | "gagal-kirim";
  sebab: string;
};

type BarisKampanye = {
  id: string;
  tenant_id: string;
  nama: string;
  status: string;
  jeda_min_detik: number;
  jeda_maks_detik: number;
  batas_harian_awal: number;
  batas_harian_maks: number;
  rem_min_terkirim: number;
  rem_rasio_balas: number;
  boleh_kirim_lagi_at: string | null;
  langkah_kampanye: LangkahKampanye[];
};

type BarisPengaturan = {
  tenant_id: string;
  nama_bisnis: string;
  gateway: string;
  jam_mulai: string;
  jam_selesai: string;
  zona_waktu: string;
  kuota_pesan_harian: number;
  aktif: boolean;
  dijeda_at: string | null;
};

async function pengaturan_tenant(
  db: SupabaseClient,
  tenant_id: string,
): Promise<BarisPengaturan | null> {
  const [{ data: p }, { data: t }] = await Promise.all([
    db
      .from("pengaturan_tenant")
      .select(
        "tenant_id, gateway, jam_mulai, jam_selesai, zona_waktu, kuota_pesan_harian, dijeda_at",
      )
      .eq("tenant_id", tenant_id)
      .maybeSingle(),
    db.from("tenants").select("nama, aktif").eq("id", tenant_id).maybeSingle(),
  ]);
  if (!p) return null;
  return {
    tenant_id: p.tenant_id as string,
    nama_bisnis: (t?.nama as string) ?? "Kami",
    gateway: p.gateway as string,
    jam_mulai: String(p.jam_mulai ?? "").slice(0, 5),
    jam_selesai: String(p.jam_selesai ?? "").slice(0, 5),
    zona_waktu: p.zona_waktu as string,
    kuota_pesan_harian: Number(p.kuota_pesan_harian),
    // Tenant yang barisnya hilang dianggap mati, bukan hidup. Kalau
    // dibalik, kesalahan query justru membuat kampanye tetap mengirim.
    aktif: t?.aktif === true,
    dijeda_at: (p.dijeda_at as string | null) ?? null,
  };
}

/** Percakapan tempat pesan kampanye mendarat, dibuat kalau belum ada. */
async function pastikan_percakapan(
  db: SupabaseClient,
  tenant_id: string,
  kontak_id: string,
): Promise<string | null> {
  const { data: ada } = await db
    .from("percakapan")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("kontak_id", kontak_id)
    .maybeSingle();
  if (ada) return ada.id as string;

  const { data } = await db
    .from("percakapan")
    .insert({ tenant_id, kontak_id })
    .select("id")
    .single();
  return (data?.id as string | undefined) ?? null;
}

export async function jalankan_satu_kampanye(
  db: SupabaseClient,
  kampanye_id: string,
  sekarang = new Date(),
): Promise<HasilPutaran> {
  const { data: k } = await db
    .from("kampanye")
    .select(
      `id, tenant_id, nama, status, jeda_min_detik, jeda_maks_detik,
       batas_harian_awal, batas_harian_maks, rem_min_terkirim, rem_rasio_balas,
       boleh_kirim_lagi_at,
       langkah_kampanye ( id, urutan, tunda_hari, varian )`,
    )
    .eq("id", kampanye_id)
    .maybeSingle();

  if (!k) {
    return {
      kampanye_id,
      nama: "",
      terkirim: false,
      jenis: "status",
      sebab: "Kampanye tidak ditemukan.",
    };
  }

  const kam = k as unknown as BarisKampanye;
  const langkah = [...(kam.langkah_kampanye ?? [])].sort(
    (a, b) => a.urutan - b.urutan,
  );
  const diam = (jenis: HasilPutaran["jenis"], sebab: string): HasilPutaran => ({
    kampanye_id: kam.id,
    nama: kam.nama,
    terkirim: false,
    jenis,
    sebab,
  });

  const pengaturan = await pengaturan_tenant(db, kam.tenant_id);
  if (!pengaturan) return diam("status", "Pengaturan tenant belum ada.");

  // Diperiksa sebelum apa pun yang lain, bahkan sebelum rem otomatis.
  // Layanan yang mati tidak boleh menyentuh gateway sama sekali, dan tidak
  // boleh pula mengubah status kampanye: keadaannya harus persis seperti
  // saat dimatikan begitu dinyalakan lagi.
  const layanan = izin_layanan({
    aktif: pengaturan.aktif,
    dijeda_at: pengaturan.dijeda_at,
  });
  if (!layanan.kampanye) {
    return diam("status", layanan.sebab ?? "Layanan tenant ini sedang mati.");
  }

  const { data: mentah } = await db.rpc("keadaan_kampanye", {
    p_kampanye_id: kam.id,
    p_zona: pengaturan.zona_waktu,
  });
  const angka = (mentah ?? {}) as unknown as AngkaKampanye;

  // Rem otomatis diperiksa sebelum gerbang kirim, karena hasilnya mengubah
  // status kampanye. Kalau diperiksa sesudah, satu pesan lagi sempat keluar
  // dari kampanye yang seharusnya sudah berhenti.
  const rem = perlu_direm({
    tersentuh: Number(angka.tersentuh ?? 0),
    dibalas: Number(angka.dibalas ?? 0),
    rem_min_terkirim: kam.rem_min_terkirim,
    rem_rasio_balas: Number(kam.rem_rasio_balas),
  });
  if (rem.rem && kam.status === "jalan") {
    await db
      .from("kampanye")
      .update({ status: "jeda", rem_alasan: rem.alasan })
      .eq("id", kam.id);
    return diam("direm", rem.alasan);
  }

  // Antrean habis berarti kampanye ini selesai. Ditandai sekarang supaya
  // putaran berikutnya tidak perlu memeriksanya lagi.
  if (
    kam.status === "jalan" &&
    Number(angka.antre ?? 0) === 0 &&
    Number(angka.sasaran_total ?? 0) > 0
  ) {
    await db.from("kampanye").update({ status: "selesai" }).eq("id", kam.id);
    return diam("antrean-kosong", "Semua sasaran sudah tuntas.");
  }

  // Sisa kuota datang dari SQL, bukan dihitung ulang di sini. Batas hari
  // harus tengah malam di tempat tenant, dan menghitungnya di JavaScript
  // berarti menyalin logika zona waktu yang sudah ada di database.
  const sisa = Math.max(
    0,
    Number(angka.kuota_harian ?? 0) - Number(angka.kuota_terpakai_hari_ini ?? 0),
  );

  const izin = boleh_kirim({
    status: kam.status,
    sekarang,
    jam_mulai: pengaturan.jam_mulai,
    jam_selesai: pengaturan.jam_selesai,
    zona_waktu: pengaturan.zona_waktu,
    boleh_kirim_lagi_at: kam.boleh_kirim_lagi_at,
    batas_harian_awal: kam.batas_harian_awal,
    batas_harian_maks: kam.batas_harian_maks,
    hari_ke: Number(angka.hari_ke ?? 1),
    terkirim_hari_ini: Number(angka.terkirim_hari_ini ?? 0),
    antre: Number(angka.antre ?? 0),
    jumlah_langkah: langkah.length,
    sisa_kuota_tenant: sisa,
  });
  if (!izin.kirim) return diam(izin.jenis, izin.sebab);

  const { data: klaim } = await db.rpc("klaim_sasaran", {
    p_kampanye_id: kam.id,
  });
  const sasaran = (klaim as unknown as {
    sasaran_id: string;
    kontak_id: string;
    nomor_wa: string;
    nama: string | null;
    langkah_berikutnya: number;
    terkirim: number;
  }[] | null)?.[0];

  if (!sasaran) {
    return diam("antrean-kosong", "Tidak ada sasaran yang bisa dikunci.");
  }

  const langkah_ini =
    langkah.find((l) => l.urutan === sasaran.langkah_berikutnya) ?? null;
  if (!langkah_ini) {
    // Langkahnya dihapus setelah sasaran ini dijadwalkan. Sasarannya
    // ditutup, bukan digantung selamanya di antrean.
    await db
      .from("sasaran_kampanye")
      .update({ status: "selesai", alasan_berhenti: "Langkahnya sudah tidak ada" })
      .eq("id", sasaran.sasaran_id);
    return diam("tanpa-langkah", "Langkah untuk sasaran ini sudah dihapus.");
  }

  const isi = susun_pesan(
    pilih_varian(langkah_ini.varian, sasaran.sasaran_id),
    { nama: sasaran.nama, bisnis: pengaturan.nama_bisnis },
  );
  if (!isi) {
    await db
      .from("sasaran_kampanye")
      .update({ status: "gagal", alasan_berhenti: "Templat langkahnya kosong" })
      .eq("id", sasaran.sasaran_id);
    return diam("tanpa-langkah", "Templat langkah ini kosong.");
  }

  const percakapan_id = await pastikan_percakapan(
    db,
    kam.tenant_id,
    sasaran.kontak_id,
  );
  if (!percakapan_id) return diam("status", "Gagal menyiapkan percakapan.");

  const kredensial = await kredensial_gateway(db, kam.tenant_id);
  const gateway = pilih_gateway({
    gateway: kredensial?.gateway ?? "mock",
    token: kredensial?.token ?? null,
  });
  const hasil = await gateway.kirim({ ke: sasaran.nomor_wa, isi });

  await catat_pesan_keluar(db, {
    tenant_id: kam.tenant_id,
    percakapan_id,
    isi,
    pengirim: "kampanye",
    status_kirim: hasil.ok ? "terkirim" : "gagal",
    wa_message_id: hasil.ok ? hasil.wa_message_id : null,
    kampanye_id: kam.id,
  });

  // Jeda berikutnya dipasang entah pengirimannya berhasil atau tidak.
  // Gateway yang sedang menolak justru saat paling penting untuk melambat.
  const jeda = jeda_acak(kam.jeda_min_detik, kam.jeda_maks_detik);
  await db
    .from("kampanye")
    .update({
      boleh_kirim_lagi_at: new Date(
        sekarang.getTime() + jeda * 1000,
      ).toISOString(),
    })
    .eq("id", kam.id);

  if (!hasil.ok) {
    // Dikembalikan ke antrean, bukan digagalkan. klaim_sasaran sudah
    // menggeser jadwalnya lima menit ke depan, jadi ini otomatis jadi
    // percobaan ulang yang tidak menabrak putaran berikutnya.
    return diam("gagal-kirim", `Gateway menolak: ${hasil.alasan}`);
  }

  const berikutnya = langkah.find((l) => l.urutan > langkah_ini.urutan) ?? null;
  await db
    .from("sasaran_kampanye")
    .update(
      berikutnya
        ? {
            terkirim: sasaran.terkirim + 1,
            langkah_berikutnya: berikutnya.urutan,
            jadwal_at: new Date(
              sekarang.getTime() + berikutnya.tunda_hari * 86400_000,
            ).toISOString(),
            status: "antre",
          }
        : {
            terkirim: sasaran.terkirim + 1,
            status: "selesai",
          },
    )
    .eq("id", sasaran.sasaran_id);

  return {
    kampanye_id: kam.id,
    nama: kam.nama,
    terkirim: true,
    jenis: "terkirim",
    sebab: `Langkah ${langkah_ini.urutan + 1} terkirim ke ${sasaran.nomor_wa}, jeda berikutnya ${jeda} detik.`,
  };
}

/** Semua kampanye yang sedang jalan, satu putaran masing-masing. */
export async function jalankan_antrean(
  db: SupabaseClient,
  sekarang = new Date(),
): Promise<HasilPutaran[]> {
  const { data } = await db
    .from("kampanye")
    .select("id")
    .eq("status", "jalan")
    .order("dibuat_at");

  const daftar = (data ?? []) as { id: string }[];
  const hasil: HasilPutaran[] = [];
  for (const k of daftar) {
    try {
      hasil.push(await jalankan_satu_kampanye(db, k.id, sekarang));
    } catch (e) {
      // Hasilnya dikembalikan ke pemanggil, tapi pemanggilnya pg_cron yang
      // tidak membaca badan jawaban. Tanpa baris log ini, kampanye yang
      // gagal tiap menit tidak meninggalkan jejak di mana pun.
      catat_galat("kampanye.putaran-gagal", e, { kampanye_id: k.id });
      hasil.push({
        kampanye_id: k.id,
        nama: "",
        terkirim: false,
        jenis: "gagal-kirim",
        sebab: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return hasil;
}
