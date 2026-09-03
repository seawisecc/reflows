import Link from "next/link";
import { Tombol } from "@/komponen/ui/tombol";
import { PanelGalat } from "@/komponen/ui/galat";

/**
 * Dipanggil notFound() dari halaman kampanye dan invoice saat id-nya tidak
 * ada, biasanya karena tautan lama atau barangnya sudah dihapus. Bilah sisi
 * tetap terpasang, jadi ini terasa seperti salah belok, bukan seperti
 * aplikasinya rusak.
 */
export default function TidakDitemukanAplikasi() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <PanelGalat
        judul="Tidak ditemukan"
        keterangan="Barang yang kamu buka sudah tidak ada. Mungkin sudah dihapus, atau tautannya milik bisnis lain."
      >
        <Link href="/dasbor">
          <Tombol>Ke dasbor</Tombol>
        </Link>
        <Link href="/percakapan">
          <Tombol varian="garis">Buka inbox</Tombol>
        </Link>
      </PanelGalat>
    </main>
  );
}
