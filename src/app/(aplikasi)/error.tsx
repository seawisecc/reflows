"use client";

import Link from "next/link";
import { Tombol } from "@/komponen/ui/tombol";
import { PanelGalat } from "@/komponen/ui/galat";

/**
 * Layar galat untuk seluruh halaman dasbor.
 *
 * Ditaruh di dalam grup (aplikasi), bukan di akar, supaya bilah sisi tetap
 * terpasang saat satu halaman gagal. Layout di atas batas galat tidak ikut
 * dirender ulang, jadi pengguna masih bisa pindah ke menu lain tanpa harus
 * mengetik alamat dari awal.
 */
export default function GalatAplikasi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <PanelGalat
        judul="Halaman ini gagal dimuat"
        keterangan="Isinya tidak sempat tersusun. Data kamu tidak ada yang hilang: pesan yang masuk tetap tercatat, dan tidak ada yang terkirim gara-gara ini. Coba muat ulang dulu."
        kode={error.digest}
      >
        <Tombol onClick={reset}>Coba lagi</Tombol>
        <Link href="/dasbor">
          <Tombol varian="garis">Ke dasbor</Tombol>
        </Link>
      </PanelGalat>
    </main>
  );
}
