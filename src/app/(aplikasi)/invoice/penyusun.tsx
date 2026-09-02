"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Plus, Receipt, Trash2, TriangleAlert } from "lucide-react";
import { buat_invoice } from "./aksi";
import { INVOICE_AWAL } from "./keadaan";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { AreaTeks, Bidang, Kolom, Pilih } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";
import { hitung_invoice, jatuh_tempo, total_baris } from "@/lib/invoice/hitung";
import { rupiah } from "@/lib/utils";
import type { PilihanKontak } from "@/lib/data/invoice";

type Baris = {
  kunci: string;
  deskripsi: string;
  jumlah: string;
  harga_satuan: string;
};

function baris_kosong(): Baris {
  return {
    kunci: Math.random().toString(36).slice(2),
    deskripsi: "",
    jumlah: "1",
    harga_satuan: "",
  };
}

/** Angka dari formulir: "4.500.000" dan "4500000" sama-sama diterima. */
function angka(nilai: string): number {
  const bersih = nilai.replace(/[^\d,]/g, "").replace(",", ".");
  const n = Number(bersih);
  return Number.isFinite(n) ? n : 0;
}

export function PenyusunInvoice({
  kontak,
  layanan,
  ppn_bawaan,
  tempo_bawaan,
  catatan_bawaan,
  bank_terisi,
}: {
  kontak: PilihanKontak[];
  layanan: { judul: string; harga: number }[];
  ppn_bawaan: number;
  tempo_bawaan: number;
  catatan_bawaan: string | null;
  bank_terisi: boolean;
}) {
  const [keadaan, aksi, menunggu] = React.useActionState(
    buat_invoice,
    INVOICE_AWAL,
  );
  const [buka, setBuka] = React.useState(false);
  const [baris, setBaris] = React.useState<Baris[]>([baris_kosong()]);
  const [diskon, setDiskon] = React.useState("");
  const [ppn, setPpn] = React.useState(String(ppn_bawaan));
  const [tempo, setTempo] = React.useState(String(tempo_bawaan));
  const hari_ini = new Date().toISOString().slice(0, 10);
  const [terbit, setTerbit] = React.useState(hari_ini);
  const router = useRouter();

  // Begitu invoicenya jadi, langsung ke halaman detailnya, karena di situ
  // tombol kirim dan pratinjau PDF-nya.
  const [id_terakhir, setIdTerakhir] = React.useState<string | null>(null);
  if (keadaan.id && keadaan.id !== id_terakhir) {
    setIdTerakhir(keadaan.id);
    router.push(`/invoice/${keadaan.id}`);
  }

  const untuk_hitung = baris.map((b) => ({
    jumlah: angka(b.jumlah),
    harga_satuan: angka(b.harga_satuan),
  }));
  const h = hitung_invoice({
    baris: untuk_hitung,
    diskon: angka(diskon),
    ppn_persen: angka(ppn),
  });

  const siap = baris.some(
    (b) => b.deskripsi.trim() && angka(b.jumlah) > 0 && angka(b.harga_satuan) >= 0,
  );

  function ubah(kunci: string, ubahan: Partial<Baris>) {
    setBaris((lama) =>
      lama.map((b) => (b.kunci === kunci ? { ...b, ...ubahan } : b)),
    );
  }

  if (!buka) {
    return (
      <Kartu className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-redup">
            Harga bisa diambil dari daftar layanan di halaman Pengetahuan, jadi
            angkanya tidak diketik ulang tiap kali menagih.
          </p>
          <Tombol ukuran="kecil" onClick={() => setBuka(true)}>
            <Plus className="size-3.5" />
            Invoice baru
          </Tombol>
        </div>
      </Kartu>
    );
  }

  return (
    <Kartu>
      <KepalaKartu
        judul="Invoice baru"
        keterangan="PDF-nya dibuat begitu disimpan. Pengirimannya menyusul di halaman berikutnya."
        aksi={
          <Tombol varian="hantu" ukuran="kecil" onClick={() => setBuka(false)}>
            Tutup
          </Tombol>
        }
      />
      <IsiKartu>
        <form action={aksi} className="space-y-5">
          <input
            type="hidden"
            name="baris"
            value={JSON.stringify(
              baris
                .filter((b) => b.deskripsi.trim())
                .map((b) => ({
                  deskripsi: b.deskripsi,
                  jumlah: angka(b.jumlah),
                  harga_satuan: angka(b.harga_satuan),
                })),
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label="Ditagihkan kepada">
              <Pilih name="kontak_id" required defaultValue="">
                <option value="" disabled>
                  Pilih client
                </option>
                {kontak.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </Pilih>
            </Kolom>
            <div className="grid grid-cols-2 gap-3">
              <Kolom label="Tanggal terbit">
                <Bidang
                  type="date"
                  name="terbit_at"
                  value={terbit}
                  onChange={(e) => setTerbit(e.target.value)}
                />
              </Kolom>
              <Kolom label="Tempo (hari)">
                <Bidang
                  name="tempo_hari"
                  inputMode="numeric"
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                />
              </Kolom>
            </div>
          </div>
          <p className="text-xs text-redup">
            Jatuh tempo {jatuh_tempo(terbit, angka(tempo))}
          </p>

          {/* ---------- Baris ---------- */}
          <div className="space-y-3">
            <p className="pixel-sm uppercase text-redup">Yang ditagihkan</p>
            {baris.map((b, i) => (
              <div
                key={b.kunci}
                className="space-y-2 border-2 border-garis p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="pixel-sm grid size-5 shrink-0 place-items-center border-2 border-garis text-redup">
                    {i + 1}
                  </span>
                  {layanan.length > 0 ? (
                    <Pilih
                      aria-label="Ambil dari daftar layanan"
                      value=""
                      onChange={(e) => {
                        const l = layanan.find((x) => x.judul === e.target.value);
                        if (l) {
                          ubah(b.kunci, {
                            deskripsi: l.judul,
                            harga_satuan: String(l.harga),
                          });
                        }
                      }}
                      className="h-8 text-xs"
                    >
                      <option value="">Ambil dari layanan</option>
                      {layanan.map((l) => (
                        <option key={l.judul} value={l.judul}>
                          {l.judul} | {rupiah(l.harga)}
                        </option>
                      ))}
                    </Pilih>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      setBaris((lama) =>
                        lama.length === 1
                          ? [baris_kosong()]
                          : lama.filter((x) => x.kunci !== b.kunci),
                      )
                    }
                    aria-label={`Hapus baris ${i + 1}`}
                    className="fokus-pixel ml-auto shrink-0 text-redup hover:text-gagal-tinta"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                <AreaTeks
                  value={b.deskripsi}
                  onChange={(e) => ubah(b.kunci, { deskripsi: e.target.value })}
                  aria-label={`Deskripsi baris ${i + 1}`}
                  placeholder="Website Company Profile, 5 halaman, domain dan hosting setahun"
                  className="min-h-14"
                  maxLength={300}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <Bidang
                    value={b.jumlah}
                    onChange={(e) => ubah(b.kunci, { jumlah: e.target.value })}
                    aria-label={`Jumlah baris ${i + 1}`}
                    inputMode="decimal"
                    className="max-w-20"
                  />
                  <span className="pixel-sm shrink-0 uppercase text-redup">kali</span>
                  <Bidang
                    value={b.harga_satuan}
                    onChange={(e) =>
                      ubah(b.kunci, { harga_satuan: e.target.value })
                    }
                    aria-label={`Harga satuan baris ${i + 1}`}
                    inputMode="numeric"
                    placeholder="4500000"
                    className="max-w-40"
                  />
                  <span className="angka ml-auto text-sm font-bold text-teks">
                    {rupiah(
                      total_baris({
                        jumlah: angka(b.jumlah),
                        harga_satuan: angka(b.harga_satuan),
                      }),
                    )}
                  </span>
                </div>
              </div>
            ))}

            <Tombol
              type="button"
              varian="garis"
              ukuran="kecil"
              onClick={() => setBaris((lama) => [...lama, baris_kosong()])}
            >
              <Plus className="size-3.5" />
              Tambah baris
            </Tombol>
          </div>

          {/* ---------- Potongan dan pajak ---------- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label="Diskon" petunjuk="Rupiah, dipotong sebelum PPN dihitung.">
              <Bidang
                name="diskon"
                inputMode="numeric"
                value={diskon}
                onChange={(e) => setDiskon(e.target.value)}
                placeholder="0"
              />
            </Kolom>
            <Kolom label="PPN persen" petunjuk="Kosongkan atau isi 0 kalau tidak memungut PPN.">
              <Bidang
                name="ppn_persen"
                inputMode="decimal"
                value={ppn}
                onChange={(e) => setPpn(e.target.value)}
              />
            </Kolom>
          </div>

          <Kolom label="Catatan di invoice">
            <AreaTeks
              name="catatan"
              defaultValue={catatan_bawaan ?? ""}
              className="min-h-16"
              maxLength={1000}
              placeholder="Pembayaran DP 50 persen sebelum pengerjaan dimulai, sisanya saat serah terima."
            />
          </Kolom>

          {/* ---------- Total ---------- */}
          <div className="space-y-2 border-2 border-garis-tegas bg-permukaan-2 p-4">
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-redup">Subtotal</dt>
                <dd className="angka text-teks">{rupiah(h.subtotal)}</dd>
              </div>
              {h.diskon > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-redup">Diskon</dt>
                  <dd className="angka text-teks">-{rupiah(h.diskon)}</dd>
                </div>
              ) : null}
              {h.ppn_persen > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-redup">PPN {h.ppn_persen}%</dt>
                  <dd className="angka text-teks">{rupiah(h.nilai_ppn)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="pemisah-pixel" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="pixel-sm uppercase text-redup">Total tagihan</span>
              <span className="angka text-xl font-bold text-aksen-tinta">
                {rupiah(h.total)}
              </span>
            </div>
          </div>

          {!bank_terisi ? (
            <p className="flex items-start gap-2 border-2 border-tunggu-tinta bg-permukaan-2 px-3 py-2.5 text-xs leading-relaxed text-tunggu-tinta">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              Rekening bank belum diisi di Pengaturan, jadi invoicenya terbit
              tanpa cara pembayaran. Client harus menanyakannya lagi ke kamu.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Tombol type="submit" disabled={menunggu || !siap}>
              <Receipt className="size-3.5" />
              {menunggu ? "Menyimpan" : "Simpan dan buat PDF"}
            </Tombol>
            {!siap ? (
              <Lencana nada="netral">Isi minimal satu baris dulu</Lencana>
            ) : null}
            {keadaan.galat ? (
              <p role="alert" className="flex items-center gap-2 text-xs text-gagal-tinta">
                <TriangleAlert className="size-3.5 shrink-0" />
                {keadaan.galat}
              </p>
            ) : keadaan.pesan ? (
              <p role="status" className="flex items-center gap-2 text-xs text-sukses-tinta">
                <CircleCheck className="size-3.5 shrink-0" />
                {keadaan.pesan}
              </p>
            ) : null}
          </div>
        </form>
      </IsiKartu>
    </Kartu>
  );
}
