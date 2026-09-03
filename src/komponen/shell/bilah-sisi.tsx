"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { keluar } from "@/app/masuk/aksi";
import { Logo } from "@/komponen/merek/logo";
import { NAVIGASI } from "./navigasi";
import { useLaci } from "./laci";
import { cn } from "@/lib/utils";

function Merek({ nama_bisnis }: { nama_bisnis: string }) {
  return (
    <Link
      href="/dasbor"
      className="fokus-pixel flex items-center gap-3 border-b-2 border-garis px-4 py-4"
    >
      <Logo className="size-10" />
      <span className="min-w-0">
        <span className="pixel-lg block uppercase text-teks">
          Reflows
        </span>
        <span className="mt-1.5 block truncate text-xs text-redup">
          {nama_bisnis}
        </span>
      </span>
    </Link>
  );
}

function DaftarNav({ onPilih }: { onPilih?: () => void }) {
  const jalur = usePathname();

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAVIGASI.map((grup) => (
        <div key={grup.judul}>
          <p className="pixel-sm px-2 pb-2 uppercase text-redup/70">
            {grup.judul}
          </p>
          <ul className="space-y-1">
            {grup.item.map((item) => {
              const aktif =
                jalur === item.href || jalur.startsWith(`${item.href}/`);
              const Ikon = item.ikon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onPilih}
                    aria-current={aktif ? "page" : undefined}
                    className={cn(
                      "fokus-pixel group flex items-center gap-3 border-2 px-2.5 py-2 text-xs transition-colors",
                      aktif
                        ? "border-aksen-tinta bg-[var(--sorot)] text-teks"
                        : "border-transparent text-redup hover:border-garis hover:bg-permukaan-2 hover:text-teks",
                    )}
                  >
                    <Ikon
                      className={cn(
                        "size-4 shrink-0",
                        aktif ? "text-aksen-tinta" : "text-redup group-hover:text-teks",
                      )}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.nanti ? (
                      <span className="pixel-sm shrink-0 border-2 border-garis px-1.5 py-0.5 uppercase text-redup">
                        {item.nanti}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function KakiSisi({
  nama_pengguna,
  email,
}: {
  nama_pengguna: string | null;
  email: string | null;
}) {
  if (!nama_pengguna) {
    return (
      <div className="border-t-2 border-garis px-4 py-3">
        <p className="pixel-sm uppercase text-redup">Mode contoh</p>
        <p className="mt-1.5 text-xs leading-relaxed text-redup">
          Database belum tersambung, yang tampil data contoh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t-2 border-garis px-3 py-3">
      <div className="px-1">
        <p className="truncate text-xs text-teks">{nama_pengguna}</p>
        {email ? (
          <p className="mt-1 truncate text-xs text-redup">{email}</p>
        ) : null}
      </div>
      <form action={keluar}>
        <button
          type="submit"
          className="fokus-pixel flex w-full items-center gap-2.5 border-2 border-transparent px-2.5 py-2 text-xs text-redup hover:border-garis hover:bg-permukaan-2 hover:text-teks"
        >
          <LogOut className="size-4 shrink-0" />
          Keluar
        </button>
      </form>
    </div>
  );
}

export function BilahSisi({
  nama_bisnis,
  nama_pengguna,
  email,
}: {
  nama_bisnis: string;
  nama_pengguna: string | null;
  email: string | null;
}) {
  // Laci ditutup lewat onPilih di setiap tautan, bukan lewat efek yang
  // mengamati perubahan jalur. Hasilnya sama tapi tanpa render bertingkat.
  //
  // Keadaannya datang dari konteks, bukan dari useState di sini, karena
  // tombol pembukanya ada di bilah atas milik halaman. Bilah sisi sendiri
  // dirender di layout supaya tetap terpasang saat pindah halaman: itu yang
  // membuat navigasi tidak lagi menunggu profil pengguna dibaca ulang.
  const { terbuka, setTerbuka } = useLaci();

  return (
    <>
      {/* Sisi tetap di layar lebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r-2 border-garis bg-permukaan lg:flex">
        <Merek nama_bisnis={nama_bisnis} />
        <DaftarNav />
        <KakiSisi nama_pengguna={nama_pengguna} email={email} />
      </aside>

      {terbuka ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setTerbuka(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col border-r-2 border-garis-tegas bg-permukaan">
            <div className="flex items-center justify-between border-b-2 border-garis pr-2">
              <div className="flex-1">
                <Merek nama_bisnis={nama_bisnis} />
              </div>
              <button
                type="button"
                onClick={() => setTerbuka(false)}
                aria-label="Tutup menu"
                className="fokus-pixel size-8 shrink-0 text-redup hover:text-teks"
              >
                <X className="mx-auto size-4" />
              </button>
            </div>
            <DaftarNav onPilih={() => setTerbuka(false)} />
            <KakiSisi nama_pengguna={nama_pengguna} email={email} />
          </div>
        </div>
      ) : null}
    </>
  );
}
