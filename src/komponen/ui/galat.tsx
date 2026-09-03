import * as React from "react";
import { Kartu } from "./kartu";

/**
 * Tampilan bersama untuk semua layar galat dan halaman tidak ditemukan.
 *
 * Sengaja tidak memakai BilahAtas. Bilah itu membaca status perangkat dari
 * database, sedangkan yang sedang terjadi bisa jadi justru databasenya yang
 * tidak bisa dihubungi. Layar galat yang ikut gagal memuat lebih buruk
 * daripada tidak ada layar galat sama sekali.
 */
export function PanelGalat({
  judul,
  keterangan,
  kode,
  children,
}: {
  judul: string;
  keterangan: string;
  /** Digest galat dari Next.js. Nilainya sama dengan yang tercatat di log
   *  server Vercel, jadi satu-satunya benang yang menghubungkan keluhan
   *  pengguna dengan baris log yang benar. */
  kode?: string;
  children?: React.ReactNode;
}) {
  return (
    <Kartu className="mx-auto w-full max-w-md p-6 text-center">
      <p className="pixel-lg uppercase text-teks">{judul}</p>
      <p className="mt-4 text-xs leading-relaxed text-redup">{keterangan}</p>

      {kode ? (
        <p className="mt-4 border-2 border-garis bg-permukaan-2 px-3 py-2 angka break-all text-xs text-redup">
          {kode}
        </p>
      ) : null}

      {children ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
    </Kartu>
  );
}

/**
 * Bungkus untuk layar galat yang tampil tanpa bilah sisi, misalnya di
 * halaman masuk atau saat alamatnya tidak dikenal sama sekali.
 */
export function HalamanGalat({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">{children}</main>
  );
}
