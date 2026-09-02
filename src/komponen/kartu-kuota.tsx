import Link from "next/link";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { BarBlok } from "@/komponen/ui/statistik";
import { Lencana } from "@/komponen/ui/lencana";
import { rupiah, angka as ke_angka } from "@/lib/utils";
import type { Kuota } from "@/lib/data/kuota";

/**
 * Kartu kuota bulan berjalan.
 *
 * Ditampilkan penuh, termasuk kelebihan dan perkiraan tagihannya. Kuota yang
 * habis tidak mematikan AI, jadi satu-satunya cara tenant tidak kaget di
 * akhir bulan adalah melihat angkanya berjalan sepanjang bulan.
 */
export function KartuKuota({ kuota }: { kuota: Kuota }) {
  const lewat = kuota.kelebihan > 0;

  return (
    <Kartu className={lewat ? "border-tunggu-tinta" : undefined}>
      <KepalaKartu
        judul={`Paket ${kuota.sifat.label}`}
        keterangan={`${kuota.sifat.keterangan}. Kuota diputar ulang tiap awal bulan.`}
        aksi={
          <Lencana nada={lewat ? "tunggu" : kuota.peringatan ? "tunggu" : "sukses"}>
            {lewat
              ? `${ke_angka(kuota.kelebihan)} lewat kuota`
              : `${ke_angka(kuota.sisa)} balasan tersisa`}
          </Lencana>
        }
      />
      <div className="space-y-4 p-4">
        <BarBlok
          nilai={Math.min(kuota.terpakai, kuota.kuota)}
          maks={kuota.kuota}
          nada={lewat ? "gagal" : kuota.peringatan ? "tunggu" : "aksen"}
          label={`${ke_angka(kuota.terpakai)} dari ${ke_angka(kuota.kuota)} balasan AI`}
        />

        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-redup">Langganan</dt>
            <dd className="angka text-teks">{rupiah(kuota.sifat.harga_bulanan)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-redup">Tarif kelebihan</dt>
            <dd className="angka text-teks">
              {rupiah(kuota.sifat.tarif_kelebihan)} per balasan
            </dd>
          </div>
          {lewat ? (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-tunggu-tinta">Kelebihan</dt>
              <dd className="angka text-tunggu-tinta">
                {rupiah(kuota.biaya_kelebihan)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-redup">Batas kelebihan</dt>
            <dd className="angka text-teks">
              {kuota.batas_kelebihan === null
                ? "tanpa batas"
                : `${ke_angka(kuota.batas_kelebihan)} balasan`}
            </dd>
          </div>
        </dl>

        <div className="pemisah-pixel" />

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="pixel-sm uppercase text-redup">
            Perkiraan tagihan bulan ini
          </span>
          <span className="angka text-xl font-bold text-aksen-tinta">
            {rupiah(kuota.tagihan)}
          </span>
        </div>

        {!kuota.boleh ? (
          <p className="border-2 border-gagal-tinta bg-permukaan-2 px-3 py-2.5 text-xs leading-relaxed text-gagal-tinta">
            {kuota.sebab}
          </p>
        ) : kuota.peringatan && !lewat ? (
          <p className="text-xs leading-relaxed text-tunggu-tinta">
            Kuota sudah terpakai {Math.round(kuota.rasio * 100)} persen. Setelah
            habis, AI tetap membalas dan kelebihannya ditagih{" "}
            {rupiah(kuota.sifat.tarif_kelebihan)} per balasan.
          </p>
        ) : null}

        <Link href="/pengaturan" className="fokus-pixel">
          <span className="pixel-sm inline-flex items-center border-2 border-garis px-2 py-1.5 uppercase text-redup hover:border-garis-tegas hover:text-teks">
            Atur batas kelebihan
          </span>
        </Link>
      </div>
    </Kartu>
  );
}
