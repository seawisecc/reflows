import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import { boleh_kirim, batas_hari_ke, type KeputusanKirim } from "@/lib/kampanye/antiban";
import { pengaturan_ringkas } from "./pengaturan";
import type { AngkaKampanye, Kampanye, StatusSasaran } from "@/tipe";

const PILIHAN = `
  id, nama, status, saringan_tag, jeda_min_detik, jeda_maks_detik,
  batas_harian_awal, batas_harian_maks, rem_min_terkirim, rem_rasio_balas,
  rem_alasan, mulai_at, boleh_kirim_lagi_at, dibuat_at,
  langkah_kampanye ( id, urutan, tunda_hari, varian )
`;

function ke_kampanye(baris: Record<string, unknown>): Kampanye {
  const langkah = ((baris.langkah_kampanye ?? []) as Record<string, unknown>[])
    .map((l) => ({
      id: l.id as string,
      urutan: Number(l.urutan),
      tunda_hari: Number(l.tunda_hari),
      varian: (l.varian ?? []) as string[],
    }))
    .sort((a, b) => a.urutan - b.urutan);

  return {
    id: baris.id as string,
    nama: baris.nama as string,
    status: baris.status as Kampanye["status"],
    saringan_tag: (baris.saringan_tag ?? []) as string[],
    jeda_min_detik: Number(baris.jeda_min_detik),
    jeda_maks_detik: Number(baris.jeda_maks_detik),
    batas_harian_awal: Number(baris.batas_harian_awal),
    batas_harian_maks: Number(baris.batas_harian_maks),
    rem_min_terkirim: Number(baris.rem_min_terkirim),
    rem_rasio_balas: Number(baris.rem_rasio_balas),
    rem_alasan: (baris.rem_alasan as string | null) ?? null,
    mulai_at: (baris.mulai_at as string | null) ?? null,
    boleh_kirim_lagi_at: (baris.boleh_kirim_lagi_at as string | null) ?? null,
    dibuat_at: baris.dibuat_at as string,
    langkah,
  };
}

const ANGKA_KOSONG: AngkaKampanye = {
  sasaran_total: 0,
  antre: 0,
  selesai: 0,
  berhenti: 0,
  gagal: 0,
  dibalas: 0,
  tersentuh: 0,
  pesan_terkirim: 0,
  terkirim_hari_ini: 0,
  kuota_terpakai_hari_ini: 0,
  kuota_harian: 0,
  hari_ke: 0,
};

function ke_angka(mentah: unknown): AngkaKampanye {
  const m = (mentah ?? {}) as Record<string, unknown>;
  const n = (k: keyof AngkaKampanye) => Number(m[k] ?? 0);
  return {
    sasaran_total: n("sasaran_total"),
    antre: n("antre"),
    selesai: n("selesai"),
    berhenti: n("berhenti"),
    gagal: n("gagal"),
    dibalas: n("dibalas"),
    tersentuh: n("tersentuh"),
    pesan_terkirim: n("pesan_terkirim"),
    terkirim_hari_ini: n("terkirim_hari_ini"),
    kuota_terpakai_hari_ini: n("kuota_terpakai_hari_ini"),
    kuota_harian: n("kuota_harian"),
    hari_ke: n("hari_ke"),
  };
}

export type KampanyeLengkap = Kampanye & {
  angka: AngkaKampanye;
  /**
   * Kenapa kampanye ini sedang mengirim atau sedang diam, dihitung dengan
   * aturan yang sama persis dengan yang dipakai antrean. Kalau layar
   * menghitung sendiri, suatu saat layar bilang "mengirim" sementara
   * antreannya sudah berhenti berjam-jam.
   */
  keputusan: KeputusanKirim;
};

