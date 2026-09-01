import { BookOpen, MessageCircleQuestion, Palette, ShieldBan } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";
import { PENGETAHUAN } from "@/lib/contoh-data";
import { rupiah } from "@/lib/utils";
import type { TipePengetahuan } from "@/tipe";

export const metadata = { title: "Pengetahuan | Reflows" };

const BAGIAN: {
  tipe: TipePengetahuan;
  judul: string;
  keterangan: string;
  ikon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    tipe: "layanan",
    judul: "Layanan dan harga",
    keterangan:
      "Satu-satunya sumber angka yang boleh disebut AI. Di luar daftar ini, percakapan dieskalasi ke kamu.",
    ikon: BookOpen,
  },
  {
    tipe: "faq",
    judul: "Pertanyaan yang sering masuk",
    keterangan:
      "Tulis jawabannya sekali, AI memakai ulang dengan kalimat yang disesuaikan konteks.",
    ikon: MessageCircleQuestion,
  },
  {
    tipe: "gaya",
    judul: "Gaya bahasa",
    keterangan: "Menentukan nada balasan supaya tidak terasa seperti robot.",
    ikon: Palette,
  },
  {
    tipe: "catatan",
    judul: "Pagar pembatas",
    keterangan: "Hal yang tidak boleh dijanjikan AI dalam kondisi apa pun.",
    ikon: ShieldBan,
  },
];

export default function HalamanPengetahuan() {
  return (
    <>
      <BilahAtas
        judul="Pengetahuan"
        keterangan="Materi yang dibaca AI sebelum menyusun setiap balasan"
      />
      <main className="space-y-6 p-4 sm:p-6">
        <Kartu className="p-4">
          <p className="text-xs leading-relaxed text-redup">
            Isi halaman ini disusun jadi satu instruksi tetap untuk AI dan
            disimpan di cache, jadi bagian yang sama tidak dibayar ulang setiap
            balasan. Makin rinci daftar layanan dan harganya, makin jarang AI
            perlu bertanya ke kamu.
          </p>
        </Kartu>

        {BAGIAN.map((b) => {
          const butir = PENGETAHUAN.filter((p) => p.tipe === b.tipe);
          const Ikon = b.ikon;
          return (
            <Kartu key={b.tipe}>
              <KepalaKartu
                judul={b.judul}
                keterangan={b.keterangan}
                aksi={
                  <Tombol varian="garis" ukuran="kecil" disabled>
                    Tambah
                  </Tombol>
                }
              />
              <ul className="divide-y-2 divide-[var(--garis)]">
                {butir.map((p) => (
                  <li key={p.id} className="flex gap-3 px-4 py-3">
                    <Ikon className="mt-0.5 size-4 shrink-0 text-redup" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h3 className="text-sm text-teks">{p.judul}</h3>
                        {p.harga !== null ? (
                          <span className="angka text-sm font-bold text-aksen-tinta">
                            {rupiah(p.harga)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-redup">
                        {p.isi}
                      </p>
                    </div>
                    <Lencana nada={p.aktif ? "sukses" : "netral"}>
                      {p.aktif ? "Aktif" : "Nonaktif"}
                    </Lencana>
                  </li>
                ))}
              </ul>
            </Kartu>
          );
        })}
      </main>
    </>
  );
}
