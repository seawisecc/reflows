"use client";

import * as React from "react";
import { CircleCheck, QrCode, RefreshCw, TriangleAlert } from "lucide-react";
import { ambil_qr } from "./aksi";
import type { HasilQr } from "@/lib/gateway/jenis";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";

/**
 * Panel pemindaian QR.
 *
 * QR-nya tidak diambil otomatis saat halaman dibuka, karena setiap
 * pengambilan memanggil Fonnte. Pemilik yang menekan tombol, dan itu juga
 * lebih jujur: dia tahu persis kapan sambungannya sedang dicoba.
 */
export function PanelQr({ gateway }: { gateway: string }) {
  const [hasil, setHasil] = React.useState<HasilQr | null>(null);
  const [menunggu, mulai] = React.useTransition();

  function muat() {
    mulai(async () => {
      setHasil(await ambil_qr());
    });
  }

  return (
    <Kartu className="xl:col-span-2">
      <KepalaKartu
        judul="Sambungkan nomor WhatsApp"
        keterangan="Pindai QR ini dari WhatsApp di HP: menu Perangkat Tertaut, lalu Tautkan Perangkat. Tidak perlu buka dasbor Fonnte."
        aksi={
          hasil?.keadaan === "tersambung" ? (
            <Lencana nada="sukses">
              <TitikStatus nada="sukses" />
              Tersambung
            </Lencana>
          ) : null
        }
      />
      <IsiKartu className="space-y-4">
        {hasil === null ? (
          <p className="text-xs leading-relaxed text-redup">
            {gateway === "fonnte"
              ? "Simpan token Fonnte dulu di atas, lalu tekan tombol di bawah untuk memunculkan QR."
              : "Penyedia masih diset ke tiruan, jadi QR-nya tidak nyata. Ganti ke Fonnte dulu untuk menyambungkan nomor sungguhan."}
          </p>
        ) : null}

        {hasil?.keadaan === "perlu-scan" ? (
          <div className="space-y-3">
            <div className="inline-block border-2 border-garis-tegas bg-white p-3">
              {/* next/image tidak dipakai di sini: sumbernya data URL yang
                  dibuat gateway, bukan berkas yang bisa dioptimalkan. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hasil.gambar}
                alt="Kode QR untuk menyambungkan WhatsApp"
                width={256}
                height={256}
                className="size-64"
              />
            </div>
            <p className="text-xs leading-relaxed text-redup">
              QR ini kedaluwarsa dalam waktu singkat. Kalau gagal, tekan
              Muat ulang QR untuk minta yang baru.
            </p>
          </div>
        ) : null}

        {hasil?.keadaan === "tersambung" ? (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-sukses-tinta">
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            Nomor sudah tersambung. Pesan yang masuk ke nomor ini akan muncul di
            halaman Percakapan.
          </p>
        ) : null}

        {hasil?.keadaan === "gagal" ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {hasil.alasan}
          </p>
        ) : null}

        <Tombol
          type="button"
          varian="garis"
          onClick={muat}
          disabled={menunggu}
        >
          {hasil?.keadaan === "perlu-scan" ? (
            <RefreshCw className="size-3.5" />
          ) : (
            <QrCode className="size-3.5" />
          )}
          {menunggu
            ? "Menghubungi gateway"
            : hasil?.keadaan === "perlu-scan"
              ? "Muat ulang QR"
              : hasil
                ? "Periksa lagi"
                : "Tampilkan QR"}
        </Tombol>
      </IsiKartu>
    </Kartu>
  );
}
