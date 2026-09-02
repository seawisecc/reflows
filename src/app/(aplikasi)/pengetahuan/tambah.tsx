"use client";

import * as React from "react";
import { CircleCheck, Plus, TriangleAlert } from "lucide-react";
import { tambah_materi } from "./aksi";
import { TAMBAH_AWAL } from "./keadaan";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { AreaTeks, Bidang, Kolom, Pilih } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import type { TipePengetahuan } from "@/tipe";

const PILIHAN: { nilai: TipePengetahuan; label: string; petunjuk: string }[] = [
  {
    nilai: "layanan",
    label: "Layanan dan harga",
    petunjuk: "Satu-satunya sumber angka yang boleh disebut AI ke client.",
  },
  {
    nilai: "faq",
    label: "Pertanyaan sering masuk",
    petunjuk: "Judulnya pertanyaannya, isinya jawabannya.",
  },
  {
    nilai: "dokumen",
    label: "Keterangan dari materi",
    petunjuk:
      "Syarat pembayaran, jumlah revisi, garansi, alur kerja, jangkauan wilayah. Yang tidak berbentuk layanan maupun pertanyaan.",
  },
  {
    nilai: "gaya",
    label: "Gaya bahasa",
    petunjuk: "Menentukan nada balasan. Judulnya bebas, yang dibaca AI isinya.",
  },
  {
    nilai: "catatan",
    label: "Pagar pembatas",
    petunjuk: "Hal yang tidak boleh dijanjikan AI dalam kondisi apa pun.",
  },
];

export function TambahMateri() {
  const [keadaan, aksi, menunggu] = React.useActionState(
    tambah_materi,
    TAMBAH_AWAL,
  );
  const [tipe, setTipe] = React.useState<TipePengetahuan>("layanan");
  const acuan = React.useRef<HTMLFormElement>(null);
  const [buka, setBuka] = React.useState(false);

  React.useEffect(() => {
    if (keadaan.pesan) acuan.current?.reset();
  }, [keadaan.pesan]);

  const terpilih = PILIHAN.find((p) => p.nilai === tipe);

  if (!buka) {
    return (
      <Kartu className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-redup">
            Satu harga berubah, atau ada pertanyaan baru yang sering masuk?
            Tidak perlu mengunggah dokumen lagi.
          </p>
          <Tombol ukuran="kecil" onClick={() => setBuka(true)}>
            <Plus className="size-3.5" />
            Tulis materi sendiri
          </Tombol>
        </div>
      </Kartu>
    );
  }

  return (
    <Kartu>
      <KepalaKartu
        judul="Tulis materi sendiri"
        keterangan="Masuk ke instruksi AI persis seperti materi hasil impor."
        aksi={
          <Tombol varian="hantu" ukuran="kecil" onClick={() => setBuka(false)}>
            Tutup
          </Tombol>
        }
      />
      <IsiKartu>
        <form ref={acuan} action={aksi} className="space-y-4">
          <Kolom label="Jenis materi" petunjuk={terpilih?.petunjuk}>
            <Pilih
              name="tipe"
              value={tipe}
              onChange={(e) => setTipe(e.target.value as TipePengetahuan)}
            >
              {PILIHAN.map((p) => (
                <option key={p.nilai} value={p.nilai}>
                  {p.label}
                </option>
              ))}
            </Pilih>
          </Kolom>

          <Kolom
            label={tipe === "faq" ? "Pertanyaannya" : "Judul"}
            petunjuk={
              tipe === "faq"
                ? "Tulis seperti cara client bertanya, bukan seperti judul brosur."
                : undefined
            }
          >
            <Bidang
              name="judul"
              required
              maxLength={200}
              placeholder={
                tipe === "faq"
                  ? "Berapa lama pengerjaannya?"
                  : tipe === "layanan"
                    ? "Website Company Profile"
                    : "Syarat pembayaran"
              }
            />
          </Kolom>

          <Kolom label={tipe === "faq" ? "Jawabannya" : "Isi"}>
            <AreaTeks
              name="isi"
              required
              maxLength={4000}
              className="min-h-24"
              placeholder={
                tipe === "layanan"
                  ? "5 halaman, domain setahun, hosting setahun, pengerjaan 10 sampai 14 hari"
                  : "Tulis apa adanya, seperti catatan internal"
              }
            />
          </Kolom>

          {tipe === "layanan" ? (
            <Kolom
              label="Harga"
              petunjuk="Kosongkan kalau belum pasti. AI akan menyerahkan ke kamu setiap kali harganya ditanya."
            >
              <Bidang
                name="harga"
                inputMode="numeric"
                placeholder="4500000"
                className="max-w-64"
              />
            </Kolom>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Tombol type="submit" disabled={menunggu}>
              <Plus className="size-3.5" />
              {menunggu ? "Menyimpan" : "Simpan materi"}
            </Tombol>
            {keadaan.galat ? (
              <p role="alert" className="flex items-center gap-2 text-xs text-gagal-tinta">
                <TriangleAlert className="size-3.5 shrink-0" />
                {keadaan.galat}
              </p>
            ) : keadaan.pesan ? (
              <p role="status" className="flex items-center gap-2 text-xs text-sukses-tinta">
                <CircleCheck className="size-3.5 shrink-0" />
                {keadaan.pesan}
              </p>
            ) : null}
          </div>
        </form>
      </IsiKartu>
    </Kartu>
  );
}
