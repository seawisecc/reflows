import { Send } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";

export const metadata = { title: "Kampanye | Reflows" };

const RENCANA = [
  "Impor kontak lewat CSV, lengkap dengan tag untuk segmentasi",
  "Template pesan dengan variabel nama dan bisnis, plus variasi kalimat supaya tiap kontak tidak menerima teks identik",
  "Sequence bertahap: sapaan hari ke-0, pengingat hari ke-3, penutup hari ke-7",
  "Berhenti sendiri begitu kontak membalas, percakapan langsung dilempar ke inbox",
  "Jeda acak 40 sampai 120 detik antar pesan, hanya jalan di jam aktif",
  "Naik bertahap dari 20 pesan sehari, dan rem otomatis kalau rasio balasan anjlok",
];

export default function HalamanKampanye() {
  return (
    <>
      <BilahAtas judul="Kampanye" keterangan="Mesin follow-up keluar, dijadwalkan Fase 3" />
      <main className="space-y-6 p-4 sm:p-6">
        <Kartu>
          <Kosong
            ikon={Send}
            judul="Belum digarap"
            keterangan="Mesin outbound baru dibangun setelah inbox dan auto-reply terbukti jalan. Urutannya sengaja begitu supaya balasan yang masuk dari kampanye punya tempat mendarat."
          />
        </Kartu>
        <Kartu>
          <KepalaKartu
            judul="Yang akan ada di sini"
            keterangan="Setengah dari daftar ini soal menjaga nomor tidak kena banned, bukan soal mengirim lebih cepat."
          />
          <ul className="divide-y-2 divide-[var(--garis)]">
            {RENCANA.map((r, i) => (
              <li key={r} className="flex items-start gap-3 px-4 py-3">
                <span className="pixel grid size-6 shrink-0 place-items-center border-2 border-garis text-[9px] text-redup">
                  {i + 1}
                </span>
                <p className="text-xs leading-relaxed text-teks">{r}</p>
              </li>
            ))}
          </ul>
        </Kartu>
      </main>
    </>
  );
}
