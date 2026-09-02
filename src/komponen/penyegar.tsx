"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/**
 * Menarik ulang data server secara berkala.
 *
 * Pesan client datang lewat webhook, bukan lewat aksi pengguna, jadi tanpa
 * ini satu-satunya cara melihat chat baru adalah menekan muat ulang. Yang
 * dipanggil router.refresh(), yang cuma menyusun ulang Server Component:
 * keadaan di browser, misalnya percakapan yang sedang dibuka dan isi kotak
 * ketik, tidak ikut hilang.
 *
 * Dua penjaga supaya tidak membakar kuota fungsi Vercel percuma:
 * tab yang tidak terlihat berhenti menyegar, dan begitu tab dilihat lagi
 * penyegaran langsung jalan sekali sebelum kembali ke jadwal.
 */
export function Penyegar({ jeda_detik = 15 }: { jeda_detik?: number }) {
  const router = useRouter();

  React.useEffect(() => {
    let jam: ReturnType<typeof setInterval> | null = null;

    function mulai() {
      if (jam !== null) return;
      jam = setInterval(() => router.refresh(), jeda_detik * 1000);
    }

    function berhenti() {
      if (jam === null) return;
      clearInterval(jam);
      jam = null;
    }

    function saat_terlihat() {
      if (document.visibilityState !== "visible") {
        berhenti();
        return;
      }
      // Halaman baru saja disusun server, jadi saat pertama kali dipasang
      // tidak ada yang perlu ditarik ulang. Yang menyegar seketika cuma
      // kepulangan dari tab lain, karena selama itu bisa ada chat masuk.
      router.refresh();
      mulai();
    }

    if (document.visibilityState === "visible") mulai();
    document.addEventListener("visibilitychange", saat_terlihat);
    return () => {
      berhenti();
      document.removeEventListener("visibilitychange", saat_terlihat);
    };
  }, [router, jeda_detik]);

  return null;
}
