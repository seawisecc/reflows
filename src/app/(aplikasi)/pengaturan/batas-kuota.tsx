"use client";

import * as React from "react";
import { CircleCheck, Gauge, TriangleAlert } from "lucide-react";
import { simpan_batas_kelebihan } from "./aksi";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";
import { rupiah, angka as ke_angka } from "@/lib/utils";
import type { Kuota } from "@/lib/data/kuota";

export function BatasKuota({ kuota }: { kuota: Kuota }) {
  const [menunggu, mulai] = React.useTransition();
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pesan, setPesan] = React.useState<string | null>(null);
  const [nilai, setNilai] = React.useState(
    kuota.batas_kelebihan === null ? "" : String(kuota.batas_kelebihan),
  );

  return (
    <Kartu>
      <KepalaKartu
        judul="Kuota balasan AI"
        keterangan={`Paket ${kuota.sifat.label}, ${ke_angka(kuota.kuota)} balasan per bulan. Kuota habis tidak mematikan AI, kecuali kamu yang memasang batasnya.`}
        aksi={
          <Lencana nada={kuota.kelebihan > 0 ? "tunggu" : "sukses"}>
            {ke_angka(kuota.terpakai)} dari {ke_angka(kuota.kuota)}
          </Lencana>
        }
      />
      <IsiKartu className="space-y-4">
        <Kolom
          label="Batas kelebihan"
          petunjuk={`Kosongkan berarti tanpa batas: AI terus membalas dan kelebihannya ditagih ${rupiah(kuota.sifat.tarif_kelebihan)} per balasan. Isi 0 berarti AI berhenti tepat saat kuota habis.`}
        >
          <Bidang
            value={nilai}
            onChange={(e) => setNilai(e.target.value)}
            inputMode="numeric"
            placeholder="Kosong berarti tanpa batas"
            className="max-w-64"
          />
        </Kolom>

        <div className="flex flex-wrap items-center gap-3">
          <Tombol
            disabled={menunggu}
            onClick={() =>
              mulai(async () => {
                setPesan(null);
                const h = await simpan_batas_kelebihan(nilai);
                setGalat(h.galat);
                if (!h.galat) setPesan("Batas kelebihan tersimpan.");
              })
            }
          >
            <Gauge className="size-3.5" />
            {menunggu ? "Menyimpan" : "Simpan batas"}
          </Tombol>
          {galat ? (
            <p role="alert" className="flex items-center gap-2 text-xs text-gagal-tinta">
              <TriangleAlert className="size-3.5 shrink-0" />
              {galat}
            </p>
          ) : pesan ? (
            <p role="status" className="flex items-center gap-2 text-xs text-sukses-tinta">
              <CircleCheck className="size-3.5 shrink-0" />
              {pesan}
            </p>
          ) : null}
        </div>

        <p className="text-xs leading-relaxed text-redup">
          Angka nol memang menghentikan AI, dan itu pilihan yang sah. Tapi
          client yang tidak dibalas biasanya lebih merugikan daripada tagihan
          kelebihan yang wajar, jadi bawaannya sengaja tanpa batas.
        </p>
      </IsiKartu>
    </Kartu>
  );
}
