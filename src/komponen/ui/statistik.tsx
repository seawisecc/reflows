import * as React from "react";
import { cn } from "@/lib/utils";
import { Kartu } from "./kartu";

export function KartuStatistik({
  label,
  nilai,
  satuan,
  catatan,
  ikon: Ikon,
  nada = "aksen",
}: {
  label: string;
  nilai: string;
  satuan?: string;
  catatan?: string;
  ikon?: React.ComponentType<{ className?: string }>;
  nada?: "netral" | "aksen" | "sekunder" | "tunggu" | "gagal";
}) {
  const warna = {
    netral: "text-teks",
    aksen: "text-aksen-tinta",
    sekunder: "text-sekunder-tinta",
    tunggu: "text-tunggu-tinta",
    gagal: "text-gagal-tinta",
  }[nada];

  return (
    <Kartu className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="pixel-sm uppercase text-redup">
          {label}
        </p>
        {Ikon ? <Ikon className={cn("size-4 shrink-0", warna)} /> : null}
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className={cn("angka text-3xl font-bold tracking-tight", warna)}>
          {nilai}
        </span>
        {satuan ? (
          <span className="pixel-sm uppercase text-redup">{satuan}</span>
        ) : null}
      </p>
      {catatan ? (
        <p className="mt-2 text-xs leading-relaxed text-redup">{catatan}</p>
      ) : null}
    </Kartu>
  );
}

/** Bar progres bergaya blok, terisi per petak dan bukan garis mulus. */
export function BarBlok({
  nilai,
  maks = 100,
  nada = "aksen",
  label,
}: {
  nilai: number;
  maks?: number;
  nada?: "aksen" | "sekunder" | "sukses" | "tunggu" | "gagal";
  label?: string;
}) {
  const persen = Math.max(0, Math.min(100, (nilai / maks) * 100));
  const warna = {
    aksen: "text-aksen-tinta",
    sekunder: "text-sekunder-tinta",
    sukses: "text-sukses-tinta",
    tunggu: "text-tunggu-tinta",
    gagal: "text-gagal-tinta",
  }[nada];

  return (
    <div className="space-y-1.5">
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-redup">{label}</span>
          <span className={cn("angka text-xs font-bold", warna)}>
            {Math.round(persen)}%
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={nilai}
        aria-valuemin={0}
        aria-valuemax={maks}
        aria-label={label}
        className="h-3 w-full border-2 border-garis bg-permukaan-2 p-0.5"
      >
        <div
          className={cn("bar-blok h-full", warna)}
          style={{ width: `${persen}%` }}
        />
      </div>
    </div>
  );
}
