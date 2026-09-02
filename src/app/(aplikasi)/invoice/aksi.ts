"use server";

import { revalidatePath } from "next/cache";
import { klien_server } from "@/lib/supabase/server";
import { klien_layanan } from "@/lib/supabase/layanan";
import { tenant_saya, pengaturan_ringkas } from "@/lib/data/pengaturan";
import { ambil_satu_invoice } from "@/lib/data/invoice";
import { hitung_invoice, jatuh_tempo } from "@/lib/invoice/hitung";
import {
  nama_berkas,
  tautan_invoice,
  terbitkan_pdf,
} from "@/lib/invoice/simpan";
import { catat_pesan_keluar, kredensial_gateway } from "@/lib/gudang-supabase";
import { pilih_gateway } from "@/lib/gateway";
import { tampilkan_nomor } from "@/lib/gateway/nomor";
import { rupiah_pdf, tanggal_pdf } from "@/lib/invoice/pdf";
import type { KeadaanInvoice } from "./keadaan";
import type { Invoice } from "@/tipe";

function gagal(alasan: string): KeadaanInvoice {
  return { galat: alasan, pesan: null, id: null };
}

const MAKS_BARIS = 40;

type BarisMasuk = { deskripsi: string; jumlah: number; harga_satuan: number };

function baca_baris(mentah: unknown): BarisMasuk[] {
  let daftar: unknown;
  try {
    daftar = JSON.parse(String(mentah ?? "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(daftar)) return [];

  return daftar
    .map((b) => ({
      deskripsi: String((b as BarisMasuk)?.deskripsi ?? "").trim().slice(0, 300),
      jumlah: Number((b as BarisMasuk)?.jumlah),
      harga_satuan: Math.round(Number((b as BarisMasuk)?.harga_satuan)),
    }))
    .filter(
      (b) =>
        b.deskripsi.length > 0 &&
        Number.isFinite(b.jumlah) &&
        b.jumlah > 0 &&
        Number.isFinite(b.harga_satuan) &&
        b.harga_satuan >= 0,
    )
    .slice(0, MAKS_BARIS);
}

/**
 * Menyusun data yang dibutuhkan PDF dari satu baris invoice.
 * Semuanya diambil dari salinan di tabel invoice, bukan dari pengaturan
 * sekarang, supaya invoice lama tidak ikut berubah kalau datanya diperbarui.
 */
function data_pdf(inv: Invoice) {
  return {
    nomor: inv.nomor,
    terbit_at: inv.terbit_at,
    jatuh_tempo_at: inv.jatuh_tempo_at,
    penerbit_nama: inv.penerbit_nama,
    penerbit_alamat: inv.penerbit_alamat,
    penerbit_nomor_wa: inv.penerbit_nomor_wa,
    klien_nama: inv.klien_nama,
    klien_nomor_wa: inv.klien_nomor_wa,
    bank_nama: inv.bank_nama,
    bank_rekening: inv.bank_rekening,
    bank_atas_nama: inv.bank_atas_nama,
    catatan: inv.catatan,
    diskon: inv.diskon,
    ppn_persen: inv.ppn_persen,
    baris: inv.baris.map((b) => ({
      deskripsi: b.deskripsi,
      jumlah: b.jumlah,
      harga_satuan: b.harga_satuan,
    })),
  };
}

export async function buat_invoice(
  _sebelumnya: KeadaanInvoice,
  data: FormData,
): Promise<KeadaanInvoice> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return gagal("Sesi kamu sudah habis. Masuk lagi ya.");

  const kontak_id = String(data.get("kontak_id") ?? "");
  if (!kontak_id) return gagal("Pilih dulu client yang ditagih.");

  const baris = baca_baris(data.get("baris"));
  if (baris.length === 0) {
    return gagal("Invoice tanpa satu baris pun tidak bisa diterbitkan.");
  }

  const db = await klien_server();

  const [{ data: kontak }, { data: profil }, { data: tenant }] = await Promise.all([
    db.from("kontak").select("nama, nomor_wa").eq("id", kontak_id).maybeSingle(),
    db
      .from("pengaturan_tenant")
      .select(
        "alamat_bisnis, bank_nama, bank_rekening, bank_atas_nama, catatan_invoice, ppn_persen, tempo_hari, nomor_wa",
      )
      .maybeSingle(),
    db.from("tenants").select("nama").eq("id", tenant_id).maybeSingle(),
  ]);

  if (!kontak) return gagal("Kontaknya tidak ditemukan.");
  if (!profil) return gagal("Pengaturan tenant belum ada.");

  const diskon = Math.max(0, Math.round(Number(data.get("diskon") ?? 0)) || 0);
  const ppn_diminta = data.get("ppn_persen");
  const ppn_persen =
    ppn_diminta === null || String(ppn_diminta).trim() === ""
      ? Number(profil.ppn_persen ?? 0)
      : Math.max(0, Math.min(100, Number(ppn_diminta) || 0));

  const terbit = String(data.get("terbit_at") ?? "").match(/^\d{4}-\d{2}-\d{2}$/)
    ? String(data.get("terbit_at"))
    : new Date().toISOString().slice(0, 10);
  const tempo_hari = Number(data.get("tempo_hari") ?? profil.tempo_hari ?? 7);

  const h = hitung_invoice({ baris, diskon, ppn_persen });

  // Nomor diambil lewat fungsi yang mengunci barisnya. Dua invoice yang
  // dibuat bersamaan tidak akan pernah mendapat nomor yang sama.
  const { data: nomor, error: galat_nomor } = await db.rpc(
    "nomor_invoice_berikutnya",
  );
  if (galat_nomor || !nomor) {
    return gagal(`Gagal mengambil nomor invoice: ${galat_nomor?.message ?? "kosong"}`);
  }

  const { data: baru, error } = await db
    .from("invoice")
    .insert({
      tenant_id,
      kontak_id,
      nomor: nomor as string,
      penerbit_nama: (tenant?.nama as string) ?? "Bisnis kamu",
      penerbit_alamat: profil.alamat_bisnis,
      penerbit_nomor_wa: profil.nomor_wa
        ? tampilkan_nomor(profil.nomor_wa as string)
        : null,
      bank_nama: profil.bank_nama,
      bank_rekening: profil.bank_rekening,
      bank_atas_nama: profil.bank_atas_nama,
      klien_nama: (kontak.nama as string | null) ?? `+${kontak.nomor_wa}`,
      klien_nomor_wa: tampilkan_nomor(kontak.nomor_wa as string),
      terbit_at: terbit,
      jatuh_tempo_at: jatuh_tempo(terbit, tempo_hari),
      diskon: h.diskon,
      ppn_persen: h.ppn_persen,
      catatan:
        String(data.get("catatan") ?? "").trim().slice(0, 1000) ||
        ((profil.catatan_invoice as string | null) ?? null),
      subtotal: h.subtotal,
      nilai_ppn: h.nilai_ppn,
      total: h.total,
    })
    .select("id")
    .single();

  if (error || !baru) {
    return gagal(`Gagal menyimpan invoice: ${error?.message ?? "tanpa data"}`);
  }

  const invoice_id = baru.id as string;
  const { error: galat_baris } = await db.from("baris_invoice").insert(
    baris.map((b, i) => ({
      tenant_id,
      invoice_id,
      urutan: i,
      deskripsi: b.deskripsi,
      jumlah: b.jumlah,
      harga_satuan: b.harga_satuan,
    })),
  );
  if (galat_baris) {
    // Invoice tanpa baris tidak berguna dan nomornya sudah terpakai.
    // Dihapus supaya tidak jadi bangkai di daftar.
    await db.from("invoice").delete().eq("id", invoice_id);
    return gagal(`Gagal menyimpan barisnya: ${galat_baris.message}`);
  }

  // PDF dibuat sekarang juga, bukan nanti saat mau dikirim. Kalau ada yang
  // salah di datanya, lebih baik ketahuan sekarang selagi pemiliknya masih
  // di layar ini, bukan saat dia menekan tombol kirim ke client.
  const hasil_pdf = await terbitkan_pdf(klien_layanan(), {
    tenant_id,
    invoice_id,
    data: data_pdf({
      ...(await ambil_satu_invoice(invoice_id))!,
    }),
  });
  if (hasil_pdf.ok) {
    await db
      .from("invoice")
      .update({ berkas_path: hasil_pdf.path })
      .eq("id", invoice_id);
  }

  revalidatePath("/invoice");
  return {
    galat: hasil_pdf.ok ? null : hasil_pdf.alasan,
    pesan: `Invoice ${nomor} dibuat, total ${rupiah_pdf(h.total)}.`,
    id: invoice_id,
  };
}

/** Membuat ulang PDF-nya, misalnya setelah data bisnis dilengkapi. */
export async function terbitkan_ulang(
  id: string,
): Promise<{ galat: string | null }> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis." };

  const inv = await ambil_satu_invoice(id);
  if (!inv) return { galat: "Invoice tidak ditemukan." };

  const hasil = await terbitkan_pdf(klien_layanan(), {
    tenant_id,
    invoice_id: id,
    data: data_pdf(inv),
  });
  if (!hasil.ok) return { galat: hasil.alasan };

  const db = await klien_server();
  await db.from("invoice").update({ berkas_path: hasil.path }).eq("id", id);
  revalidatePath(`/invoice/${id}`);
  return { galat: null };
}

/** Alamat berumur terbatas untuk mengunduh atau melihat PDF-nya. */
export async function tautan_pdf(id: string): Promise<{ url: string | null }> {
  const inv = await ambil_satu_invoice(id);
  if (!inv?.berkas_path) return { url: null };
  return { url: await tautan_invoice(klien_layanan(), inv.berkas_path) };
}

export async function kirim_invoice(id: string): Promise<{ galat: string | null }> {
  const tenant_id = await tenant_saya();
  if (!tenant_id) return { galat: "Sesi kamu sudah habis." };

  const pengaturan = await pengaturan_ringkas();
  if (pengaturan && !pengaturan.izin.kirim_manual) {
    return { galat: pengaturan.izin.sebab };
  }

  const inv = await ambil_satu_invoice(id);
  if (!inv) return { galat: "Invoice tidak ditemukan." };
  if (inv.status === "batal") return { galat: "Invoice ini sudah dibatalkan." };

  const db = await klien_server();
  const layanan = klien_layanan();

  // PDF dibuat ulang kalau belum ada, supaya tombol kirim tidak pernah
  // gagal cuma karena penyimpanan sempat bermasalah saat invoice dibuat.
  let path = inv.berkas_path;
  if (!path) {
    const hasil = await terbitkan_pdf(layanan, {
      tenant_id,
      invoice_id: id,
      data: data_pdf(inv),
    });
    if (!hasil.ok) return { galat: hasil.alasan };
    path = hasil.path;
    await db.from("invoice").update({ berkas_path: path }).eq("id", id);
  }

  const url = await tautan_invoice(layanan, path);
  if (!url) return { galat: "Gagal menyiapkan tautan PDF-nya." };

  const { data: kontak } = await db
    .from("kontak")
    .select("nomor_wa, opt_out_at")
    .eq("id", inv.kontak_id)
    .maybeSingle();
  if (!kontak) return { galat: "Kontaknya sudah tidak ada." };
  if (kontak.opt_out_at) {
    return { galat: "Kontak ini sudah minta berhenti dihubungi." };
  }

  const isi =
    `Halo ${inv.klien_nama}, berikut invoice ${inv.nomor} ` +
    `sebesar ${rupiah_pdf(inv.total)}, jatuh tempo ${tanggal_pdf(inv.jatuh_tempo_at)}.` +
    (inv.bank_nama && inv.bank_rekening
      ? `\n\nPembayaran ke ${inv.bank_nama} ${inv.bank_rekening}` +
        (inv.bank_atas_nama ? ` atas nama ${inv.bank_atas_nama}` : "")
      : "") +
    "\n\nTerima kasih.";

  const kredensial = await kredensial_gateway(layanan, tenant_id);
  const gateway = pilih_gateway({
    gateway: kredensial?.gateway ?? "mock",
    token: kredensial?.token ?? null,
  });
  const hasil = await gateway.kirim({
    ke: kontak.nomor_wa as string,
    isi,
    berkas: { url, nama: nama_berkas(inv.nomor) },
  });

  // Percakapannya disiapkan supaya invoice yang terkirim muncul di inbox,
  // bukan cuma di halaman invoice. Client yang bertanya soal tagihannya
  // membalas di utas yang sama.
  const { data: utas } = await db
    .from("percakapan")
    .select("id")
    .eq("kontak_id", inv.kontak_id)
    .maybeSingle();
  let percakapan_id = utas?.id as string | undefined;
  if (!percakapan_id) {
    const { data: baru } = await db
      .from("percakapan")
      .insert({ tenant_id, kontak_id: inv.kontak_id })
      .select("id")
      .single();
    percakapan_id = baru?.id as string | undefined;
  }

  if (percakapan_id) {
    await catat_pesan_keluar(layanan, {
      tenant_id,
      percakapan_id,
      isi,
      pengirim: "manusia",
      status_kirim: hasil.ok ? "terkirim" : "gagal",
      wa_message_id: hasil.ok ? hasil.wa_message_id : null,
    });
  }

  if (!hasil.ok) return { galat: `Gagal terkirim: ${hasil.alasan}` };

  await db
    .from("invoice")
    .update({
      status: inv.status === "lunas" ? "lunas" : "terkirim",
      dikirim_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/invoice");
  revalidatePath(`/invoice/${id}`);
  revalidatePath("/percakapan");
  return { galat: null };
}

export async function ubah_status_invoice(
  id: string,
  status: "lunas" | "batal" | "terkirim",
): Promise<{ galat: string | null }> {
  const db = await klien_server();
  const { error } = await db
    .from("invoice")
    .update({
      status,
      lunas_at: status === "lunas" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return { galat: `Gagal mengubah status: ${error.message}` };

  revalidatePath("/invoice");
  revalidatePath(`/invoice/${id}`);
  return { galat: null };
}

export async function hapus_invoice(id: string): Promise<{ galat: string | null }> {
  const inv = await ambil_satu_invoice(id);
  if (!inv) return { galat: "Invoice tidak ditemukan." };
  if (inv.status !== "draf") {
    return {
      galat:
        "Invoice yang sudah dikirim tidak bisa dihapus. Batalkan saja, supaya jejaknya tetap ada.",
    };
  }

  const db = await klien_server();
  const { error } = await db.from("invoice").delete().eq("id", id);
  if (error) return { galat: `Gagal menghapus: ${error.message}` };

  if (inv.berkas_path) {
    const { hapus_pdf } = await import("@/lib/invoice/simpan");
    await hapus_pdf(klien_layanan(), inv.berkas_path);
  }

  revalidatePath("/invoice");
  return { galat: null };
}
