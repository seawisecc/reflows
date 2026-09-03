"use client";

import Link from "next/link";
import { Tombol } from "@/komponen/ui/tombol";
import { HalamanGalat, PanelGalat } from "@/komponen/ui/galat";
import { Logo } from "@/komponen/merek/logo";

/**
 * Layar galat di luar dasbor, misalnya halaman masuk. Tidak ada bilah sisi
 * yang bisa dipertahankan di sini, jadi tampilannya berdiri sendiri.
 */
export default function Galat({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <HalamanGalat>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Logo className="size-10" />
          <span className="pixel-lg uppercase text-teks">Reflows</span>
        </div>
        <PanelGalat
          judul="Ada yang salah"
          keterangan="Halamannya gagal disusun. Coba muat ulang. Kalau tetap begini, kode di bawah yang perlu disebut waktu melapor."
          kode={error.digest}
        >
          <Tombol onClick={reset}>Coba lagi</Tombol>
          <Link href="/masuk">
            <Tombol varian="garis">Ke halaman masuk</Tombol>
          </Link>
        </PanelGalat>
      </div>
    </HalamanGalat>
  );
}