async function lengkapi(
  db: Awaited<ReturnType<typeof klien_server>>,
  k: Kampanye,
  sekarang: Date,
): Promise<KampanyeLengkap> {
  const pengaturan = await pengaturan_ringkas();
  const { data } = await db.rpc("keadaan_kampanye", {
    p_kampanye_id: k.id,
    p_zona: pengaturan?.zona_waktu ?? "Asia/Makassar",
  });
  const angka = data ? ke_angka(data) : ANGKA_KOSONG;

  return {
    ...k,
    angka,
    keputusan: boleh_kirim({
      status: k.status,
      sekarang,
      jam_mulai: pengaturan?.jam_mulai ?? "08:00",
      jam_selesai: pengaturan?.jam_selesai ?? "20:00",
      zona_waktu: pengaturan?.zona_waktu ?? "Asia/Makassar",
      boleh_kirim_lagi_at: k.boleh_kirim_lagi_at,
      batas_harian_awal: k.batas_harian_awal,
      batas_harian_maks: k.batas_harian_maks,
      hari_ke: angka.hari_ke,
      terkirim_hari_ini: angka.terkirim_hari_ini,
      antre: angka.antre,
      jumlah_langkah: k.langkah.length,
      sisa_kuota_tenant: Math.max(
        0,
        angka.kuota_harian - angka.kuota_terpakai_hari_ini,
      ),
    }),
  };
}

export async function ambil_kampanye(
  sekarang = new Date(),
): Promise<KampanyeLengkap[]> {
  if (!supabase_siap()) return [];

  const db = await klien_server();
  const { data, error } = await db
    .from("kampanye")
    .select(PILIHAN)
    .order("dibuat_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return Promise.all(
    (data as unknown as Record<string, unknown>[]).map((b) =>
      lengkapi(db, ke_kampanye(b), sekarang),
    ),
  );
}

export async function ambil_satu_kampanye(
  id: string,
  sekarang = new Date(),
): Promise<KampanyeLengkap | null> {
  if (!supabase_siap()) return null;

  const db = await klien_server();
  const { data } = await db
    .from("kampanye")
    .select(PILIHAN)
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  return lengkapi(db, ke_kampanye(data as unknown as Record<string, unknown>), sekarang);
}

export type BarisSasaran = {
  id: string;
  status: StatusSasaran;
  langkah_berikutnya: number;
  jadwal_at: string;
  terkirim: number;
  dibalas_at: string | null;
  alasan_berhenti: string | null;
  nama: string;
  nomor_wa: string;
};

export async function ambil_sasaran(
  kampanye_id: string,
  batas = 200,
): Promise<BarisSasaran[]> {
  if (!supabase_siap()) return [];

  const db = await klien_server();
  const { data } = await db
    .from("sasaran_kampanye")
    .select(
      `id, status, langkah_berikutnya, jadwal_at, terkirim, dibalas_at,
       alasan_berhenti, kontak:kontak_id ( nama, nomor_wa )`,
    )
    .eq("kampanye_id", kampanye_id)
    .order("jadwal_at")
    .limit(batas);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map((s) => {
    const kontak = s.kontak as { nama: string | null; nomor_wa: string } | null;
    return {
      id: s.id as string,
      status: s.status as StatusSasaran,
      langkah_berikutnya: Number(s.langkah_berikutnya),
      jadwal_at: s.jadwal_at as string,
      terkirim: Number(s.terkirim),
      dibalas_at: (s.dibalas_at as string | null) ?? null,
      alasan_berhenti: (s.alasan_berhenti as string | null) ?? null,
      nama: kontak?.nama ?? `+${kontak?.nomor_wa ?? ""}`,
      nomor_wa: kontak?.nomor_wa ?? "",
    };
  });
}

/** Semua tag yang sudah pernah dipakai, untuk pilihan saringan. */
export async function ambil_tag(): Promise<{ tag: string; jumlah: number }[]> {
  if (!supabase_siap()) return [];

  const db = await klien_server();
  const { data } = await db.from("kontak").select("tag").limit(1000);

  const hitung = new Map<string, number>();
  for (const baris of (data ?? []) as { tag: string[] | null }[]) {
    for (const t of baris.tag ?? []) {
      hitung.set(t, (hitung.get(t) ?? 0) + 1);
    }
  }
  return [...hitung.entries()]
    .map(([tag, jumlah]) => ({ tag, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.tag.localeCompare(b.tag));
}

export { batas_hari_ke };
