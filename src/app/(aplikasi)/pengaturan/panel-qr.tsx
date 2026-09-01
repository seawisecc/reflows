"use client";

import * as React from "react";
import {
  CircleCheck,
  QrCode,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { ambil_qr, periksa_perangkat, type HasilPeriksaPerangkat } from "./aksi";
import type { HasilQr } from "@/lib/gateway/jenis";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { tampilkan_nomor } from "@/lib/gateway/nomor";
import { waktu_relatif } from "@/lib/utils";
import type { Pengaturan } from "@/lib/data/pengaturan";

/**
 * Panel sambungan WhatsApp.
 *
 * Status yang tersimpan ditampilkan lebih dulu, jadi begitu halaman dibuka
 * pemilik sudah tahu nomornya hidup atau tidak tanpa menekan apa pun. Tombol
 * cuma dipakai menyegarkan, karena tiap pemeriksaan memanggil gateway.
 */
export function PanelQr({ awal }: { awal: Pengaturan }) {
  const [qr, setQr] = React.useState<HasilQr | null>(null);
  const [periksa, setPeriksa] = React.useState<HasilPeriksaPerangkat | null>(null);
  const [menunggu, mulai] = React.useTransition();

  const tiruan = awal.gateway !== "fonnte";
  // Hasil pemeriksaan barusan menang atas status tersimpan.
  const tersambung =
    periksa?.ok === true ? periksa.profil.tersambung : awal.perangkat.tersambung;
  const nomor =
    periksa?.ok === true ? periksa.profil.nomor : awal.nomor_wa;
  const nama = periksa?.ok === true ? periksa.profil.nama : awal.perangkat.nama;
  const paket = periksa?.ok === true ? periksa.profil.paket : awal.perangkat.paket;
  const kuota = periksa?.ok === true ? periksa.profil.kuota : awal.perangkat.kuota;
  const kedaluwarsa =
    periksa?.ok === true ? periksa.profil.kedaluwarsa : awal.perangkat.kedaluwarsa;

  function segarkan() {
    mulai(async () => {
      setQr(null);
      setPeriksa(await periksa_perangkat());
    });
  }

  function tampilkan_qr() {
    mulai(async () => {
      setQr(await ambil_qr());
    });
  }

  const lencana = tiruan ? (
    <Lencana nada="netral">
      <TitikStatus nada="netral" />
      Gateway tiruan
    </Lencana>
  ) : tersambung === null ? (
    <Lencana nada="tunggu">
      <TitikStatus nada="tunggu" hidup />
      Belum diperiksa
    </Lencana>
  ) : tersambung ? (
    <Lencana nada="sukses">
      <TitikStatus nada="sukses" />
      Tersambung
    </Lencana>
  ) : (
    <Lencana nada="gagal">
      <TitikStatus nada="gagal" hidup />
      Terputus
    </Lencana>
  );

  return (
    <Kartu>
      <KepalaKartu
        judul="Sambungan WhatsApp"
        keterangan={
          tiruan
            ? "Penyedia masih diset ke tiruan. Ganti ke Fonnte di atas untuk menyambungkan nomor sungguhan."
            : "Pindai QR dari WhatsApp di HP: menu Perangkat Tertaut, lalu Tautkan Perangkat. Tidak perlu buka dasbor Fonnte."
        }
        aksi={lencana}
      />

      {!tiruan && tersambung ? (
        <dl className="grid gap-x-6 gap-y-3 border-b-2 border-garis px-4 py-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-redup">Nomor tersambung</dt>
            <dd className="angka text-xs text-teks">
              {nomor ? tampilkan_nomor(nomor) : "belum diketahui"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-redup">Nama perangkat</dt>
            <dd className="text-xs text-teks">{nama ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-redup">Paket Fonnte</dt>
            <dd className="text-xs text-teks">{paket ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-redup">Sisa kuota</dt>
            <dd className="angka text-xs text-teks">
              {kuota === null ? "-" : kuota.toLocaleString("id-ID")}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-redup">Berlaku sampai</dt>
            <dd className="text-xs text-teks">{kedaluwarsa ?? "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-xs text-redup">Diperiksa</dt>
            <dd className="text-xs text-redup">
              {awal.perangkat.diperiksa_at
                ? waktu_relatif(awal.perangkat.diperiksa_at)
                : "belum pernah"}
            </dd>
          </div>
        </dl>
      ) : null}

      <IsiKartu className="space-y-4">
        {periksa?.ok === true && periksa.nomor_diselaraskan ? (
          <p
            role="status"
            className="flex items-start gap-2 text-xs leading-relaxed text-sukses-tinta"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            Nomor pengirim diselaraskan dengan nomor yang benar-benar
            tersambung di gateway. Kalau keduanya berbeda, pesan masuk ditolak
            diam-diam karena dianggap bukan untuk kamu.
          </p>
        ) : null}

        {periksa?.ok === false ? (
          <p role="alert" className="flex items-start gap-2 text-xs text-gagal-tinta">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {periksa.alasan}
          </p>
        ) : null}

        {!tiruan && tersambung === false ? (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            Nomor sedang terputus. Selama begini, tidak ada pesan client yang
            masuk maupun keluar. Tekan Tampilkan QR lalu pindai ulang.
          </p>
        ) : null}

        {qr?.keadaan === "perlu-scan" ? (
          <div className="space-y-3">
            <div className="inline-block border-2 border-garis-tegas bg-white p-3">
              {/* next/image tidak dipakai di sini: sumbernya data URL yang
                  dibuat gateway, bukan berkas yang bisa dioptimalkan. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr.gambar}
                alt="Kode QR untuk menyambungkan WhatsApp"
                width={256}
                height={256}
                className="size-64"
              />
            </div>
            <p className="text-xs leading-relaxed text-redup">
              QR ini kedaluwarsa dalam waktu singkat. Setelah dipindai, tekan
              Periksa status untuk memastikan sambungannya benar-benar jadi.
            </p>
          </div>
        ) : null}

        {qr?.keadaan === "gagal" ? (
          <p role="alert" className="flex items-start gap-2 text-xs text-gagal-tinta">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {qr.alasan}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Tombol type="button" onClick={segarkan} disabled={menunggu}>
            <RefreshCw className="size-3.5" />
            {menunggu ? "Menghubungi gateway" : "Periksa status"}
          </Tombol>

          {!tiruan && !tersambung ? (
            <Tombol
              type="button"
              varian="garis"
              onClick={tampilkan_qr}
              disabled={menunggu}
            >
              <QrCode className="size-3.5" />
              {qr?.keadaan === "perlu-scan" ? "Muat ulang QR" : "Tampilkan QR"}
            </Tombol>
          ) : null}

          {!tiruan && tersambung ? (
            <Tombol
              type="button"
              varian="hantu"
              onClick={tampilkan_qr}
              disabled={menunggu}
            >
              <Smartphone className="size-3.5" />
              Sambungkan nomor lain
            </Tombol>
          ) : null}
        </div>
      </IsiKartu>
    </Kartu>
  );
}
