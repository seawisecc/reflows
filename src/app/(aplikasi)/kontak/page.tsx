import { Plus, Upload, Users } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { Lencana } from "@/komponen/ui/lencana";
import { Tombol } from "@/komponen/ui/tombol";
import { PERCAKAPAN } from "@/lib/contoh-data";
import { waktu_relatif } from "@/lib/utils";
import type { SumberKontak } from "@/tipe";

export const metadata = { title: "Kontak | Reflows" };

const LABEL_SUMBER: Record<SumberKontak, string> = {
  "chat-masuk": "Chat masuk",
  impor: "Impor",
  manual: "Ditambah manual",
  kampanye: "Kampanye",
};

export default function HalamanKontak() {
  const kontak = PERCAKAPAN.map((p) => ({
    ...p.kontak,
    pesan_terakhir_at: p.pesan_terakhir_at,
    jumlah_pesan: p.pesan.length,
  }));

  return (
    <>
      <BilahAtas
        judul="Kontak"
        keterangan={`${kontak.length} kontak tersimpan`}
      />
      <main className="space-y-6 p-4 sm:p-6">
        <Kartu>
          <KepalaKartu
            judul="Semua kontak"
            keterangan="Kontak masuk sendiri begitu seseorang chat ke nomor bisnis kamu. Impor CSV dipakai untuk daftar prospek dari luar."
            aksi={
              <div className="flex gap-2">
                <Tombol varian="garis" ukuran="kecil" disabled>
                  <Upload className="size-3.5" />
                  Impor CSV
                </Tombol>
                <Tombol ukuran="kecil" disabled>
                  <Plus className="size-3.5" />
                  Tambah
                </Tombol>
              </div>
            }
          />
          <Tabel>
            <KepalaTabel>
              <tr>
                <Th>Nama</Th>
                <Th>Nomor</Th>
                <Th>Tag</Th>
                <Th>Sumber</Th>
                <Th className="text-right">Pesan</Th>
                <Th className="text-right">Terakhir</Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {kontak.map((k) => (
                <Tr key={k.id}>
                  <Td className="max-w-56 truncate text-sm text-teks">
                    {k.nama}
                  </Td>
                  <Td className="angka whitespace-nowrap text-xs text-redup">
                    +{k.nomor_wa}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1.5">
                      {k.tag.map((t) => (
                        <Lencana
                          key={t}
                          nada={t === "client" ? "sukses" : "netral"}
                        >
                          {t}
                        </Lencana>
                      ))}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-redup">
                    {LABEL_SUMBER[k.sumber]}
                  </Td>
                  <Td className="angka text-right text-xs text-teks">
                    {k.jumlah_pesan}
                  </Td>
                  <Td className="angka whitespace-nowrap text-right text-xs text-redup">
                    {waktu_relatif(k.pesan_terakhir_at)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tabel>
        </Kartu>

        <Kartu className="p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-4 shrink-0 text-sekunder-tinta" />
            <p className="text-xs leading-relaxed text-redup">
              Kontak yang membalas STOP atau BERHENTI otomatis masuk daftar
              berhenti dan tidak akan pernah dikirimi pesan kampanye lagi.
              Aturan ini kepasang di Fase 3 bersama mesin outbound.
            </p>
          </div>
        </Kartu>
      </main>
    </>
  );
}
