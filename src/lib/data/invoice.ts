import "server-only";
import { klien_server } from "@/lib/supabase/server";
import { supabase_siap } from "@/lib/lingkungan";
import type { Invoice, StatusInvoice } from "@/tipe";

const PILIHAN = `
  id, nomor, status, kontak_id, klien_nama, klien_nomor_wa,
  penerbit_nama, penerbit_alamat, penerbit_nomor_wa,
  bank_nama, bank_rekening, bank_atas_nama,
  terbit_at, jatuh_tempo_at, diskon, ppn_persen, catatan,
  subtotal, nilai_ppn, total, berkas_path, dikirim_at, lunas_at, dibuat_at,
  baris_invoice ( id, urutan, deskripsi, jumlah, harga_satuan )
`;

function ke_invoice(b: Record<string, unknown>): Invoice {
  const baris = ((b.baris_invoice ?? []) as Record<string, unknown>[])
    .map((r) => ({
      id: r.id as string,
      urutan: Number(r.urutan),
      deskripsi: r.deskripsi as string,
      jumlah: Number(r.jumlah),
      harga_satuan: Number(r.harga_satuan),
    }))
    .sort((x, y) => x.urutan - y.urutan);

  const teks = (k: string) => (b[k] as string | null) ?? null;

  return {
    id: b.id as string,
    nomor: b.nomor as string,
    status: b.status as StatusInvoice,
    kontak_id: b.kontak_id as string,
    klien_nama: b.klien_nama as string,
    klien_nomor_wa: b.klien_nomor_wa as string,
    penerbit_nama: b.penerbit_nama as string,
    penerbit_alamat: teks("penerbit_alamat"),
    penerbit_nomor_wa: teks("penerbit_nomor_wa"),
    bank_nama: teks("bank_nama"),
    bank_rekening: teks("bank_rekening"),
    bank_atas_nama: teks("bank_atas_nama"),
    terbit_at: b.terbit_at as string,
    jatuh_tempo_at: b.jatuh_tempo_at as string,
    diskon: Number(b.diskon),
    ppn_persen: Number(b.ppn_persen),
    catatan: teks("catatan"),
    subtotal: Number(b.subtotal),
    nilai_ppn: Number(b.nilai_ppn),
    total: Number(b.total),
    berkas_path: teks("berkas_path"),
    dikirim_at: teks("dikirim_at"),
    lunas_at: teks("lunas_at"),
    dibuat_at: b.dibuat_at as string,
    baris,
  };
}

export async function ambil_invoice(): Promise<Invoice[]> {
  if (!supabase_siap()) return [];
  const db = await klien_server();
  const { data, error } = await db
    .from("invoice")
    .select(PILIHAN)
    .order("dibuat_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as unknown as Record<string, unknown>[]).map(ke_invoice);
}

export async function ambil_satu_invoice(id: string): Promise<Invoice | null> {
  if (!supabase_siap()) return null;
  const db = await klien_server();
  const { data } = await db.from("invoice").select(PILIHAN).eq("id", id).maybeSingle();
  if (!data) return null;
  return ke_invoice(data as unknown as Record<string, unknown>);
}

export type PilihanKontak = { id: string; nama: string; nomor_wa: string };

export async function ambil_kontak_untuk_invoice(): Promise<PilihanKontak[]> {
  if (!supabase_siap()) return [];
  const db = await klien_server();
  const { data } = await db
    .from("kontak")
    .select("id, nama, nomor_wa")
    .order("nama")
    .limit(1000);
  return ((data ?? []) as Record<string, unknown>[]).map((k) => ({
    id: k.id as string,
    nama: (k.nama as string | null) ?? `+${k.nomor_wa}`,
    nomor_wa: k.nomor_wa as string,
  }));
}

/** Layanan berharga dari halaman Pengetahuan, untuk mengisi baris invoice. */
export async function ambil_layanan_berharga(): Promise<
  { judul: string; harga: number }[]
> {
  if (!supabase_siap()) return [];
  const db = await klien_server();
  const { data } = await db
    .from("pengetahuan")
    .select("judul, harga")
    .eq("tipe", "layanan")
    .eq("aktif", true)
    .not("harga", "is", null)
    .order("judul")
    .limit(100);
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    judul: p.judul as string,
    harga: Number(p.harga),
  }));
}

export type RingkasanInvoice = {
  jumlah: number;
  belum_dibayar: number;
  nilai_belum_dibayar: number;
  lewat_tempo: number;
  lunas_bulan_ini: number;
};

export function ringkas_invoice(
  daftar: Invoice[],
  sekarang = new Date(),
): RingkasanInvoice {
  const hari_ini = sekarang.toISOString().slice(0, 10);
  const awal_bulan = `${hari_ini.slice(0, 7)}-01`;

  // Yang dibatalkan tidak ikut hitungan mana pun. Invoice batal bukan
  // tagihan yang belum dibayar, dan memasukkannya membuat angka piutang
  // terlihat lebih besar daripada yang sebenarnya bisa ditagih.
  const hidup = daftar.filter((i) => i.status !== "batal");
  const belum = hidup.filter((i) => i.status === "terkirim");

  return {
    jumlah: hidup.length,
    belum_dibayar: belum.length,
    nilai_belum_dibayar: belum.reduce((n, i) => n + i.total, 0),
    lewat_tempo: belum.filter((i) => i.jatuh_tempo_at < hari_ini).length,
    lunas_bulan_ini: hidup.filter(
      (i) => i.status === "lunas" && (i.lunas_at ?? "") >= awal_bulan,
    ).length,
  };
}
