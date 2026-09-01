import * as React from "react";
import { Bot } from "lucide-react";
import { BilahSisi } from "./bilah-sisi";
import { TombolTema } from "./tombol-tema";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";

export function BilahAtas({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  return (
    // Jangan pakai backdrop-blur di sini. Filter apa pun membuat header
    // jadi containing block baru, dan bilah sisi yang position fixed di
    // dalamnya ikut terkurung lalu menimpa konten.
    <header className="sticky top-0 z-20 border-b-2 border-garis bg-bg">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <BilahSisi />
        <div className="min-w-0 flex-1">
          <h1 className="pixel truncate text-[12px] uppercase text-teks">
            {judul}
          </h1>
          {keterangan ? (
            <p className="mt-1.5 truncate text-xs text-redup">{keterangan}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Lencana nada="tunggu" className="hidden md:inline-flex">
            <TitikStatus nada="tunggu" hidup />
            Gateway belum tersambung
          </Lencana>
          {aksi}
          <TombolTema />
          <div className="hidden items-center gap-2 border-2 border-garis bg-permukaan px-2.5 py-1.5 sm:flex">
            <Bot className="size-4 text-aksen-tinta" />
            <span className="pixel text-[9px] uppercase text-redup">Hybrid</span>
          </div>
        </div>
      </div>
    </header>
  );
}
