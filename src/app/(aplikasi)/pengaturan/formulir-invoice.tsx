"use client";

import * as React from "react";
import { CircleCheck, Receipt, TriangleAlert } from "lucide-react";
import { simpan_pengaturan_invoice, type KeadaanPengaturan } from "./aksi";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { AreaTeks, Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";
import type { PengaturanInvoice } from "@/lib/data/pengaturan";

const AWAL: KeadaanPengaturan = { galat: null, pesan: null };

export function FormulirInvoice({ awal }: { awal: PengaturanInvoice }) {
  const [keadaan, aksi, menunggu] = React.useActionState(
    simpan_pengaturan_invoice,
    AWAL,
  );
  const lengkap = Boolean(awal.bank_nama && awal.bank_rekening);

  return (
    <Kartu>
      <KepalaKartu
        judul="Identitas invoice"
        keterangan="Yang muncul di kepala PDF dan di bagian cara pembayaran. Dibaca sekali saat invoice diterbitkan, lalu disalin ke invoicenya."
        aksi={
          <Lencana nada={lengkap ? "sukses" : "tunggu"}>
            {lengkap ? "Rekening terisi" : "Rekening belum ada"}
          </Lencana>
        }
      />
      <IsiKartu>
        <form action={aksi} className="space-y-4">
          <Kolom
            label="Alamat bisnis"
            petunjuk="Muncul di bawah nama bisnis. Kosongkan kalau tidak perlu."
          >
            <AreaTeks
              name="alamat_bisnis"
              defaultValue={awal.alamat_bisnis ?? ""}
              className="min-h-16"
              maxLength={300}
              placeholder="Jalan Raya Canggu No. 88, Kuta Utara, Badung, Bali 80361"
            />
          </Kolom>

          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label="Nama bank">
              <Bidang
                name="bank_nama"
                defaultValue={awal.bank_nama ?? ""}
                maxLength={60}
                placeholder="BCA"
              />
            </Kolom>
            <Kolom label="Nomor rekening">
              <Bidang
                name="bank_rekening"
                defaultValue={awal.bank_rekening ?? ""}
                maxLength={40}
                inputMode="numeric"
                placeholder="7712345678"
              />
            </Kolom>
          </div>

          <Kolom label="Rekening atas nama">
            <Bidang
              name="bank_atas_nama"
              defaultValue={awal.bank_atas_nama ?? ""}
              maxLength={120}
              placeholder="Agus Yulyastrawan"
            />
          </Kolom>

          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom
              label="PPN persen"
              petunjuk="Isi 0 kalau belum jadi pengusaha kena pajak. Bisa diubah per invoice."
            >
              <Bidang
                name="ppn_persen"
                defaultValue={String(awal.ppn_persen)}
                inputMode="decimal"
              />
            </Kolom>
            <Kolom
              label="Tempo pembayaran"
              petunjuk="Hari, dihitung dari tanggal terbit."
            >
              <Bidang
                name="tempo_hari"
                defaultValue={String(awal.tempo_hari)}
                inputMode="numeric"
              />
            </Kolom>
          </div>

          <Kolom
            label="Catatan bawaan"
            petunjuk="Terisi otomatis di setiap invoice baru, dan masih bisa diubah per invoice."
          >
            <AreaTeks
              name="catatan_invoice"
              defaultValue={awal.catatan_invoice ?? ""}
              className="min-h-16"
              maxLength={1000}
              placeholder="Pembayaran DP 50 persen sebelum pengerjaan dimulai, sisanya saat serah terima."
            />
          </Kolom>

          <div className="flex flex-wrap items-center gap-3">
            <Tombol type="submit" disabled={menunggu}>
              <Receipt className="size-3.5" />
              {menunggu ? "Menyimpan" : "Simpan identitas invoice"}
            </Tombol>
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
