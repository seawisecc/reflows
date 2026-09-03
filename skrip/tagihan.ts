/**
 * Menagih tenant, dari sisi Seawise. Sekarang transfer manual.
 *
 * Berdiri sebagai skrip, bukan layar, dengan alasan yang sama seperti
 * tenant-aktif: menerbitkan dan melunasi tagihan adalah pekerjaan Seawise,
 * dan tabelnya memang tidak bisa ditulis dari sesi browser mana pun.
 * Tenant hanya membacanya, di halaman Penggunaan.
 *
 * Rekening tujuan dibaca dari .env.local lalu DISALIN ke baris tagihan.
 * Mengganti rekening bulan depan tidak boleh mengubah rekening yang
 * tertulis di tagihan yang sudah terbit.
 *
 *   npm run tagihan daftar                daftar tagihan terakhir
 *   npm run tagihan daftar 2026-08        daftar satu periode
 *   npm run tagihan terbitkan             terbitkan untuk bulan lalu
 *   npm run tagihan terbitkan 2026-08     terbitkan periode tertentu
 *   npm run tagihan lunas seawise 2026-08 tandai sudah dibayar
 *   npm run tagihan batal seawise 2026-08 batalkan
 *
 * Menerbitkan dua kali untuk periode yang sama ditolak database, jadi
 * perintahnya aman diulang.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { muat_env } from "./env-lokal";
import {
  baca_periode,
  bulan_di_zona,
  label_periode,
  periode_sebelumnya,
  susun_tagihan,
  teks_periode,
  type Periode,
} from "../src/lib/tagihan";
import { paket_sah } from "../src/lib/paket";
import { rupiah } from "../src/lib/utils";

type BarisTenant = {
  id: string;
  nama: string;
  slug: string;
  paket: string | null;
  aktif: boolean;
};

function klien(): SupabaseClient {
  muat_env();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const kunci = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !kunci) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local",
    );
  }
  return createClient(url, kunci, { auth: { persistSession: false } });
}

/** Rekening tujuan transfer. Kosong bukan galat, tapi diperingatkan keras:
 *  tagihan tanpa cara bayar memaksa tenant bertanya lewat chat. */
function rekening() {
  return {
    bank_nama: process.env.SEAWISE_BANK_NAMA || null,
    bank_rekening: process.env.SEAWISE_BANK_REKENING || null,
    bank_atas_nama: process.env.SEAWISE_BANK_ATAS_NAMA || null,
  };
}

async function daftar(db: SupabaseClient, periode: Periode | null) {
  let q = db
    .from("tagihan_langganan")
    .select("periode, status, total, terpakai, kuota, kelebihan, dibayar_at, tenant_id")
    .order("periode", { ascending: false })
    .limit(60);
  if (periode) q = q.eq("periode", teks_periode(periode));

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const { data: tenants } = await db.from("tenants").select("id, nama, slug");
  const nama = new Map(
    ((tenants ?? []) as BarisTenant[]).map((t) => [t.id, t.slug]),
  );

  if (!data || data.length === 0) {
    console.log("\n  Belum ada tagihan.\n");
    return;
  }

  console.log("");
  let jumlah_terbit = 0;
  let jumlah_lunas = 0;
  for (const b of data) {
    const p = baca_periode(String(b.periode));
    const tanda = b.status === "lunas" ? "lunas " : b.status === "batal" ? "batal " : "MENUNGGU";
    console.log(
      `  ${tanda}  ${String(nama.get(b.tenant_id as string) ?? "?").padEnd(12)}` +
        `${p ? label_periode(p).padEnd(16) : ""}` +
        `${rupiah(Number(b.total)).padStart(14)}   ` +
        `${b.terpakai}/${b.kuota} balasan` +
        (Number(b.kelebihan) > 0 ? `, lebih ${b.kelebihan}` : ""),
    );
    if (b.status !== "batal") jumlah_terbit += Number(b.total);
    if (b.status === "lunas") jumlah_lunas += Number(b.total);
  }
  console.log(
    `\n  ${data.length} tagihan, ditagih ${rupiah(jumlah_terbit)}, ` +
      `lunas ${rupiah(jumlah_lunas)}, belum ${rupiah(jumlah_terbit - jumlah_lunas)}\n`,
  );
}

