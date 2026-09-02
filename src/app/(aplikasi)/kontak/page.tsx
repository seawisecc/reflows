import { BanIcon, Users } from "lucide-react";
import Link from "next/link";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana } from "@/komponen/ui/lencana";
import { PanelKontak, TombolHapusKontak } from "./panel";
import { ambil_kontak } from "@/lib/data/kontak";
import { tampilkan_nomor } from "@/lib/gateway/nomor";
import { waktu_relatif } from "@/lib/utils";
import type { SumberKontak } from "@/tipe";

export const metadata = { title: "Kontak | Reflows" };
export const dynamic = "force-dynamic";

const LABEL_SUMBER: Record<SumberKontak, string> = {
  "chat-masuk": "Chat masuk",
  impor: "Impor",
  manual: "Ditambah manual",
  kampanye: "Kampanye",
};

export default async function HalamanKontak() {
  const { daftar, sumber } = await ambil_kontak();
  const nyata = sumber === "supabase";
  const berhenti = daftar.filter((k) => k.opt_out_at).length;

  return (
    <>
      <BilahAtas
        judul="Kontak"
        keterangan={
          daftar.length === 0
            ? "Belum ada kontak"
            : `${daftar.length} kontak tersimpan${berhenti > 0 ? `, ${berhenti} minta berhenti` : ""}`
        }
        aksi={
          nyata ? null : (
            <Lencana nada="tunggu" className="hidden lg:inline-flex">
              Data contoh
            </Lencana>
          )
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        {nyata ? <PanelKontak /> : null}

        <Kartu>
          <KepalaKartu
            judul="Semua kontak"
            keterangan="Kontak masuk sendiri begitu seseorang chat ke nomor bisnis kamu. Impor dipakai untuk daftar prospek dari luar."
            aksi={<Lencana nada="netral">{daftar.length} baris</Lencana>}
          />
          {daftar.length === 0 ? (
            <Kosong
              ikon={Users}
              judul="Belum ada kontak"
              keterangan="Kontak pertama muncul sendiri begitu ada yang chat ke nomor bisnis kamu. Atau impor daftar prospek dari spreadsheet di atas."
            />
          ) : (
            <Tabel>
              <KepalaTabel>
                <tr>
                  <Th>Nama</Th>
                  <Th>Nomor</Th>
                  <Th>Tag</Th>
                  <Th>Sumber</Th>
                  <Th className="text-right">Pesan</Th>
                  <Th className="text-right">Terakhir</Th>
                  {nyata ? <Th className="text-right">Hapus</Th> : null}
                </tr>
              </KepalaTabel>
              <tbody>
                {daftar.map((k) => (
                  <Tr key={k.id}>
                    <Td className="max-w-56 truncate text-sm text-teks">
                      {k.status ? (
                        <Link
                          href="/percakapan"
                          className="fokus-pixel hover:text-aksen-tinta"
                        >
                          {k.nama}
                        </Link>
                      ) : (
                        k.nama
                      )}
                    </Td>
                    <Td className="angka whitespace-nowrap text-xs text-redup">
                      {tampilkan_nomor(k.nomor_wa)}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1.5">
                        {k.opt_out_at ? (
                          <Lencana nada="gagal">
                            <BanIcon className="size-3" />
                            berhenti
                          </Lencana>
                        ) : null}
                        {k.tag.map((t) => (
                          <Lencana key={t} nada={t === "client" ? "sukses" : "netral"}>
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
                      {k.pesan_terakhir_at
                        ? waktu_relatif(k.pesan_terakhir_at)
                        : "belum pernah"}
                    </Td>
                    {nyata ? (
                      <Td className="text-right">
                        <TombolHapusKontak id={k.id} nama={k.nama} />
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          )}
        </Kartu>

        <Kartu className="p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-4 shrink-0 text-sekunder-tinta" />
            <p className="text-xs leading-relaxed text-redup">
              Kontak yang membalas STOP atau BERHENTI otomatis masuk daftar
              berhenti dan tidak akan pernah dikirimi pesan kampanye lagi.
              Penandaannya sudah jalan sekarang, mesin kampanye yang memakainya
              baru dipasang di Fase 3.
            </p>
          </div>
        </Kartu>
      </main>
    </>
  );
}
