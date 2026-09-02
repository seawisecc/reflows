"use client";

import * as React from "react";
import { CircleCheck, Plus, Trash2, TriangleAlert, Upload } from "lucide-react";
import { hapus_kontak, impor_kontak, tambah_kontak } from "./aksi";
import { KONTAK_AWAL } from "./keadaan";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";

function Kabar({ galat, pesan }: { galat: string | null; pesan: string | null }) {
  if (galat) {
    return (
      <p role="alert" className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        {galat}
      </p>
    );
  }
  if (pesan) {
    return (
      <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-sukses-tinta">
        <CircleCheck className="mt-0.5 size-4 shrink-0" />
        {pesan}
      </p>
    );
  }
  return null;
}

/** Tambah satu kontak dan impor sekaligus. Keduanya menulis ke tabel sama. */
export function PanelKontak() {
  const [tambah, aksi_tambah, sedang_tambah] = React.useActionState(
    tambah_kontak,
    KONTAK_AWAL,
  );
  const [impor, aksi_impor, sedang_impor] = React.useActionState(
    impor_kontak,
    KONTAK_AWAL,
  );

  const acuan_tambah = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (tambah.pesan) acuan_tambah.current?.reset();
  }, [tambah.pesan]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Kartu>
        <KepalaKartu
          judul="Tambah satu kontak"
          keterangan="Dipakai kalau nomornya kamu dapat dari luar WhatsApp, misalnya dari kartu nama atau telepon masuk."
        />
        <IsiKartu>
          <form ref={acuan_tambah} action={aksi_tambah} className="space-y-4">
            <Kolom label="Nomor WhatsApp" petunjuk="Boleh 08xx, +62, atau 62. Disamakan sendiri.">
              <Bidang name="nomor" placeholder="0812 3456 7890" inputMode="tel" required />
            </Kolom>
            <Kolom label="Nama">
              <Bidang name="nama" placeholder="Bu Ratna | Katering Sari Rasa" />
            </Kolom>
            <Kolom label="Tag" petunjuk="Pisahkan dengan koma. Dipakai menyaring kampanye nanti.">
              <Bidang name="tag" placeholder="prospek, kuliner" />
            </Kolom>
            <Tombol type="submit" disabled={sedang_tambah}>
              <Plus className="size-3.5" />
              {sedang_tambah ? "Menyimpan" : "Tambah kontak"}
            </Tombol>
            <Kabar galat={tambah.galat} pesan={tambah.pesan} />
          </form>
        </IsiKartu>
      </Kartu>

      <Kartu>
        <KepalaKartu
          judul="Impor dari CSV atau Excel"
          keterangan="Kolom dicari dari judulnya, bukan dari urutannya, jadi susunan spreadsheet kamu tidak perlu diubah."
        />
        <IsiKartu>
          <form action={aksi_impor} className="space-y-4">
            <Kolom
              label="Berkas daftar kontak"
              petunjuk='Butuh satu kolom berjudul "nomor" atau "telepon". Kolom "nama" dan "tag" ikut terbaca kalau ada. Maksimal 5 MB, 2000 baris.'
            >
              <Bidang
                type="file"
                name="berkas"
                accept=".csv,.txt,.xlsx,.xlsm"
                className="file:mr-3 file:border-0 file:bg-transparent file:text-xs file:text-redup"
              />
            </Kolom>
            <Tombol type="submit" varian="garis" disabled={sedang_impor}>
              <Upload className="size-3.5" />
              {sedang_impor ? "Membaca berkas" : "Impor kontak"}
            </Tombol>
            <Kabar galat={impor.galat} pesan={impor.pesan} />
            <p className="text-xs leading-relaxed text-redup">
              Nomor yang sudah ada dilewati, tidak ditimpa. Impor berkas yang
              sama dua kali aman, tidak akan menggandakan kontak.
            </p>
          </form>
        </IsiKartu>
      </Kartu>
    </div>
  );
}

export function TombolHapusKontak({ id, nama }: { id: string; nama: string }) {
  const [menunggu, mulai] = React.useTransition();
  const [konfirmasi, setKonfirmasi] = React.useState(false);
  const [galat, setGalat] = React.useState<string | null>(null);

  if (konfirmasi) {
    return (
      <span className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          disabled={menunggu}
          onClick={() =>
            mulai(async () => {
              const h = await hapus_kontak(id);
              setGalat(h.galat);
              if (!h.galat) setKonfirmasi(false);
            })
          }
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
        {galat ? <span className="sr-only">{galat}</span> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setKonfirmasi(true)}
      aria-label={`Hapus ${nama}`}
      className="fokus-pixel text-redup hover:text-gagal-tinta"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
