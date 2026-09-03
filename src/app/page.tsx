import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, MessageSquare } from "lucide-react";
import { Logo } from "@/komponen/merek/logo";
import { TombolTema } from "@/komponen/shell/tombol-tema";
import { Bagian } from "@/komponen/depan/bagian";
import { KartuPaket } from "@/komponen/depan/kartu-paket";
import { Kartu } from "@/komponen/ui/kartu";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { Tombol } from "@/komponen/ui/tombol";
import { KEMAMPUAN, LANGKAH_MESIN, URUTAN_PAKET, YANG_DISIAPKAN } from "@/lib/depan";
import { kontak_whatsapp } from "@/lib/lingkungan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reflows | Otomasi Admin WhatsApp untuk Bisnis Kecil",
  description:
    "Chat client dibalas otomatis dari materi bisnismu sendiri, dan diserahkan ke kamu begitu di luar kemampuannya. Kejar prospek dan kirim invoice dari nomor yang sama.",
  alternates: { canonical: "/" },
};

/** Warna pelaku mengikuti aturan yang dipakai seluruh antarmuka: manusia
 *  teal atau oranye, AI biru atau ungu. */
const NADA_PELAKU = {
  kontak: "netral",
  ai: "sekunder",
  manusia: "aksen",
} as const;

const LABEL_PELAKU = {
  kontak: "Client",
  ai: "AI",
  manusia: "Kamu",
} as const;

export default function HalamanDepan() {
  const nomor = kontak_whatsapp();
  const ajakan = nomor
    ? { href: `https://wa.me/${nomor}`, label: "Chat kami" }
    : { href: "/masuk", label: "Masuk" };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b-2 border-garis bg-bg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo className="size-8" />
          <span className="pixel-lg flex-1 uppercase text-teks">Reflows</span>
          <TombolTema />
          <Link href="/masuk" className="fokus-pixel">
            <Tombol varian="garis" ukuran="kecil">
              Masuk
            </Tombol>
          </Link>
        </div>
      </header>

      <main>
        <section className="px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Lencana nada="sekunder">
              <TitikStatus nada="sekunder" hidup />
              Otomasi admin WhatsApp
            </Lencana>

            <h1 className="pixel-2xl mt-6 max-w-3xl uppercase text-teks">
              Chat client dibalas, walaupun kamu sedang pegang kerjaan lain
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-redup">
              Reflows membalas chat yang masuk ke nomor WhatsApp bisnismu,
              memakai daftar layanan dan harga yang kamu isi sendiri. Begitu
              pertanyaannya di luar materi, atau orangnya minta bicara dengan
              manusia, chatnya diserahkan ke kamu lengkap dengan alasannya.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="#paket" className="fokus-pixel">
                <Tombol ukuran="besar">
                  Lihat paket
                  <ArrowRight aria-hidden className="size-4" />
                </Tombol>
              </Link>
              {nomor ? (
                <a href={ajakan.href} className="fokus-pixel">
                  <Tombol varian="garis" ukuran="besar">
                    <MessageSquare aria-hidden className="size-4" />
                    Chat kami
                  </Tombol>
                </a>
              ) : null}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-redup">
              Akun dibuatkan Reflows, belum ada pendaftaran mandiri, karena
              tiap akun terikat ke satu bisnis.
            </p>
          </div>
        </section>

        <Bagian
          judul="Cara kerjanya"
          keterangan="Urutan ini bukan gambaran, tapi keputusan yang benar-benar dijalankan mesinnya setiap ada chat masuk."
        >
          <ol className="space-y-3">
            {LANGKAH_MESIN.map((langkah, i) => (
              <li key={langkah.judul}>
                <Kartu className="flex gap-4 p-4">
                  <span
                    aria-hidden
                    className="angka pixel-sm hidden w-6 shrink-0 pt-1 text-redup sm:block"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="pixel-lg uppercase text-teks">
                        {langkah.judul}
                      </h3>
                      <Lencana nada={NADA_PELAKU[langkah.pelaku]}>
                        {LABEL_PELAKU[langkah.pelaku]}
                      </Lencana>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-redup">
                      {langkah.isi}
                    </p>
                  </div>
                </Kartu>
              </li>
            ))}
          </ol>
        </Bagian>

        <Bagian
          judul="Yang ikut dikerjakan"
          keterangan="Satu nomor WhatsApp, empat pekerjaan admin yang biasanya menumpuk."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {KEMAMPUAN.map((k) => (
              <Kartu key={k.judul} className="p-5">
                <h3 className="pixel-lg uppercase text-teks">{k.judul}</h3>
                <p className="mt-4 text-xs leading-relaxed text-redup">
                  {k.isi}
                </p>
              </Kartu>
            ))}
          </div>
        </Bagian>

        <Bagian
          id="paket"
          judul="Paket"
          keterangan="Harga per bulan, di luar biaya gateway WhatsApp yang akunnya atas nama kamu sendiri. Kuota yang lewat ditagih per balasan, dan kamu bisa memasang batas supaya AI berhenti alih-alih menambah tagihan."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {URUTAN_PAKET.map((nama) => (
              <KartuPaket key={nama} nama={nama} ajakan={ajakan} />
            ))}
          </div>
        </Bagian>

        <Bagian
          judul="Yang perlu kamu siapkan"
          keterangan="Tiga hal, dan tidak ada yang perlu dibeli dari kami."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {YANG_DISIAPKAN.map((y) => (
              <Kartu key={y.judul} className="p-5">
                <h3 className="pixel-lg uppercase text-teks">{y.judul}</h3>
                <p className="mt-4 text-xs leading-relaxed text-redup">
                  {y.isi}
                </p>
              </Kartu>
            ))}
          </div>
        </Bagian>

        <section className="border-t-2 border-garis px-4 py-20 sm:px-6">
          <div
            className={cn(
              "kotak kotak-tegas bayang-pixel mx-auto max-w-3xl p-8 text-center",
            )}
          >
            <h2 className="pixel-xl uppercase text-teks">Mulai dari satu nomor</h2>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-redup">
              Sambungkan nomor WhatsApp bisnismu, isi materinya, lalu biarkan
              chat yang gampang dijawab sendiri. Yang sulit tetap sampai ke
              kamu.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {nomor ? (
                <a href={ajakan.href} className="fokus-pixel">
                  <Tombol ukuran="besar">
                    <MessageSquare aria-hidden className="size-4" />
                    Chat kami
                  </Tombol>
                </a>
              ) : (
                <Link href="/masuk" className="fokus-pixel">
                  <Tombol ukuran="besar">Masuk</Tombol>
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-garis px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
          <Logo className="size-6" />
          <p className="flex-1 text-xs text-redup">
            Reflows, dibuat Seawise Studio.
          </p>
          <Link href="/masuk" className="fokus-pixel text-xs text-redup hover:text-teks">
            Masuk
          </Link>
        </div>
      </footer>
    </div>
  );
}
