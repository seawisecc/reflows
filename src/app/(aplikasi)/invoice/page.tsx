import Link from "next/link";
import { ArrowUpRight, CircleCheck, Clock, Receipt, Wallet } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana, type NadaLencana } from "@/komponen/ui/lencana";
import { KartuStatistik } from "@/komponen/ui/statistik";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { SpandukLayanan } from "@/komponen/spanduk-layanan";
import { PenyusunInvoice } from "./penyusun";
import {
  ambil_invoice,
  ambil_kontak_untuk_invoice,
  ambil_layanan_berharga,
  ringkas_invoice,
} from "@/lib/data/invoice";
import { ambil_pengaturan_invoice } from "@/lib/data/pengaturan";
import { pengaturan_ringkas } from "@/lib/data/pengaturan";
import { sisa_hari } from "@/lib/invoice/hitung";
import { supabase_siap } from "@/lib/lingkungan";
import { rupiah } from "@/lib/utils";
import { tanggal_pdf } from "@/lib/invoice/pdf";
import type { StatusInvoice } from "@/tipe";

export const metadata = { title: "Invoice | Reflows" };
export const dynamic = "force-dynamic";

export const RUPA_INVOICE: Record<
  StatusInvoice,
  { label: string; nada: NadaLencana }
> = {
  draf: { label: "Draf", nada: "netral" },
  terkirim: { label: "Menunggu bayar", nada: "tunggu" },
  lunas: { label: "Lunas", nada: "sukses" },
  batal: { label: "Dibatalkan", nada: "gagal" },
};

export default async function HalamanInvoice() {
  if (!supabase_siap()) {
    return (
      <>
        <BilahAtas judul="Invoice" keterangan="Tagihan PDF lewat WhatsApp" />
        <main className="p-4 sm:p-6">
          <Kartu>
            <Kosong
              ikon={Receipt}
              judul="Database belum tersambung"
              keterangan="Invoice menulis ke daftar kontak dan penyimpanan berkas sungguhan, jadi butuh Supabase menyala."
            />
          </Kartu>
        </main>
      </>
    );
  }

  const [daftar, kontak, layanan, profil, pengaturan] = await Promise.all([
    ambil_invoice(),
    ambil_kontak_untuk_invoice(),
    ambil_layanan_berharga(),
    ambil_pengaturan_invoice(),
    pengaturan_ringkas(),
  ]);
  const r = ringkas_invoice(daftar);
  const hari_ini = new Date().toISOString().slice(0, 10);

  return (
    <>
      <BilahAtas
        judul="Invoice"
        keterangan={
          daftar.length === 0
            ? "Belum ada invoice"
            : `${r.jumlah} invoice, ${r.belum_dibayar} menunggu bayar`
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        {pengaturan ? <SpandukLayanan izin={pengaturan.izin} /> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KartuStatistik
            label="Belum dibayar"
            nilai={rupiah(r.nilai_belum_dibayar)}
            ikon={Wallet}
            nada="tunggu"
            catatan={`Dari ${r.belum_dibayar} invoice yang sudah terkirim`}
          />
          <KartuStatistik
            label="Lewat tempo"
            nilai={String(r.lewat_tempo)}
            ikon={Clock}
            nada={r.lewat_tempo > 0 ? "gagal" : "netral"}
            catatan="Sudah lewat tanggal jatuh tempo dan belum ditandai lunas"
          />
          <KartuStatistik
            label="Lunas bulan ini"
            nilai={String(r.lunas_bulan_ini)}
            ikon={CircleCheck}
            nada="aksen"
            catatan="Dihitung dari tanggal kamu menandainya lunas"
          />
          <KartuStatistik
            label="Total invoice"
            nilai={String(r.jumlah)}
            ikon={Receipt}
            nada="netral"
            catatan="Yang dibatalkan tidak ikut dihitung"
          />
        </section>

        {kontak.length === 0 ? (
          <Kartu className="p-4">
            <p className="text-xs leading-relaxed text-redup">
              Belum ada kontak yang bisa ditagih. Tambahkan kontaknya dulu di
              halaman Kontak, atau tunggu sampai ada yang chat ke nomor bisnis
              kamu.
            </p>
          </Kartu>
        ) : (
          <PenyusunInvoice
            kontak={kontak}
            layanan={layanan}
            ppn_bawaan={profil?.ppn_persen ?? 0}
            tempo_bawaan={profil?.tempo_hari ?? 7}
            catatan_bawaan={profil?.catatan_invoice ?? null}
            bank_terisi={Boolean(profil?.bank_nama && profil?.bank_rekening)}
          />
        )}

        <Kartu>
          <KepalaKartu
            judul="Semua invoice"
            keterangan="Nomornya berurut per tahun dan tidak pernah dipakai dua kali."
            aksi={<Lencana nada="netral">{daftar.length} baris</Lencana>}
          />
          {daftar.length === 0 ? (
            <Kosong
              ikon={Receipt}
              judul="Belum ada invoice"
              keterangan="Susun invoice pertama di atas. Harganya bisa diambil langsung dari daftar layanan di halaman Pengetahuan."
            />
          ) : (
            <Tabel>
              <KepalaTabel>
                <tr>
                  <Th>Nomor</Th>
                  <Th>Client</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Jatuh tempo</Th>
                  <Th className="text-right">Total</Th>
                  <Th className="text-right">Buka</Th>
                </tr>
              </KepalaTabel>
              <tbody>
                {daftar.map((i) => {
                  const rupa = RUPA_INVOICE[i.status];
                  const sisa = sisa_hari(i.jatuh_tempo_at);
                  const telat = i.status === "terkirim" && i.jatuh_tempo_at < hari_ini;
                  return (
                    <Tr key={i.id}>
                      <Td className="angka whitespace-nowrap text-xs text-teks">
                        {i.nomor}
                      </Td>
                      <Td className="max-w-48 truncate text-sm text-teks">
                        {i.klien_nama}
                      </Td>
                      <Td>
                        <Lencana nada={telat ? "gagal" : rupa.nada}>
                          {telat ? "Lewat tempo" : rupa.label}
                        </Lencana>
                      </Td>
                      <Td className="angka whitespace-nowrap text-right text-xs text-redup">
                        {tanggal_pdf(i.jatuh_tempo_at)}
                        {i.status === "terkirim" ? (
                          <span
                            className={
                              telat
                                ? "mt-1 block text-gagal-tinta"
                                : "mt-1 block text-redup"
                            }
                          >
                            {telat ? `telat ${-sisa} hari` : `${sisa} hari lagi`}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="angka whitespace-nowrap text-right text-sm font-bold text-teks">
                        {rupiah(i.total)}
                      </Td>
                      <Td className="text-right">
                        <Link href={`/invoice/${i.id}`} className="fokus-pixel">
                          <ArrowUpRight className="ml-auto size-4 text-redup hover:text-aksen-tinta" />
                        </Link>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Tabel>
          )}
        </Kartu>
      </main>
    </>
  );
}
