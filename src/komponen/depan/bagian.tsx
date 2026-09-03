import * as React from "react";
import { cn } from "@/lib/utils";

/** Satu bagian halaman depan, lengkap dengan judul dan jarak yang seragam. */
export function Bagian({
  id,
  judul,
  keterangan,
  className,
  children,
}: {
  id?: string;
  judul: string;
  keterangan?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "border-t-2 border-garis px-4 py-16 sm:px-6",
        // Bilah atas menempel di puncak layar, jadi tautan #paket akan
        // mendarat dengan judulnya tertutup bilah kalau tanpa ini.
        id && "scroll-mt-16",
        className,
      )}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="pixel-xl uppercase text-teks">{judul}</h2>
        {keterangan ? (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-redup">
            {keterangan}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
