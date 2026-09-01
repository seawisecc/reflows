"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { hapus_materi, ubah_aktif } from "./aksi";
import { Lencana } from "@/komponen/ui/lencana";
import { rupiah } from "@/lib/utils";
import type { ButirPengetahuan } from "@/tipe";

export function BarisMateri({
  butir,
  bisa_diubah,
}: {
  butir: ButirPengetahuan;
  bisa_diubah: boolean;
}) {
  const [menunggu, mulai] = React.useTransition();
  const [konfirmasi, setKonfirmasi] = React.useState(false);

  return (
    <li className="flex gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm text-teks">{butir.judul}</h3>
          {butir.harga !== null ? (
            <span className="angka text-sm font-bold text-aksen-tinta">
              {rupiah(butir.harga)}
            </span>
          ) : butir.tipe === "layanan" ? (
            <Lencana nada="tunggu">Harga kosong</Lencana>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-redup">{butir.isi}</p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <button
          type="button"
          disabled={!bisa_diubah || menunggu}
          onClick={() => mulai(async () => void (await ubah_aktif(butir.id, !butir.aktif)))}
          className="fokus-pixel disabled:pointer-events-none disabled:opacity-40"
          aria-label={butir.aktif ? "Nonaktifkan" : "Aktifkan"}
        >
          <Lencana nada={butir.aktif ? "sukses" : "netral"}>
            {butir.aktif ? "Aktif" : "Nonaktif"}
          </Lencana>
        </button>

        {konfirmasi ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={menunggu}
              onClick={() => mulai(async () => void (await hapus_materi(butir.id)))}
              className="pixel-sm fokus-pixel border-2 border-gagal-tinta px-1.5 py-1 uppercase text-gagal-tinta"
            >
              {menunggu ? "..." : "Hapus"}
            </button>
            <button
              type="button"
              onClick={() => setKonfirmasi(false)}
              className="pixel-sm fokus-pixel border-2 border-garis px-1.5 py-1 uppercase text-redup"
            >
              Batal
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={!bisa_diubah}
            onClick={() => setKonfirmasi(true)}
            aria-label={`Hapus ${butir.judul}`}
            className="fokus-pixel text-redup hover:text-gagal-tinta disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}
