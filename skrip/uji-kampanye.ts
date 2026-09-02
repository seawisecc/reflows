/**
 * Uji mesin kampanye keluar dari ujung ke ujung, terhadap Supabase dan
 * jalur antrean yang sungguhan.
 *
 * Uji unit sudah menutup aturan anti-ban dengan fungsi murni. Yang belum
 * terbukti adalah perkara yang cuma muncul di jalur nyata: penguncian
 * klaim_sasaran, kunci unik saat mendaftarkan kontak dua kali, penanda
 * kampanye_id di tabel pesan, dan apakah RPC-nya benar-benar boleh
 * dipanggil service role.
 *
 * Nomor sasarannya memakai kode negara 999 yang dicadangkan ITU. Kampanye
 * benar-benar mengirim, jadi nomor berprefix Indonesia berarti orang asing
 * menerima pesan promosi dari nomor bisnis tenant setiap kali uji ini jalan.
 * Fonnte akan menolak nomor 999, dan penolakan itu justru ikut diuji.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

const ALAMAT = process.env.ALAMAT_UJI ?? "https://reflows.seawise.id";
const NOMOR_UJI = ["9991000001", "9991000002", "9991000003"];
const TAG_UJI = "uji-kampanye-otomatis";
const NAMA_KAMPANYE = "Uji otomatis, jangan dipakai";

let lulus = 0;
let gagal = 0;

function periksa(nama: string, syarat: boolean, catatan = "") {
  if (syarat) {
    lulus++;
    console.log(`  lulus  ${nama}`);
  } else {
    gagal++;
    console.error(`  GAGAL  ${nama}${catatan ? ` | ${catatan}` : ""}`);
  }
}

async function bersihkan(db: SupabaseClient, tenant_id: string) {
  // Kampanye dihapus lebih dulu, sasaran dan langkahnya ikut lewat cascade.
  await db
    .from("kampanye")
    .delete()
    .eq("tenant_id", tenant_id)
    .eq("nama", NAMA_KAMPANYE);

  const { data: kontak } = await db
    .from("kontak")
    .select("id")
    .eq("tenant_id", tenant_id)
    .in("nomor_wa", NOMOR_UJI);

  for (const k of kontak ?? []) {
    await db.from("kontak").delete().eq("id", k.id as string);
  }
}

async function panggil_antrean(rahasia: string) {
  const jawaban = await fetch(`${ALAMAT}/api/kampanye/jalan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-rahasia-cron": rahasia },
  });
  const badan = (await jawaban.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { status: jawaban.status, badan };
}

async function main() {
  const env = muat_env();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = env.SUPABASE_SERVICE_ROLE_KEY;
  const rahasia_cron = env.RAHASIA_CRON;
  if (!url || !kunci) throw new Error("Supabase belum diisi di .env.local.");
  if (!rahasia_cron) throw new Error("RAHASIA_CRON belum ada di .env.local.");

  const db = createClient(url, kunci, { auth: { persistSession: false } });

  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("slug", "seawise")
    .single();
  const tenant_id = tenant!.id as string;

  console.log(`\nMenguji ${ALAMAT} terhadap ${url}\n`);
  await bersihkan(db, tenant_id);

  periksa(
    "nomor uji memakai kode negara 999 yang dicadangkan ITU",
    NOMOR_UJI.every((n) => n.startsWith("999")),
    `nomor: ${NOMOR_UJI.join(", ")}`,
  );

  console.log("\nMenyiapkan kontak dan kampanye");
  await db.from("kontak").insert(
    NOMOR_UJI.map((n, i) => ({
      tenant_id,
      nomor_wa: n,
      nama: `Sasaran Uji ${i + 1}`,
      tag: [TAG_UJI],
      sumber: "impor",
    })),
  );

  const { data: kampanye } = await db
    .from("kampanye")
    .insert({
      tenant_id,
      nama: NAMA_KAMPANYE,
      saringan_tag: [TAG_UJI],
      jeda_min_detik: 30,
      jeda_maks_detik: 60,
      batas_harian_awal: 2,
      batas_harian_maks: 10,
    })
    .select("id")
    .single();
  const kampanye_id = kampanye!.id as string;

  await db.from("langkah_kampanye").insert([
    {
      tenant_id,
      kampanye_id,
      urutan: 0,
      tunda_hari: 0,
      varian: [
        "Halo {{nama}}, saya dari {{bisnis}}. Ini pesan uji otomatis.",
        "Halo {{nama}}, {{bisnis}} di sini. Ini pesan uji otomatis.",
      ],
    },
    {
      tenant_id,
      kampanye_id,
      urutan: 1,
      tunda_hari: 3,
      varian: ["Menyusul ya {{nama}}, ini pesan uji kedua."],
    },
  ]);

  // ---- Pendaftaran sasaran ----
  console.log("\nPendaftaran sasaran");
  const { data: kontak_uji } = await db
    .from("kontak")
    .select("id")
    .eq("tenant_id", tenant_id)
    .contains("tag", [TAG_UJI]);

  const baris = (kontak_uji ?? []).map((k) => ({
    tenant_id,
    kampanye_id,
    kontak_id: k.id as string,
  }));

  const { data: masuk_pertama } = await db
    .from("sasaran_kampanye")
    .upsert(baris, { onConflict: "kampanye_id,kontak_id", ignoreDuplicates: true })
    .select("id");
  periksa(
    "tiga kontak masuk antrean",
    (masuk_pertama?.length ?? 0) === 3,
    `masuk ${masuk_pertama?.length ?? 0}`,
  );

  const { data: masuk_kedua } = await db
    .from("sasaran_kampanye")
    .upsert(baris, { onConflict: "kampanye_id,kontak_id", ignoreDuplicates: true })
    .select("id");
  periksa(
    "mendaftarkan ulang tidak menggandakan siapa pun",
    (masuk_kedua?.length ?? 0) === 0,
    `tergandakan ${masuk_kedua?.length ?? 0}`,
  );

  // ---- Kampanye draf tidak mengirim ----
  console.log("\nKampanye yang belum dijalankan");
  const diam = await panggil_antrean(rahasia_cron);
  periksa("antrean menjawab 200", diam.status === 200, `status ${diam.status}`);
  const rincian_diam = (diam.badan?.rincian ?? []) as { kampanye_id: string }[];
  periksa(
    "kampanye berstatus draf tidak ikut diperiksa antrean",
    !rincian_diam.some((r) => r.kampanye_id === kampanye_id),
    "kampanye draf seharusnya tidak disentuh",
  );

  // ---- Dijalankan ----
  console.log("\nKampanye dijalankan");
  await db
    .from("kampanye")
    .update({ status: "jalan", mulai_at: new Date().toISOString() })
    .eq("id", kampanye_id);

  const putaran1 = await panggil_antrean(rahasia_cron);
  const hasil1 = ((putaran1.badan?.rincian ?? []) as {
    kampanye_id: string;
    jenis: string;
    sebab: string;
  }[]).find((r) => r.kampanye_id === kampanye_id);

  periksa(
    "kampanye yang jalan ikut diperiksa antrean",
    Boolean(hasil1),
    `rincian: ${JSON.stringify(putaran1.badan?.rincian)}`,
  );

  // Fonnte menolak nomor 999, jadi jenis yang benar adalah gagal-kirim.
  // Yang penting bukan berhasilnya, tapi bahwa jalurnya benar-benar sampai
  // ke gateway dan hasilnya dicatat, bukan diam tanpa jejak.
  periksa(
    "satu pesan benar-benar diproses sampai gateway",
    hasil1?.jenis === "terkirim" || hasil1?.jenis === "gagal-kirim",
    `jenis: ${hasil1?.jenis}, sebab: ${hasil1?.sebab}`,
  );

  const { data: pesan } = await db
    .from("pesan")
    .select("id, isi, pengirim, status_kirim, kampanye_id")
    .eq("kampanye_id", kampanye_id);

  periksa(
    "pesannya tercatat dengan penanda kampanye",
    (pesan?.length ?? 0) === 1 && pesan![0].pengirim === "kampanye",
    `tercatat ${pesan?.length ?? 0}`,
  );
  periksa(
    "penanda templat sudah terisi, tidak ada yang lolos mentah",
    !String(pesan?.[0]?.isi ?? "").includes("{{"),
    `isi: ${pesan?.[0]?.isi}`,
  );
  periksa(
    "nama kontak masuk ke isi pesannya",
    /Sasaran Uji \d/.test(String(pesan?.[0]?.isi ?? "")),
    `isi: ${pesan?.[0]?.isi}`,
  );

  // ---- Jeda antar pesan ----
  console.log("\nJeda antar pesan");
  const putaran2 = await panggil_antrean(rahasia_cron);
  const hasil2 = ((putaran2.badan?.rincian ?? []) as {
    kampanye_id: string;
    jenis: string;
    sebab: string;
  }[]).find((r) => r.kampanye_id === kampanye_id);

  periksa(
    "putaran kedua ditahan jeda, tidak langsung mengirim lagi",
    hasil2?.jenis === "jeda",
    `jenis: ${hasil2?.jenis}, sebab: ${hasil2?.sebab}`,
  );

  const { count: jumlah_pesan } = await db
    .from("pesan")
    .select("id", { count: "exact", head: true })
    .eq("kampanye_id", kampanye_id);
  periksa(
    "tetap cuma satu pesan yang keluar",
    jumlah_pesan === 1,
    `terkirim ${jumlah_pesan}`,
  );

  // ---- Keadaan kampanye ----
  console.log("\nAngka kampanye");
  const { data: keadaan } = await db.rpc("keadaan_kampanye", {
    p_kampanye_id: kampanye_id,
    p_zona: "Asia/Makassar",
  });
  const a = (keadaan ?? {}) as Record<string, number>;
  periksa(
    "sasaran total terbaca tiga",
    Number(a.sasaran_total) === 3,
    `nilai: ${a.sasaran_total}`,
  );
  periksa(
    "hari ke-1 karena kampanye baru dimulai",
    Number(a.hari_ke) === 1,
    `nilai: ${a.hari_ke}`,
  );

  // ---- Kontak membalas menghentikan sequence ----
  console.log("\nKontak membalas");
  const { data: sasaran_pertama } = await db
    .from("sasaran_kampanye")
    .select("id, kontak_id")
    .eq("kampanye_id", kampanye_id)
    .eq("status", "antre")
    .limit(1)
    .single();

  const { data: dihentikan } = await db.rpc("hentikan_sasaran_kontak", {
    p_tenant_id: tenant_id,
    p_kontak_id: sasaran_pertama!.kontak_id as string,
    p_alasan: "Kontak membalas",
  });
  periksa(
    "balasan kontak menghentikan sequence-nya",
    Number(dihentikan) === 1,
    `dihentikan ${dihentikan}`,
  );

  const { data: sesudah } = await db
    .from("sasaran_kampanye")
    .select("status, dibalas_at, alasan_berhenti")
    .eq("id", sasaran_pertama!.id as string)
    .single();
  periksa(
    "statusnya berhenti dan waktu balasnya tercatat",
    sesudah!.status === "berhenti" && sesudah!.dibalas_at !== null,
    `status ${sesudah!.status}, dibalas_at ${sesudah!.dibalas_at}`,
  );

  // ---- Hak akses ----
  console.log("\nHak akses");
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error: tolak_klaim } = await anon.rpc("klaim_sasaran", {
    p_kampanye_id: kampanye_id,
  });
  periksa(
    "pengunjung tanpa sesi tidak bisa mengklaim sasaran",
    Boolean(tolak_klaim),
    "klaim_sasaran seharusnya ditolak",
  );

  const { data: bocor } = await anon.from("kampanye").select("id");
  periksa(
    "kampanye tertutup untuk kunci publik",
    (bocor?.length ?? 0) === 0,
    `terlihat ${bocor?.length ?? 0}`,
  );

  const salah_rahasia = await fetch(`${ALAMAT}/api/kampanye/jalan`, {
    method: "POST",
    headers: { "x-rahasia-cron": "tebakan-ngawur" },
  });
  periksa(
    "jalur antrean menolak rahasia yang salah",
    salah_rahasia.status === 404,
    `status ${salah_rahasia.status}`,
  );

  // ---- Bersih-bersih ----
  console.log("\nMembersihkan data uji");
  await bersihkan(db, tenant_id);

  const { count: sisa_kampanye } = await db
    .from("kampanye")
    .select("id", { count: "exact", head: true })
    .eq("nama", NAMA_KAMPANYE);
  periksa("kampanye uji terhapus lagi", sisa_kampanye === 0, `sisa ${sisa_kampanye}`);

  const { count: sisa_sasaran } = await db
    .from("sasaran_kampanye")
    .select("id", { count: "exact", head: true })
    .eq("kampanye_id", kampanye_id);
  periksa(
    "sasarannya ikut terhapus lewat cascade",
    sisa_sasaran === 0,
    `sisa ${sisa_sasaran}`,
  );

  const { count: sisa_kontak } = await db
    .from("kontak")
    .select("id", { count: "exact", head: true })
    .in("nomor_wa", NOMOR_UJI);
  periksa("kontak uji terhapus lagi", sisa_kontak === 0, `sisa ${sisa_kontak}`);

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`\nUji kampanye berhenti dengan galat:\n${e}\n`);
  process.exit(1);
});
