import { NextResponse } from "next/server";
import { klien_layanan } from "@/lib/supabase/layanan";
import {
  catat_pesan_keluar,
  gudang_supabase,
  kredensial_gateway,
} from "@/lib/gudang-supabase";
import { terima_pesan } from "@/lib/penerimaan";
import { baca_webhook_fonnte, pilih_gateway } from "@/lib/gateway";

/** Webhook harus jalan di Node, bukan Edge, karena enkripsi token pakai node:crypto. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Muatan webhook yang wajar jauh di bawah ini. Sisanya ditolak. */
const BATAS_BADAN_BYTE = 64 * 1024;

async function baca_badan(permintaan: Request): Promise<unknown> {
  const jenis = permintaan.headers.get("content-type") ?? "";
  const teks = await permintaan.text();
  if (teks.length > BATAS_BADAN_BYTE) {
    throw new Error("Muatan webhook terlalu besar");
  }

  // Fonnte mendokumentasikan JSON, tapi sebagian perangkat lama mengirim
  // form biasa. Dua-duanya diterima supaya tidak ada pesan client yang
  // hilang cuma gara-gara bentuk kiriman.
  if (jenis.includes("application/json")) {
    try {
      return JSON.parse(teks);
    } catch {
      return null;
    }
  }
  if (
    jenis.includes("application/x-www-form-urlencoded") ||
    jenis.includes("multipart/form-data")
  ) {
    return Object.fromEntries(new URLSearchParams(teks));
  }
  try {
    return JSON.parse(teks);
  } catch {
    return Object.fromEntries(new URLSearchParams(teks));
  }
}

/**
 * Mengirim pemberitahuan di luar jam kerja lalu mencatatnya.
 *
 * Kegagalan di sini tidak boleh menggagalkan seluruh webhook. Pesan client
 * sudah tersimpan, dan itu bagian yang penting. Balasan yang gagal dicatat
 * sebagai gagal supaya kelihatan di inbox, bukan hilang diam-diam.
 */
async function kirim_balasan_otomatis(
  db: ReturnType<typeof klien_layanan>,
  masukan: {
    tenant_id: string;
    percakapan_id: string;
    ke: string;
    isi: string;
  },
): Promise<boolean> {
  try {
    const kredensial = await kredensial_gateway(db, masukan.tenant_id);
    const gateway = pilih_gateway({
      gateway: kredensial?.gateway ?? "mock",
      token: kredensial?.token ?? null,
    });

    const hasil = await gateway.kirim({ ke: masukan.ke, isi: masukan.isi });

    await catat_pesan_keluar(db, {
      tenant_id: masukan.tenant_id,
      percakapan_id: masukan.percakapan_id,
      isi: masukan.isi,
      pengirim: "ai",
      status_kirim: hasil.ok ? "terkirim" : "gagal",
      wa_message_id: hasil.ok ? hasil.wa_message_id : null,
    });

    return hasil.ok;
  } catch {
    return false;
  }
}

export async function POST(
  permintaan: Request,
  { params }: { params: Promise<{ rahasia: string }> },
) {
  const { rahasia } = await params;

  let muatan: unknown;
  try {
    muatan = await baca_badan(permintaan);
  } catch {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const pesan = baca_webhook_fonnte(muatan);
  if (!pesan) {
    // Bukan pesan teks masuk. Bisa laporan status perangkat atau pesan grup.
    // Tetap dijawab 200 supaya gateway tidak mengulang-ulang kiriman ini.
    return NextResponse.json({ ok: true, diabaikan: true });
  }

  const db = klien_layanan();
  const hasil = await terima_pesan(gudang_supabase(db), { rahasia, pesan });

  if (hasil.jenis === "ditolak") {
    // Sengaja tidak menjelaskan alasannya. Webhook ini terbuka di internet
    // dan pesan galat yang rinci cuma membantu orang menebak-nebak rahasia.
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (hasil.jenis === "dobel") {
    return NextResponse.json({ ok: true, dobel: true });
  }

  let balasan_terkirim = false;
  if (hasil.balasan_otomatis) {
    balasan_terkirim = await kirim_balasan_otomatis(db, {
      tenant_id: hasil.tenant_id,
      percakapan_id: hasil.percakapan_id,
      ke: pesan.nomor_pengirim,
      isi: hasil.balasan_otomatis,
    });
  }

  return NextResponse.json({
    ok: true,
    status: hasil.status,
    opt_out: hasil.opt_out,
    balasan_terkirim,
  });
}

/** Sebagian gateway memanggil GET untuk memastikan URL-nya hidup. */
export function GET() {
  return NextResponse.json({ ok: true, layanan: "reflows-webhook" });
}
