import Link from "next/link";
import { Gauge } from "lucide-react";
import { rupiah, angka as ke_angka } from "@/lib/utils";
import type { Kuota } from "@/lib/data/kuota";

/**
 * Peringatan kuota di dasbor.
 *
 * Baru muncul saat sudah 80 persen. Spanduk yang selalu ada berhenti dibaca
 * dalam seminggu, dan yang paling perlu terbaca justru saat AI benar-benar
 * berhenti membalas.
 */
export function SpandukKuota({ kuota }: { kuota: Kuota }) {
  if (kuota.boleh && !kuota.peringatan) return null;

  const berhenti = !kuota.boleh;

  return (
    <div
      role="status"
      className={
        berhenti
          ? "flex flex-wrap items-start gap-3 border-2 border-gagal-tinta bg-permukaan-2 px-4 py-3"
          : "flex flex-wrap items-start gap-3 border-2 border-tunggu-tinta bg-permukaan-2 px-4 py-3"
      }
    >
      <Gauge
        className={
          berhenti
            ? "mt-0.5 size-4 shrink-0 text-gagal-tinta"
            : "mt-0.5 size-4 shrink-0 text-tunggu-tinta"
        }
      />
      <div className="min-w-0 flex-1">
        <p
          className={
            berhenti
              ? "pixel-sm uppercase text-gagal-tinta"
              : "pixel-sm uppercase text-tunggu-tinta"
          }
        >
          {berhenti ? "AI berhenti membalas" : "Kuota hampir habis"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-redup">
          {berhenti
            ? kuota.sebab
            : `${ke_angka(kuota.terpakai)} dari ${ke_angka(kuota.kuota)} balasan paket ${kuota.sifat.label} sudah terpakai. Setelah habis, AI tetap membalas dan kelebihannya ditagih ${rupiah(kuota.sifat.tarif_kelebihan)} per balasan.`}
        </p>
      </div>
      <Link href="/penggunaan" className="fokus-pixel shrink-0">
        <span
          className={
            berhenti
              ? "pixel-sm inline-flex items-center border-2 border-gagal-tinta px-2 py-1.5 uppercase text-gagal-tinta"
              : "pixel-sm inline-flex items-center border-2 border-tunggu-tinta px-2 py-1.5 uppercase text-tunggu-tinta"
          }
        >
          Lihat pemakaian
        </span>
      </Link>
    </div>
  );
}
