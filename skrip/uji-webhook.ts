/**
 * Uji jalur webhook dari ujung ke ujung: HTTP sungguhan ke route Next,
 * yang menulis ke Supabase sungguhan.
 *
 * Uji unit sudah menutup aturannya dengan penyimpanan di memori. Yang
 * belum terbukti adalah perkara yang cuma muncul di jalur nyata: bentuk
 * badan permintaan, penerjemahan tipe kolom, kunci unik di database, dan
 * apakah service role benar-benar boleh menulis.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";

const ALAMAT = process.env.ALAMAT_UJI ?? "http://localhost:3111";
const NOMOR_UJI = "628999000111";
const NOMOR_PERANGKAT = "6281338291000";

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

async function kirim_webhook(rahasia: string, muatan: Record<string, unknown>) {
  const jawaban = await fetch(`${ALAMAT}/api/wa/masuk/${rahasia}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatan),
  });
  let badan: unknown = null;
  try {
    badan = await jawaban.json();
  } catch {
    badan = null;
  }
  return { status: jawaban.status, badan: badan as Record<string, unknown> | null };
}

function muatan(ubah: Record<string, unknown> = {}) {
  return {
    device: NOMOR_PERANGKAT,
    sender: NOMOR_UJI,
    name: "Kontak Uji Otomatis",
    message: "Bikin website katering berapa ya?",
    timestamp: String(Math.floor(Date.now() / 1000)),
    inboxid: `uji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...ubah,
  };
}

async function bersihkan(db: SupabaseClient, tenant_id: string) {
  const { data: kontak } = await db
    .from("kontak")
    .select("id")
    .eq("tenant_id", tenant_id)
    .eq("nomor_wa", NOMOR_UJI);
  for (const k of kontak ?? []) {
    await db.from("kontak").delete().eq("id", k.id);
  }
}

async function main() {
  muat_env();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db = createClient(url, kunci, { auth: { persistSession: false } });

  try {
    const cek = await fetch(`${ALAMAT}/api/wa/masuk/tes`, { method: "GET" });
    if (!cek.ok) throw new Error(String(cek.status));
  } catch {
    console.error(`\nServer di ${ALAMAT} tidak menjawab.`);
    console.error("Jalankan dulu: npm run build && npm run start -- -p 3111\n");
    process.exit(1);
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("id")
    .eq("slug", "seawise")
    .single();
  const tenant_id = tenant!.id as string;

  const { data: pengaturan } = await db
    .from("pengaturan_tenant")
    .select("rahasia_webhook, nomor_wa")
    .eq("tenant_id", tenant_id)
    .single();
  const rahasia = pengaturan!.rahasia_webhook as string;

  // Nomor perangkat disetel supaya pemeriksaan kepemilikan benar-benar diuji,
  // bukan dilewati karena kolomnya masih kosong.
  await db
    .from("pengaturan_tenant")
    .update({ nomor_wa: NOMOR_PERANGKAT })
    .eq("tenant_id", tenant_id);

  await bersihkan(db, tenant_id);
  console.log(`\nMenguji ${ALAMAT} terhadap ${url}\n`);

  console.log("Penolakan");
  const salah = await kirim_webhook("a".repeat(64), muatan());
  periksa("rahasia salah ditolak 404", salah.status === 404, `status ${salah.status}`);

  const pendek = await kirim_webhook("bukan-rahasia", muatan());
  periksa("rahasia asal-asalan ditolak 404", pendek.status === 404, `status ${pendek.status}`);

  const perangkat_lain = await kirim_webhook(rahasia, muatan({ device: "628111222333" }));
  periksa(
    "pesan ke nomor perangkat lain ditolak 404",
    perangkat_lain.status === 404,
    `status ${perangkat_lain.status}`,
  );

  const grup = await kirim_webhook(rahasia, muatan({ member: "628777000111" }));
  periksa(
    "pesan grup diabaikan tapi tetap dijawab 200",
    grup.status === 200 && grup.badan?.diabaikan === true,
    `status ${grup.status} badan ${JSON.stringify(grup.badan)}`,
  );

  const { count: setelah_penolakan } = await db
    .from("kontak")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .eq("nomor_wa", NOMOR_UJI);
  periksa(
    "tidak ada kontak yang tercipta dari permintaan yang ditolak",
    (setelah_penolakan ?? 0) === 0,
    `ada ${setelah_penolakan} kontak`,
  );

  console.log("\nPesan wajar");
  const m1 = muatan();
  const pertama = await kirim_webhook(rahasia, m1);
  periksa(
    "pesan masuk diterima dan dipegang AI",
    pertama.status === 200 && pertama.badan?.status === "ai",
    `status ${pertama.status} badan ${JSON.stringify(pertama.badan)}`,
  );

  const { data: kontak } = await db
    .from("kontak")
    .select("id, nama, sumber")
    .eq("tenant_id", tenant_id)
    .eq("nomor_wa", NOMOR_UJI)
    .single();
  periksa("kontak terbuat dengan nama dari WhatsApp", kontak?.nama === "Kontak Uji Otomatis");
  periksa("sumber kontak tercatat chat-masuk", kontak?.sumber === "chat-masuk");

  const { data: percakapan } = await db
    .from("percakapan")
    .select("id, status, belum_dibaca")
    .eq("kontak_id", kontak!.id)
    .single();
  periksa("percakapan terbuat", Boolean(percakapan));
  periksa(
    "hitungan belum dibaca naik jadi 1",
    percakapan?.belum_dibaca === 1,
    `nilai ${percakapan?.belum_dibaca}`,
  );

  console.log("\nWebhook dobel");
  const ulang = await kirim_webhook(rahasia, m1);
  periksa("kiriman ulang dikenali dobel", ulang.badan?.dobel === true, JSON.stringify(ulang.badan));

  const { count: jumlah_pesan } = await db
    .from("pesan")
    .select("id", { count: "exact", head: true })
    .eq("percakapan_id", percakapan!.id);
  periksa("pesan tetap satu, tidak dobel", jumlah_pesan === 1, `ada ${jumlah_pesan}`);

  const { data: setelah_ulang } = await db
    .from("percakapan")
    .select("belum_dibaca")
    .eq("id", percakapan!.id)
    .single();
  periksa(
    "hitungan belum dibaca tidak ikut naik saat dobel",
    setelah_ulang?.belum_dibaca === 1,
    `nilai ${setelah_ulang?.belum_dibaca}`,
  );

  console.log("\nEskalasi");
  const eskalasi = await kirim_webhook(
    rahasia,
    muatan({ message: "Saya mau komplain, hasilnya tidak sesuai" }),
  );
  periksa(
    "kata sensitif melempar percakapan ke manusia",
    eskalasi.badan?.status === "manual",
    JSON.stringify(eskalasi.badan),
  );

  const { data: setelah_eskalasi } = await db
    .from("percakapan")
    .select("status, alasan_eskalasi")
    .eq("id", percakapan!.id)
    .single();
  periksa(
    "alasan eskalasi tersimpan di database",
    String(setelah_eskalasi?.alasan_eskalasi ?? "").includes("komplain"),
    String(setelah_eskalasi?.alasan_eskalasi),
  );

  console.log("\nPermintaan berhenti");
  const berhenti = await kirim_webhook(rahasia, muatan({ message: "STOP" }));
  periksa(
    "permintaan berhenti dikenali",
    berhenti.badan?.opt_out === true && berhenti.badan?.status === "selesai",
    JSON.stringify(berhenti.badan),
  );

  const { data: kontak_akhir } = await db
    .from("kontak")
    .select("opt_out_at")
    .eq("id", kontak!.id)
    .single();
  periksa("waktu opt-out tersimpan", Boolean(kontak_akhir?.opt_out_at));

  console.log("\nMembersihkan data uji");
  await bersihkan(db, tenant_id);
  const { count: sisa } = await db
    .from("kontak")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .eq("nomor_wa", NOMOR_UJI);
  periksa("data uji terhapus lagi", (sisa ?? 0) === 0, `sisa ${sisa}`);

  const { count: pesan_sisa } = await db
    .from("pesan")
    .select("id", { count: "exact", head: true })
    .eq("percakapan_id", percakapan!.id);
  periksa(
    "pesan ikut terhapus lewat cascade",
    (pesan_sisa ?? 0) === 0,
    `sisa ${pesan_sisa}`,
  );

  console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\nUji webhook berhenti dengan galat:\n", e);
  process.exit(1);
});