async function terbitkan(db: SupabaseClient, periode: Periode) {
  const { data, error } = await db
    .from("tenants")
    .select("id, nama, slug, paket, aktif")
    .order("nama");
  if (error) throw new Error(error.message);

  const bank = rekening();
  if (!bank.bank_rekening) {
    console.log(
      "\n  PERINGATAN: SEAWISE_BANK_REKENING belum diisi di .env.local.\n" +
        "  Tagihannya tetap terbit, tapi tanpa cara bayar, jadi tenant harus\n" +
        "  menanyakannya lewat chat.",
    );
  }

  console.log(`\n  Periode ${label_periode(periode)}\n`);

  for (const t of (data ?? []) as BarisTenant[]) {
    if (!t.aktif) {
      console.log(`  lewat     ${t.slug.padEnd(12)} disuspensi`);
      continue;
    }
    if (!paket_sah(t.paket)) {
      console.log(`  lewat     ${t.slug.padEnd(12)} paketnya belum diatur`);
      continue;
    }

    const { data: pakai, error: galat_pakai } = await db.rpc("pemakaian_bulan", {
      p_tenant_id: t.id,
      p_periode: teks_periode(periode),
    });
    if (galat_pakai) throw new Error(galat_pakai.message);

    const terpakai = Number(
      (pakai as unknown as Record<string, unknown>)?.terpakai ?? 0,
    );
    const rincian = susun_tagihan(t.paket, terpakai);

    const { error: galat_simpan } = await db
      .from("tagihan_langganan")
      .insert({
        tenant_id: t.id,
        periode: teks_periode(periode),
        status: "terkirim",
        ...rincian,
        ...bank,
      });

    if (galat_simpan) {
      // 23505 unique_violation, artinya periode itu sudah pernah terbit.
      // Bukan kegagalan: perintahnya memang dirancang aman diulang.
      const sudah = galat_simpan.code === "23505";
      console.log(
        `  ${sudah ? "sudah ada" : "GAGAL    "} ${t.slug.padEnd(12)}` +
          (sudah ? "" : galat_simpan.message),
      );
      if (!sudah) process.exitCode = 1;
      continue;
    }

    console.log(
      `  terbit    ${t.slug.padEnd(12)}${rupiah(rincian.total).padStart(14)}   ` +
        `${rincian.terpakai}/${rincian.kuota} balasan` +
        (rincian.kelebihan > 0
          ? `, lebih ${rincian.kelebihan} senilai ${rupiah(rincian.biaya_kelebihan)}`
          : ""),
    );
  }
  console.log("");
}

async function ubah_status(
  db: SupabaseClient,
  slug: string,
  periode: Periode,
  status: "lunas" | "batal",
) {
  const { data: t } = await db
    .from("tenants")
    .select("id, nama")
    .eq("slug", slug)
    .maybeSingle();
  if (!t) throw new Error(`Tenant ${slug} tidak ada.`);

  const { data, error } = await db
    .from("tagihan_langganan")
    .update({
      status,
      dibayar_at: status === "lunas" ? new Date().toISOString() : null,
    })
    .eq("tenant_id", t.id)
    .eq("periode", teks_periode(periode))
    .select("total");

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      `Tidak ada tagihan ${slug} untuk ${label_periode(periode)}. Terbitkan dulu.`,
    );
  }

  console.log(
    `\n  ${slug} ${label_periode(periode)} ${rupiah(Number(data[0].total))} ` +
      `ditandai ${status}.\n`,
  );
}

async function main() {
  const [perintah, ...sisa] = process.argv.slice(2);
  const db = klien();

  // Bulan lalu menurut zona Makassar, bukan zona server. Skrip yang
  // dijalankan dari server UTC pada tanggal 1 pagi WITA akan menagih bulan
  // yang salah kalau memakai zona server.
  const sekarang = bulan_di_zona(new Date(), "Asia/Makassar");
  const bulan_lalu = periode_sebelumnya(sekarang);

  if (perintah === "daftar") {
    const p = sisa[0] ? baca_periode(sisa[0]) : null;
    if (sisa[0] && !p) throw new Error(`Periode ${sisa[0]} tidak dikenali.`);
    await daftar(db, p);
    return;
  }

  if (perintah === "terbitkan") {
    const p = sisa[0] ? baca_periode(sisa[0]) : bulan_lalu;
    if (!p) throw new Error(`Periode ${sisa[0]} tidak dikenali.`);
    await terbitkan(db, p);
    return;
  }

  if (perintah === "lunas" || perintah === "batal") {
    const [slug, teks] = sisa;
    const p = teks ? baca_periode(teks) : bulan_lalu;
    if (!slug) throw new Error("Sebutkan slug tenantnya.");
    if (!p) throw new Error(`Periode ${teks} tidak dikenali.`);
    await ubah_status(db, slug, p, perintah);
    return;
  }

  console.log(`
  npm run tagihan daftar [periode]              daftar tagihan
  npm run tagihan terbitkan [periode]           terbitkan, bawaannya ${label_periode(bulan_lalu)}
  npm run tagihan lunas <slug> [periode]        tandai sudah dibayar
  npm run tagihan batal <slug> [periode]        batalkan

  Periode ditulis 2026-08. Menerbitkan dua kali untuk periode yang sama
  ditolak database, jadi perintahnya aman diulang.
`);
}

main().catch((e) => {
  console.error(`\nGagal:\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
