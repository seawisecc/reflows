"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { hapus_materi, ubah_aktif, ubah_materi } from "./aksi";
import { AreaTeks, Bidang } from "@/komponen/ui/bidang";
import { Lencana } from "@/komponen/ui/lencana";
import { Tombol } from "@/komponen/ui/tombol";
import { rupiah } from "@/lib/utils";
import type { ButirPengetahuan } from "@/tipe";

/**
 * Penyuntingan di tempat.
 *
 * Sebelum ini materi cuma bisa dihapus lalu ditulis ulang lewat impor.
 * Padahal yang paling sering dibutuhkan adalah mengubah satu angka harga,
 * dan menghapus dulu berarti ada jeda di mana AI menjawab tanpa layanan itu.
 */
function Sunting({
  butir,
  selesai,
}: {
  butir: ButirPengetahuan;
  selesai: () => void;
}) {
  const [menunggu, mulai] = React.useTransition();
  const [galat, setGalat] = React.useState<string | null>(null);
  const [judul, setJudul] = React.useState(butir.judul);
  const [isi, setIsi] = React.useState(butir.isi);
  const [harga, setHarga] = React.useState(
    butir.harga === null ? "" : String(butir.harga),
  );

  return (
    <li className="space-y-3 border-l-4 border-l-aksen-tinta bg-[var(--sorot)] px-4 py-3">
      <Bidang
        value={judul}
        onChange={(e) => setJudul(e.target.value)}
        aria-label="Judul"
        maxLength={200}
      />
      <AreaTeks
        value={isi}
        onChange={(e) => setIsi(e.target.value)}
        aria-label="Isi"
        maxLength={4000}
        className="min-h-20"
      />
      {butir.tipe === "layanan" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Bidang
            value={harga}
            onChange={(e) => setHarga(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            placeholder="Harga dalam rupiah, kosongkan kalau belum pasti"
            aria-label="Harga"
            className="max-w-64"
          />
          {harga ? (
            <span className="angka text-xs text-aksen-tinta">
              {rupiah(Number(harga))}
            </span>
          ) : null}
        </div>
      ) : null}
      {galat ? (
        <p role="alert" className="text-xs text-gagal-tinta">
          {galat}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Tombol
          ukuran="kecil"
          disabled={menunggu}
          onClick={() =>
            mulai(async () => {
              const h = await ubah_materi(butir.id, {
                judul,
                isi,
                harga: harga === "" ? null : Number(harga),
              });
              setGalat(h.galat);
              if (!h.galat) selesai();
            })
          }
        >
          {menunggu ? "Menyimpan" : "Simpan"}
        </Tombol>
        <Tombol varian="hantu" ukuran="kecil" disabled={menunggu} onClick={selesai}>
          Batal
        </Tombol>
      </div>
    </li>
  );
}

export function BarisMateri({
  butir,
  bisa_diubah,
}: {
  butir: ButirPengetahuan;
  bisa_diubah: boolean;
}) {
  const [menunggu, mulai] = React.useTransition();
  const [konfirmasi, setKonfirmasi] = React.useState(false);
  const [menyunting, setMenyunting] = React.useState(false);

  if (menyunting) {
    return <Sunting butir={butir} selesai={() => setMenyunting(false)} />;
  }

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

        <span className="flex items-center gap-2">
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
          <>
            <button
              type="button"
              disabled={!bisa_diubah}
              onClick={() => setMenyunting(true)}
              aria-label={`Ubah ${butir.judul}`}
              className="fokus-pixel text-redup hover:text-aksen-tinta disabled:pointer-events-none disabled:opacity-40"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              disabled={!bisa_diubah}
              onClick={() => setKonfirmasi(true)}
              aria-label={`Hapus ${butir.judul}`}
              className="fokus-pixel text-redup hover:text-gagal-tinta disabled:pointer-events-none disabled:opacity-40"
            >
              <Trash2 className="size-4" />
            </button>
          </>
        )}
        </span>
      </div>
    </li>
  );
}
