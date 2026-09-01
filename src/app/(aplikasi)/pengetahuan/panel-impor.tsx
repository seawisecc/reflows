"use client";

import * as React from "react";
import {
  CircleCheck,
  FileUp,
  Globe,
  Sparkles,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { impor_materi, simpan_materi } from "./aksi";
import {
  IMPOR_AWAL,
  SIMPAN_AWAL,
  type KeadaanImpor,
} from "./keadaan";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { AreaTeks, Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";
import { rupiah } from "@/lib/utils";
import type { TipePengetahuan } from "@/tipe";

type Draf = {
  kunci: string;
  tipe: TipePengetahuan;
  judul: string;
  isi: string;
  harga: number | null;
  dipilih: boolean;
};

function ke_draf(hasil: NonNullable<KeadaanImpor["hasil"]>): Draf[] {
  return [
    ...hasil.layanan.map((l, i) => ({
      kunci: `layanan-${i}`,
      tipe: "layanan" as const,
      judul: l.judul,
      isi: l.isi,
      harga: l.harga,
      dipilih: true,
    })),
    ...hasil.faq.map((f, i) => ({
      kunci: `faq-${i}`,
      tipe: "faq" as const,
      judul: f.judul,
      isi: f.isi,
      harga: null,
      dipilih: true,
    })),
    ...hasil.catatan.map((c, i) => ({
      kunci: `catatan-${i}`,
      tipe: "catatan" as const,
      judul: c.slice(0, 60),
      isi: c,
      harga: null,
      dipilih: true,
    })),
  ];
}

const LABEL_TIPE: Record<TipePengetahuan, string> = {
  layanan: "Layanan",
  faq: "FAQ",
  gaya: "Gaya bahasa",
  catatan: "Catatan",
};

export function PanelImpor() {
  const [impor, aksi_impor, sedang_impor] = React.useActionState(
    impor_materi,
    IMPOR_AWAL,
  );
  const [simpan, aksi_simpan, sedang_simpan] = React.useActionState(
    simpan_materi,
    SIMPAN_AWAL,
  );
  const [draf, setDraf] = React.useState<Draf[]>([]);
  const [mode, setMode] = React.useState<"berkas" | "web">("berkas");

  // Daftar tinjauan disetel ulang saat ada hasil bacaan baru, dan dikosongkan
  // setelah tersimpan. Penyesuaiannya dilakukan saat render dengan menyimpan
  // nilai sebelumnya, bukan lewat efek, supaya tidak ada render bertingkat
  // dan daftar tidak sempat tampil dengan isi yang basi.
  const [hasil_terakhir, setHasilTerakhir] = React.useState(impor.hasil);
  if (impor.hasil !== hasil_terakhir) {
    setHasilTerakhir(impor.hasil);
    setDraf(impor.hasil ? ke_draf(impor.hasil) : []);
  }

  const [pesan_terakhir, setPesanTerakhir] = React.useState(simpan.pesan);
  if (simpan.pesan !== pesan_terakhir) {
    setPesanTerakhir(simpan.pesan);
    if (simpan.pesan) setDraf([]);
  }

  const terpilih = draf.filter((d) => d.dipilih);
  const tanpa_harga = terpilih.filter(
    (d) => d.tipe === "layanan" && d.harga === null,
  ).length;

  function ubah(kunci: string, ubahan: Partial<Draf>) {
    setDraf((lama) =>
      lama.map((d) => (d.kunci === kunci ? { ...d, ...ubahan } : d)),
    );
  }

  return (
    <div className="space-y-6">
      <Kartu>
        <KepalaKartu
          judul="Impor materi"
          keterangan="Unggah penawaran atau daftar harga, atau tempel alamat halaman layanan di situsmu. Claude membacanya sekali, lalu kamu yang menyetujui hasilnya."
        />
        <IsiKartu className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { kunci: "berkas", label: "Dari berkas", ikon: FileUp },
                { kunci: "web", label: "Dari halaman web", ikon: Globe },
              ] as const
            ).map((m) => {
              const Ikon = m.ikon;
              return (
                <button
                  key={m.kunci}
                  type="button"
                  onClick={() => setMode(m.kunci)}
                  aria-pressed={mode === m.kunci}
                  className={
                    mode === m.kunci
                      ? "pixel-sm fokus-pixel inline-flex items-center gap-2 border-2 border-aksen-tinta bg-[var(--sorot)] px-2.5 py-2 uppercase text-teks"
                      : "pixel-sm fokus-pixel inline-flex items-center gap-2 border-2 border-garis px-2.5 py-2 uppercase text-redup hover:border-garis-tegas hover:text-teks"
                  }
                >
                  <Ikon className="size-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>

          <form action={aksi_impor} className="space-y-4">
            {mode === "berkas" ? (
              <Kolom
                label="Berkas materi"
                petunjuk="PDF, CSV, XLSX, atau TXT. Maksimal 10 MB. Daftar harga dalam bentuk tabel paling akurat terbaca."
              >
                <Bidang
                  type="file"
                  name="berkas"
                  accept=".pdf,.csv,.xlsx,.xlsm,.txt"
                  className="file:mr-3 file:border-0 file:bg-transparent file:text-xs file:text-redup"
                />
              </Kolom>
            ) : (
              <Kolom
                label="Alamat halaman"
                petunjuk="Halaman layanan atau harga di situs bisnismu. Halaman yang isinya dibangun JavaScript sering terbaca kosong, untuk itu lebih baik disimpan jadi PDF."
              >
                <Bidang
                  name="url"
                  type="url"
                  placeholder="https://bisniskamu.com/layanan"
                  inputMode="url"
                />
              </Kolom>
            )}

            <Tombol type="submit" disabled={sedang_impor}>
              <Sparkles className="size-3.5" />
              {sedang_impor ? "Sedang dibaca" : "Baca materinya"}
            </Tombol>
          </form>

          {impor.galat ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              {impor.galat}
            </p>
          ) : null}
        </IsiKartu>
      </Kartu>

      {draf.length > 0 ? (
        <Kartu>
          <KepalaKartu
            judul="Tinjau sebelum disimpan"
            keterangan={
              impor.label
                ? `Hasil bacaan dari ${impor.label}. Periksa angkanya, ini yang nanti disebut AI ke calon client.`
                : "Periksa dulu sebelum disimpan."
            }
            aksi={
              <Lencana nada={terpilih.length ? "aksen" : "netral"}>
                {terpilih.length} dari {draf.length} dipilih
              </Lencana>
            }
          />

          {impor.hasil?.keraguan?.length ? (
            <div className="flex items-start gap-2.5 border-b-2 border-garis bg-permukaan-2 px-4 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-tunggu-tinta" />
              <div className="text-xs leading-relaxed text-redup">
                <p className="pixel-sm uppercase text-tunggu-tinta">
                  Claude ragu di bagian ini
                </p>
                <ul className="mt-1.5 list-inside list-disc space-y-1">
                  {impor.hasil.keraguan.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {tanpa_harga > 0 ? (
            <p className="border-b-2 border-garis px-4 py-3 text-xs leading-relaxed text-redup">
              {tanpa_harga} layanan belum punya harga karena tidak tertulis
              jelas di sumber. Isi sendiri sekarang, atau biarkan kosong dan AI
              akan mengeskalasi ke kamu setiap kali harganya ditanyakan.
            </p>
          ) : null}

          <ul className="divide-y-2 divide-[var(--garis)]">
            {draf.map((d) => (
              <li key={d.kunci} className="space-y-3 px-4 py-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={d.dipilih}
                    onChange={(e) => ubah(d.kunci, { dipilih: e.target.checked })}
                    aria-label={`Sertakan ${d.judul}`}
                    className="fokus-pixel mt-1 size-4 shrink-0 accent-[var(--aksen-tinta)]"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Lencana nada={d.tipe === "layanan" ? "sekunder" : "netral"}>
                        {LABEL_TIPE[d.tipe]}
                      </Lencana>
                      {d.tipe === "layanan" && d.harga === null ? (
                        <Lencana nada="tunggu">Harga kosong</Lencana>
                      ) : null}
                    </div>
                    <Bidang
                      value={d.judul}
                      onChange={(e) => ubah(d.kunci, { judul: e.target.value })}
                      aria-label="Judul"
                      disabled={!d.dipilih}
                    />
                    <AreaTeks
                      value={d.isi}
                      onChange={(e) => ubah(d.kunci, { isi: e.target.value })}
                      aria-label="Isi"
                      disabled={!d.dipilih}
                      className="min-h-16"
                    />
                    {d.tipe === "layanan" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Bidang
                          type="number"
                          min={0}
                          step={1000}
                          value={d.harga ?? ""}
                          placeholder="Harga dalam rupiah, kosongkan kalau belum pasti"
                          onChange={(e) =>
                            ubah(d.kunci, {
                              harga: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          aria-label="Harga"
                          disabled={!d.dipilih}
                          className="max-w-64"
                        />
                        {d.harga !== null ? (
                          <span className="angka text-xs text-aksen-tinta">
                            {rupiah(d.harga)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <IsiKartu className="border-t-2 border-garis">
            <form action={aksi_simpan} className="flex flex-wrap items-center gap-3">
              <input
                type="hidden"
                name="butir"
                value={JSON.stringify(
                  terpilih.map((d) => ({
                    tipe: d.tipe,
                    judul: d.judul,
                    isi: d.isi,
                    harga: d.harga,
                  })),
                )}
              />
              <Tombol type="submit" disabled={sedang_simpan || terpilih.length === 0}>
                <Upload className="size-3.5" />
                {sedang_simpan ? "Menyimpan" : `Simpan ${terpilih.length} entri`}
              </Tombol>
              <Tombol
                type="button"
                varian="hantu"
                onClick={() => setDraf([])}
                disabled={sedang_simpan}
              >
                Buang hasil bacaan
              </Tombol>
              {impor.biaya ? (
                <span className="angka text-xs text-redup">
                  {impor.biaya.token_masuk.toLocaleString("id-ID")} token masuk,{" "}
                  {impor.biaya.token_keluar.toLocaleString("id-ID")} keluar
                </span>
              ) : null}
            </form>
          </IsiKartu>
        </Kartu>
      ) : null}

      {simpan.galat ? (
        <p role="alert" className="flex items-start gap-2 text-xs text-gagal-tinta">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {simpan.galat}
        </p>
      ) : null}
      {simpan.pesan ? (
        <p role="status" className="flex items-start gap-2 text-xs text-sukses-tinta">
          <CircleCheck className="mt-0.5 size-4 shrink-0" />
          {simpan.pesan}
        </p>
      ) : null}
    </div>
  );
}
