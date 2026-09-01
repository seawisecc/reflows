import * as React from "react";
import { cn } from "@/lib/utils";

export type NadaLencana =
  | "netral"
  | "aksen"
  | "sekunder"
  | "sukses"
  | "tunggu"
  | "gagal";

const NADA: Record<NadaLencana, string> = {
  netral: "border-garis-tegas text-redup",
  aksen: "border-aksen-tinta text-aksen-tinta",
  sekunder: "border-sekunder-tinta text-sekunder-tinta",
  sukses: "border-sukses-tinta text-sukses-tinta",
  tunggu: "border-tunggu-tinta text-tunggu-tinta",
  gagal: "border-gagal-tinta text-gagal-tinta",
};

export function Lencana({
  nada = "netral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { nada?: NadaLencana }) {
  return (
    <span
      className={cn(
        "pixel inline-flex items-center gap-1.5 border-2 px-2 py-1 text-[9px] uppercase leading-none",
        NADA[nada],
        className,
      )}
      {...props}
    />
  );
}

/** Titik status kecil. `hidup` membuatnya berdenyut, untuk hal yang sedang berjalan. */
export function TitikStatus({
  nada = "netral",
  hidup = false,
  className,
}: {
  nada?: NadaLencana;
  hidup?: boolean;
  className?: string;
}) {
  const warna: Record<NadaLencana, string> = {
    netral: "bg-redup",
    aksen: "bg-aksen-tinta",
    sekunder: "bg-sekunder-tinta",
    sukses: "bg-sukses-tinta",
    tunggu: "bg-tunggu-tinta",
    gagal: "bg-gagal-tinta",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0",
        warna[nada],
        hidup && "denyut",
        className,
      )}
    />
  );
}
