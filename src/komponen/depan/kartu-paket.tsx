import Link from "next/link";
import { Check } from "lucide-react";
import { Kartu } from "@/komponen/ui/kartu";
import { Lencana } from "@/komponen/ui/lencana";
import { Tombol } from "@/komponen/ui/tombol";
import { PAKET, type NamaPaket } from "@/lib/paket";
import { rincian_paket, PAKET_DISARANKAN } from "@/lib/depan";
import { rupiah, cn } from "@/lib/utils";

export function KartuPaket({
  nama,
  ajakan,
}: {
  nama: NamaPaket;
  /** Tujuan tombolnya. Chat WhatsApp kalau nomornya disetel, kalau tidak
   *  halaman masuk, karena akun memang dibuatkan manual. */
  ajakan: { href: string; label: string };
}) {
  const p = PAKET[nama];
  const disarankan = nama === PAKET_DISARANKAN;

  return (
    <Kartu
      className={cn(
        "flex flex-col p-5",
        disarankan && "border-aksen-tinta",
      )}
    >
      {/* Lencana "paling pas" 4 piksel lebih tinggi daripada judul telanjang,
          dan selisih itu menggeser seluruh isi kartu di bawahnya. */}
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h3 className="pixel-lg uppercase text-teks">{p.label}</h3>
        {disarankan ? <Lencana nada="aksen">Paling pas</Lencana> : null}
      </div>

      {/* Tingginya dipatok dua baris supaya harga dan daftar isinya sejajar
          di ketiga kartu. Tabel harga yang barisnya melenceng membuat orang
          membandingkan angka yang bukan pasangannya. */}
      <p className="mt-4 min-h-10 text-xs leading-relaxed text-redup">
        {p.keterangan}
      </p>

      <p className="angka mt-6 text-2xl text-teks">{rupiah(p.harga_bulanan)}</p>
      <p className="mt-1 text-xs text-redup">per bulan</p>

      <ul className="mt-6 flex-1 space-y-3 border-t-2 border-garis pt-6">
        {rincian_paket(nama).map((baris) => (
          <li key={baris.label} className="flex items-start gap-2.5 text-xs">
            <Check
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-aksen-tinta"
            />
            <span className="text-redup">
              {baris.label}
              {": "}
              <span className="text-teks">{baris.nilai}</span>
            </span>
          </li>
        ))}
      </ul>

      <Link href={ajakan.href} className="fokus-pixel mt-6 block">
        <Tombol
          varian={disarankan ? "utama" : "garis"}
          className="w-full"
        >
          {ajakan.label}
        </Tombol>
      </Link>
    </Kartu>
  );
}
