import Link from "next/link";
import { PauseCircle, ShieldOff } from "lucide-react";
import type { IzinLayanan } from "@/lib/layanan";

/**
 * Spanduk keadaan layanan.
 *
 * Muncul di setiap layar kerja harian selama layanan mati. Layanan yang
 * diam-diam berhenti membalas adalah kegagalan paling mahal di produk ini:
 * tidak ada galat, tidak ada tanda, cuma client yang tidak pernah dibalas
 * dan pemilik yang mengira semuanya baik-baik saja.
 */
export function SpandukLayanan({ izin }: { izin: IzinLayanan }) {
  if (izin.menyala) return null;

  const disuspensi = izin.jenis === "disuspensi";
  const Ikon = disuspensi ? ShieldOff : PauseCircle;

  return (
    <div
      role="status"
      className={
        disuspensi
          ? "flex flex-wrap items-start gap-3 border-2 border-gagal-tinta bg-permukaan-2 px-4 py-3"
          : "flex flex-wrap items-start gap-3 border-2 border-tunggu-tinta bg-permukaan-2 px-4 py-3"
      }
    >
      <Ikon
        className={
          disuspensi
            ? "mt-0.5 size-4 shrink-0 text-gagal-tinta"
            : "mt-0.5 size-4 shrink-0 text-tunggu-tinta"
        }
      />
      <div className="min-w-0 flex-1">
        <p
          className={
            disuspensi
              ? "pixel-sm uppercase text-gagal-tinta"
              : "pixel-sm uppercase text-tunggu-tinta"
          }
        >
          {disuspensi ? "Layanan disuspensi" : "Otomasi sedang dijeda"}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-redup">
          {izin.sebab} Tidak ada data yang dihapus.
        </p>
      </div>
      {disuspensi ? null : (
        <Link href="/pengaturan" className="fokus-pixel shrink-0">
          <span className="pixel-sm inline-flex items-center border-2 border-tunggu-tinta px-2 py-1.5 uppercase text-tunggu-tinta">
            Nyalakan lagi
          </span>
        </Link>
      )}
    </div>
  );
}
