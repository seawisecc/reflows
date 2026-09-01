import * as React from "react";
import { Bot } from "lucide-react";
import { BilahSisi } from "./bilah-sisi";
import { TombolTema } from "./tombol-tema";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { profil_saya } from "@/lib/data/pengguna";
import { supabase_siap } from "@/lib/lingkungan";

export async function BilahAtas({
  judul,
  keterangan,
  aksi,
}: {
  judul: string;
  keterangan?: string;
  aksi?: React.ReactNode;
}) {
  const profil = await profil_saya();
  const tersambung = supabase_siap();

  return (
    // Jangan pakai backdrop-blur di sini. Filter apa pun membuat header
    // jadi containing block baru, dan bilah sisi yang position fixed di
    // dalamnya ikut terkurung lalu menimpa konten.
    <header className="sticky top-0 z-20 border-b-2 border-garis bg-bg">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <BilahSisi
          nama_bisnis={profil?.tenant_nama ?? "Seawise Studio"}
          nama_pengguna={profil?.nama ?? null}
          email={profil?.email ?? null}
        />
        <div className="min-w-0 flex-1">
          <h1 className="pixel-lg truncate uppercase text-teks">{judul}</h1>
          {keterangan ? (
            <p className="mt-1.5 truncate text-xs text-redup">{keterangan}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Lencana
            nada={tersambung ? "sukses" : "tunggu"}
            className="hidden md:inline-flex"
          >
            <TitikStatus nada={tersambung ? "sukses" : "tunggu"} hidup={!tersambung} />
            {tersambung ? "Database tersambung" : "Database belum tersambung"}
          </Lencana>
          {aksi}
          <TombolTema />
          <div className="hidden items-center gap-2 border-2 border-garis bg-permukaan px-2.5 py-1.5 sm:flex">
            <Bot className="size-4 text-aksen-tinta" />
            <span className="pixel-sm uppercase text-redup">Hybrid</span>
          </div>
        </div>
      </div>
    </header>
  );
}
