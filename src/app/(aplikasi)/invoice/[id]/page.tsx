import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { Lencana } from "@/komponen/ui/lencana";
import { KendaliInvoice } from "../kendali";
import { RUPA_INVOICE } from "../page";
import { ambil_satu_invoice } from "@/lib/data/invoice";
import { sisa_hari, total_baris } from "@/lib/invoice/hitung";
import { tanggal_pdf } from "@/lib/invoice/pdf";
import { rupiah, waktu_relatif } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await ambil_satu_invoice(id);
  return { title: inv ? `${inv.nomor} | Reflows` : "Invoice | Reflows" };
}

export default async function DetailInvoice({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inv = await ambil_satu_invoice(id);
  if (!inv) notFound();

  const rupa = RUPA_INVOICE[inv.status];
  const hari_ini = new Date().toISOString().slice(0, 10);
  const telat = inv.status === "terkirim" && inv.jatuh_tempo_at < hari_ini;
  const sisa = sisa_hari(inv.jatuh_tempo_at);

  return (
    <>
      <BilahAtas
        judul={inv.nomor}
        keterangan={`${inv.klien_nama} | ${rupiah(inv.total)}`}
        aksi={
          <div className="flex items-center gap-2">
            <Lencana nada={telat ? "gagal" : rupa.nada}>
              {telat ? `Lewat tempo ${-sisa} hari` : rupa.label}
            </Lencana>
            <Link href="/invoice">
              <span className="pixel-sm fokus-pixel inline-flex items-center gap-1.5 border-2 border-garis px-2 py-1.5 uppercase text-redup hover:border-garis-tegas hover:text-teks">
                <ArrowLeft className="size-3.5" />
                Semua
              </span>
            </Link>
          </div>
        }
      />

      <main className="space-y-6 p-4 sm:p-6">
        <Kartu>
          <KepalaKartu
            judul="Kendali"
            keterangan="PDF-nya di penyimpanan tertutup. Tautannya dibuat saat diminta dan berumur tujuh hari."
          />
          <div className="p-4">
            <KendaliInvoice
              id={inv.id}
              status={inv.status}
              sudah_dikirim={inv.dikirim_at !== null}
              ada_pdf={inv.berkas_path !== null}
            />
          </div>
        </Kartu>

        {!inv.berkas_path ? (
          <p className="flex items-start gap-2 border-2 border-tunggu-tinta bg-permukaan-2 px-4 py-3 text-xs leading-relaxed text-tunggu-tinta">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            PDF-nya belum tersimpan. Tekan Terbitkan ulang PDF sebelum
            mengirimnya ke client.
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <Kartu className="xl:col-span-2">
            <KepalaKartu
              judul="Yang ditagihkan"
              keterangan="Angka di sini salinan saat invoice diterbitkan, jadi tidak ikut berubah kalau harga layanan dinaikkan nanti."
            />
            <Tabel>
              <KepalaTabel>
                <tr>
                  <Th>Deskripsi</Th>
                  <Th className="text-right">Jumlah</Th>
                  <Th className="text-right">Harga</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </KepalaTabel>
              <tbody>
                {inv.baris.map((b) => (
                  <Tr key={b.id}>
                    <Td className="max-w-80 text-sm leading-relaxed text-teks">
                      {b.deskripsi}
                    </Td>
                    <Td className="angka text-right text-xs">{b.jumlah}</Td>
                    <Td className="angka whitespace-nowrap text-right text-xs">
                      {rupiah(b.harga_satuan)}
                    </Td>
                    <Td className="angka whitespace-nowrap text-right text-sm text-teks">
                      {rupiah(total_baris(b))}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
            <div className="space-y-2 border-t-2 border-garis p-4">
              <dl className="ml-auto max-w-72 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-redup">Subtotal</dt>
                  <dd className="angka text-teks">{rupiah(inv.subtotal)}</dd>
                </div>
                {inv.diskon > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-redup">Diskon</dt>
                    <dd className="angka text-teks">-{rupiah(inv.diskon)}</dd>
                  </div>
                ) : null}
                {inv.ppn_persen > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-redup">PPN {inv.ppn_persen}%</dt>
                    <dd className="angka text-teks">{rupiah(inv.nilai_ppn)}</dd>
                  </div>
                ) : null}
                <div className="pemisah-pixel" />
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="pixel-sm uppercase text-redup">Total</dt>
                  <dd className="angka text-lg font-bold text-aksen-tinta">
                    {rupiah(inv.total)}
                  </dd>
                </div>
              </dl>
            </div>
          </Kartu>

          <div className="space-y-6">
            <Kartu>
              <KepalaKartu judul="Rincian" />
              <dl className="divide-y-2 divide-[var(--garis)]">
                {[
                  ["Ditagihkan kepada", inv.klien_nama],
                  ["Nomor WhatsApp", inv.klien_nomor_wa],
                  ["Tanggal terbit", tanggal_pdf(inv.terbit_at)],
                  ["Jatuh tempo", tanggal_pdf(inv.jatuh_tempo_at)],
                  [
                    "Dikirim",
                    inv.dikirim_at ? waktu_relatif(inv.dikirim_at) : "Belum",
                  ],
                  [
                    "Ditandai lunas",
                    inv.lunas_at ? waktu_relatif(inv.lunas_at) : "Belum",
                  ],
                ].map(([label, nilai]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-xs"
                  >
                    <dt className="shrink-0 text-redup">{label}</dt>
                    <dd className="text-right text-teks">{nilai}</dd>
                  </div>
                ))}
              </dl>
            </Kartu>

            <Kartu>
              <KepalaKartu judul="Cara pembayaran" />
              <div className="space-y-1.5 p-4 text-xs">
                {inv.bank_nama || inv.bank_rekening ? (
                  <>
                    <p className="angka text-sm font-bold text-teks">
                      {[inv.bank_nama, inv.bank_rekening].filter(Boolean).join("  ")}
                    </p>
                    {inv.bank_atas_nama ? (
                      <p className="text-redup">atas nama {inv.bank_atas_nama}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="leading-relaxed text-tunggu-tinta">
                    Belum diisi saat invoice ini terbit, jadi PDF-nya tidak
                    memuat cara pembayaran. Lengkapi di Pengaturan, lalu
                    terbitkan ulang PDF-nya.
                  </p>
                )}
              </div>
            </Kartu>

            {inv.catatan ? (
              <Kartu>
                <KepalaKartu judul="Catatan" />
                <p className="p-4 text-xs leading-relaxed text-redup">
                  {inv.catatan}
                </p>
              </Kartu>
            ) : null}
          </div>
        </div>
      </main>
    </>
  );
}
