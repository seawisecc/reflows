import {
  BookOpen,
  MessageCircleQuestion,
  Palette,
  ShieldBan,
} from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana } from "@/komponen/ui/lencana";
import { ambil_pengetahuan } from "@/lib/data/pengetahuan";
import { PanelImpor } from "./panel-impor";
import { BarisMateri } from "./daftar";
import type { TipePengetahuan } from "@/tipe";

export const metadata = { title: "Pengetahuan | Reflows" };
export const dynamic = "force-dynamic";

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

export default async function HalamanPengetahuan() {
  const { daftar, sumber } = await ambil_pengetahuan();
  const nyata = sumber === "supabase";

  return (
    <>
      <BilahAtas
        judul="Pengetahuan"
        keterangan={`${daftar.length} butir materi yang dibaca AI sebelum membalas`}
        aksi={
          !nyata ? (
            <Lencana nada="tunggu" className="hidden lg:inline-flex">
              Data contoh
            </Lencana>
          ) : null
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        <Kartu className="p-4">
          <p className="text-xs leading-relaxed text-redup">
            Isi halaman ini disusun jadi satu instruksi tetap untuk AI dan
            disimpan di cache, jadi bagian yang sama tidak dibayar ulang setiap
            balasan. Dokumen aslinya sengaja tidak ikut dibaca tiap kali:
            menyuapkan PDF dua puluh halaman ke setiap balasan itu mahal, dan
            model bisa salah membaca baris tabel harga.
          </p>
        </Kartu>

        {nyata ? <PanelImpor /> : null}

        {daftar.length === 0 ? (
          <Kartu>
            <Kosong
              ikon={BookOpen}
              judul="Materi masih kosong"
              keterangan="Unggah daftar harga atau tempel alamat halaman layananmu di atas, biar AI punya bahan untuk menjawab."
            />
          </Kartu>
        ) : (
          BAGIAN.map((b) => {
            const butir = daftar.filter((p) => p.tipe === b.tipe);
            if (butir.length === 0) return null;
            return (
              <Kartu key={b.tipe}>
                <KepalaKartu
                  judul={b.judul}
                  keterangan={b.keterangan}
                  aksi={<Lencana nada="netral">{butir.length} butir</Lencana>}
                />
                <ul className="divide-y-2 divide-[var(--garis)]">
                  {butir.map((p) => (
                    <BarisMateri key={p.id} butir={p} bisa_diubah={nyata} />
                  ))}
                </ul>
              </Kartu>
            );
          })
        )}
      </main>
    </>
  );
}
