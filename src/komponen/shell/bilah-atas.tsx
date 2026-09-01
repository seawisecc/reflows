import * as React from "react";
import { Bot } from "lucide-react";
import { BilahSisi } from "./bilah-sisi";
import { TombolTema } from "./tombol-tema";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { profil_saya } from "@/lib/data/pengguna";
import { status_perangkat } from "@/lib/data/pengaturan";
import { tampilkan_nomor } from "@/lib/gateway/nomor";
import { supabase_siap } from "@/lib/lingkungan";

/**
 * Lencana status WhatsApp.
 *
 * Sengaja selalu terlihat di setiap halaman. Nomor yang diam-diam terputus
 * adalah kegagalan paling mahal di produk ini: tidak ada galat, tidak ada
 * pesan, cuma client yang tidak pernah dibalas dan pemilik yang tidak tahu.
 */
async function StatusWhatsApp() {
  const status = await status_perangkat();
  if (!status) return null;

  if (status.gateway !== "fonnte") {
    return (
      <Lencana nada="netral" className="hidden md:inline-flex">
        <TitikStatus nada="netral" />
        Gateway tiruan
      </Lencana>
    );
  }

  if (status.tersambung === null) {
    return (
      <Lencana nada="tunggu" className="hidden md:inline-flex">
        <TitikStatus nada="tunggu" hidup />
        WhatsApp belum diperiksa
      </Lencana>
    );
  }

  if (!status.tersambung) {
    return (
      <Lencana nada="gagal" className="hidden md:inline-flex">
        <TitikStatus nada="gagal" hidup />
        WhatsApp terputus
      </Lencana>
    );
  }

  return (
    <Lencana nada="sukses" className="hidden md:inline-flex">
      <TitikStatus nada="sukses" />
      WhatsApp {status.nomor_wa ? tampilkan_nomor(status.nomor_wa) : "tersambung"}
    </Lencana>
  );
}

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
  const ada_database = supabase_siap();

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
          {ada_database ? (
            <StatusWhatsApp />
          ) : (
            <Lencana nada="tunggu" className="hidden md:inline-flex">
              <TitikStatus nada="tunggu" hidup />
              Database belum tersambung
            </Lencana>
          )}
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
