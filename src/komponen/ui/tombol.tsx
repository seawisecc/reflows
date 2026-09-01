import * as React from "react";
import { cn } from "@/lib/utils";

type Varian = "utama" | "sekunder" | "garis" | "hantu" | "bahaya";
type Ukuran = "kecil" | "sedang" | "besar";

const VARIAN: Record<Varian, string> = {
  utama: "bg-aksen text-aksen-teks border-aksen",
  sekunder: "bg-sekunder text-sekunder-teks border-sekunder",
  garis: "bg-permukaan text-teks border-garis-tegas",
  hantu: "bg-transparent text-redup border-transparent shadow-none hover:text-teks",
  bahaya: "bg-gagal-tinta text-gagal-teks border-gagal-tinta",
};

const UKURAN: Record<Ukuran, string> = {
  kecil: "h-8 px-3 text-[10px] gap-1.5",
  sedang: "h-10 px-4 text-[11px] gap-2",
  besar: "h-12 px-6 text-xs gap-2.5",
};

export interface PropsTombol
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  varian?: Varian;
  ukuran?: Ukuran;
}

export const Tombol = React.forwardRef<HTMLButtonElement, PropsTombol>(
  function Tombol(
    { className, varian = "utama", ukuran = "sedang", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "pixel fokus-pixel tekan inline-flex select-none items-center justify-center border-2 uppercase",
          "disabled:pointer-events-none disabled:opacity-40",
          varian !== "hantu" && "bayang-pixel-kecil",
          VARIAN[varian],
          UKURAN[ukuran],
          className,
        )}
        {...props}
      />
    );
  },
);
