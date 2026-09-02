import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { susun_pdf_invoice, type DataInvoice } from "./pdf";

/**
 * Menyimpan PDF invoice dan menyiapkan alamat untuk gateway.
 *
 * Bucketnya tertutup, jadi berkasnya tidak bisa ditebak orang lewat alamat.
 * Yang dikirim ke WhatsApp alamat bertanda tangan yang berumur terbatas.
 *
 * Jalurnya diawali tenant_id, bukan cuma nomor invoice. Kalau suatu saat ada
 * kekeliruan kebijakan penyimpanan, pemisahan per tenant masih jadi lapis
 * terakhir sebelum invoice satu pelanggan terbaca pelanggan lain.
 */

export const BUCKET = "invoice";

/**
 * Umur alamat bertanda tangan.
 *
 * Tujuh hari, bukan satu jam. Fonnte mengunduh berkasnya beberapa detik
 * setelah dikirim, tapi client sering membuka ulang chat lamanya, dan
 * invoice yang tautannya mati sehari kemudian terlihat seperti penipuan.
 */
export const UMUR_TAUTAN_DETIK = 7 * 24 * 3600;

export function jalur_invoice(tenant_id: string, invoice_id: string): string {
  return `${tenant_id}/${invoice_id}.pdf`;
}

/** Nama berkas yang dilihat client di WhatsApp. */
export function nama_berkas(nomor: string): string {
  return `${nomor.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
}

export async function terbitkan_pdf(
  db: SupabaseClient,
  masukan: { tenant_id: string; invoice_id: string; data: DataInvoice },
): Promise<{ ok: true; path: string } | { ok: false; alasan: string }> {
  let pdf: Uint8Array;
  try {
    pdf = await susun_pdf_invoice(masukan.data);
  } catch (e) {
    return {
      ok: false,
      alasan: `Gagal menyusun PDF: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const path = jalur_invoice(masukan.tenant_id, masukan.invoice_id);
  const { error } = await db.storage
    .from(BUCKET)
    // upsert supaya menerbitkan ulang invoice yang sama menimpa berkasnya,
    // bukan menumpuk versi lama yang tidak pernah dipakai lagi.
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });

  if (error) return { ok: false, alasan: `Gagal menyimpan PDF: ${error.message}` };
  return { ok: true, path };
}

export async function tautan_invoice(
  db: SupabaseClient,
  path: string,
  umur = UMUR_TAUTAN_DETIK,
): Promise<string | null> {
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(path, umur);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function unduh_invoice(
  db: SupabaseClient,
  path: string,
): Promise<Uint8Array | null> {
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function hapus_pdf(db: SupabaseClient, path: string): Promise<void> {
  await db.storage.from(BUCKET).remove([path]);
}
