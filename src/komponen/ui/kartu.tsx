import * as React from "react";
import { cn } from "@/lib/utils";

export function Kartu({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("kotak kotak-tegas bayang-pixel", className)}
      {...props}
    />
  );
}

export function KepalaKartu({
  judul,
  keterangan,
  aksi,
  className,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b-2 border-garis px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="pixel text-[11px] uppercase text-teks">{judul}</h2>
        {keterangan ? (
          <p className="mt-1.5 text-xs leading-relaxed text-redup">
            {keterangan}
          </p>
        ) : null}
      </div>
      {aksi ? <div className="shrink-0">{aksi}</div> : null}
    </div>
  );
}

export function IsiKartu({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}
