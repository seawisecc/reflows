"use client";

import * as React from "react";
import { Menu } from "lucide-react";

/**
 * Keadaan laci navigasi di layar sempit.
 *
 * Bilah sisi hidup di layout supaya tidak dirender ulang tiap pindah
 * halaman, sedangkan tombol pembukanya duduk di bilah atas milik halaman.
 * Keduanya terpisah di pohon komponen, jadi keadaannya dititipkan di sini.
 */
type IsiLaci = { terbuka: boolean; setTerbuka: (nilai: boolean) => void };

const Konteks = React.createContext<IsiLaci>({
  terbuka: false,
  setTerbuka: () => {},
});

export function PenyediaLaci({ children }: { children: React.ReactNode }) {
  const [terbuka, setTerbuka] = React.useState(false);
  const nilai = React.useMemo(() => ({ terbuka, setTerbuka }), [terbuka]);
  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

/**
 * Namanya berawalan "use" karena React memperlakukan awalan itu sebagai
 * penanda hook, dan aturan lint menolak nama lain. Ini istilah teknis milik
 * React, bukan pilihan bahasa.
 */
export function useLaci() {
  return React.useContext(Konteks);
}

export function TombolLaci() {
  const { setTerbuka } = useLaci();
  return (
    <button
      type="button"
      onClick={() => setTerbuka(true)}
      aria-label="Buka menu"
      className="fokus-pixel tekan bayang-pixel-kecil inline-flex size-9 shrink-0 items-center justify-center border-2 border-garis-tegas bg-permukaan text-teks lg:hidden"
    >
      <Menu className="size-4" />
    </button>
  );
}
