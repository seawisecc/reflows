import Link from "next/link";
import { Tombol } from "@/komponen/ui/tombol";
import { HalamanGalat, PanelGalat } from "@/komponen/ui/galat";
import { Logo } from "@/komponen/merek/logo";

export const metadata = { title: "Tidak ditemukan | Reflows" };

/**
 * Alamat yang tidak dikenal sama sekali. Tanpa berkas ini yang muncul
 * halaman bawaan Next.js: latar putih, font sistem, tulisan Inggris, dan
 * tidak ada tautan ke mana pun.
 */
export default function TidakDitemukan() {
  return (
    <HalamanGalat>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-3">
          <Logo className="size-10" />
          <span className="pixel-lg uppercase text-teks">Reflows</span>
        </div>
        <PanelGalat
          judul="Halaman tidak ada"
          keterangan="Alamat yang kamu buka tidak dikenal. Mungkin salah ketik, atau tautannya sudah lama."
        >
          <Link href="/dasbor">
            <Tombol>Ke dasbor</Tombol>
          </Link>
        </PanelGalat>
      </div>
    </HalamanGalat>
  );
}
