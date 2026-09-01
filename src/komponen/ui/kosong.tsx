import * as React from "react";

export function Kosong({
  ikon: Ikon,
  judul,
  keterangan,
  aksi,
}: {
  ikon?: React.ComponentType<{ className?: string }>;
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {Ikon ? <Ikon className="size-8 text-redup" /> : null}
      <p className="pixel text-[11px] uppercase text-teks">{judul}</p>
      {keterangan ? (
        <p className="max-w-sm text-xs leading-relaxed text-redup">
          {keterangan}
        </p>
      ) : null}
      {aksi ? <div className="mt-1">{aksi}</div> : null}
    </div>
  );
}
