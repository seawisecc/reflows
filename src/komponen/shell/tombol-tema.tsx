"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import {
  KUNCI_TEMA,
  LABEL_TEMA,
  TEMA_BAWAAN,
  tema_valid,
  type Tema,
} from "@/lib/tema";

const PERISTIWA_TEMA = "reflows:tema";

/**
 * Sumber kebenaran tema adalah atribut data-tema di elemen html, karena
 * skrip di <head> sudah memasangnya sebelum React jalan. Komponen ini
 * membaca DOM lewat useSyncExternalStore, bukan menyalinnya ke state di
 * dalam efek, supaya tidak ada render bertingkat dan tidak ada kedipan.
 */
function berlangganan(dengar: () => void) {
  window.addEventListener(PERISTIWA_TEMA, dengar);
  return () => window.removeEventListener(PERISTIWA_TEMA, dengar);
}

function baca_klien(): Tema {
  const nilai = document.documentElement.getAttribute("data-tema");
  return tema_valid(nilai) ? nilai : TEMA_BAWAAN;
}

function baca_server(): Tema {
  return TEMA_BAWAAN;
}

export function TombolTema() {
  const tema = React.useSyncExternalStore(
    berlangganan,
    baca_klien,
    baca_server,
  );

  function ganti() {
    const berikut: Tema = tema === "deep-reef" ? "sunset-arcade" : "deep-reef";
    document.documentElement.setAttribute("data-tema", berikut);
    try {
      localStorage.setItem(KUNCI_TEMA, berikut);
    } catch {
      // Mode penyamaran atau penyimpanan diblokir. Tema tetap berganti,
      // hanya saja tidak diingat sampai muat berikutnya.
    }
    window.dispatchEvent(new Event(PERISTIWA_TEMA));
  }

  const gelap = tema === "deep-reef";
  const lawan: Tema = gelap ? "sunset-arcade" : "deep-reef";

  return (
    <button
      type="button"
      onClick={ganti}
      title={`Tema ${LABEL_TEMA[tema]}, klik untuk ganti`}
      aria-label={`Ganti ke tema ${LABEL_TEMA[lawan]}`}
      className="pixel-sm fokus-pixel tekan bayang-pixel-kecil inline-flex h-9 items-center gap-2 border-2 border-garis-tegas bg-permukaan px-3 uppercase text-teks"
    >
      {gelap ? (
        <Moon className="size-3.5 text-aksen-tinta" />
      ) : (
        <Sun className="size-3.5 text-aksen-tinta" />
      )}
      <span className="hidden sm:inline">{LABEL_TEMA[tema]}</span>
    </button>
  );
}
