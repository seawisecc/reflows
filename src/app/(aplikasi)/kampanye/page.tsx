import Link from "next/link";
import { ArrowUpRight, Send } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana, TitikStatus, type NadaLencana } from "@/komponen/ui/lencana";
import { BarBlok } from "@/komponen/ui/statistik";
import { PanelBuat } from "./panel-buat";
import { SpandukLayanan } from "@/komponen/spanduk-layanan";
import { ambil_kampanye, ambil_tag } from "@/lib/data/kampanye";
import { pengaturan_ringkas } from "@/lib/data/pengaturan";
import { supabase_siap } from "@/lib/lingkungan";
import type { StatusKampanye } from "@/tipe";

export const metadata = { title: "Kampanye | Reflows" };
export const dynamic = "force-dynamic";

export const RUPA_STATUS: Record<
  StatusKampanye,
  { label: string; nada: NadaLencana }
> = {
  draf: { label: "Draf", nada: "netral" },
  jalan: { label: "Jalan", nada: "sukses" },
  jeda: { label: "Dijeda", nada: "tunggu" },
  selesai: { label: "Selesai", nada: "sekunder" },
  dihentikan: { label: "Dihentikan", nada: "gagal" },
};

export default async function HalamanKampanye() {
  if (!supabase_siap()) {
    return (
      <>
        <BilahAtas judul="Kampanye" keterangan="Follow-up keluar bertahap" />
        <main className="p-4 sm:p-6">
          <Kartu>
            <Kosong
              ikon={Send}
              judul="Database belum tersambung"
              keterangan="Kampanye menulis ke daftar kontak sungguhan, jadi butuh Supabase menyala."
            />
          </Kartu>
        </main>
      </>
    );
  }

  const [daftar, tag, pengaturan] = await Promise.all([
    ambil_kampanye(),
    ambil_tag(),
    pengaturan_ringkas(),
  ]);
  const jalan = daftar.filter((k) => k.status === "jalan").length;

  return (
    <>
      <BilahAtas
        judul="Kampanye"
        keterangan={
          daftar.length === 0
            ? "Belum ada kampanye"
            : `${daftar.length} kampanye, ${jalan} sedang jalan`
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        {pengaturan ? <SpandukLayanan izin={pengaturan.izin} /> : null}

        <PanelBuat tag={tag} />

        {daftar.length === 0 ? (
          <Kartu>
            <Kosong
              ikon={Send}
              judul="Belum ada kampanye"
              keterangan="Kampanye mengirim sapaan bertahap ke daftar kontak, melambat sendiri, dan berhenti begitu orangnya membalas. Buat satu di atas untuk mulai."
            />
          </Kartu>
        ) : (
          <div className="space-y-4">
            {daftar.map((k) => {
              const rupa = RUPA_STATUS[k.status];
              const tuntas =
                k.angka.selesai + k.angka.berhenti + k.angka.gagal;
              return (
                <Kartu key={k.id}>
                  <KepalaKartu
                    judul={k.nama}
                    keterangan={
                      k.langkah.length === 0
                        ? "Belum punya langkah. Kampanye ini tidak akan mengirim apa pun."
                        : `${k.langkah.length} langkah, ${k.angka.sasaran_total} kontak`
                    }
                    aksi={
                      <div className="flex flex-wrap items-center gap-2">
                        <Lencana nada={rupa.nada}>
                          <TitikStatus nada={rupa.nada} hidup={k.status === "jalan"} />
                          {rupa.label}
                        </Lencana>
                        <Link href={`/kampanye/${k.id}`}>
                          <span className="pixel-sm fokus-pixel inline-flex items-center gap-1.5 border-2 border-garis px-2 py-1.5 uppercase text-redup hover:border-garis-tegas hover:text-teks">
                            Buka
                            <ArrowUpRight className="size-3.5" />
                          </span>
                        </Link>
                      </div>
                    }
                  />
                  <div className="space-y-4 p-4">
                    {k.angka.sasaran_total > 0 ? (
                      <BarBlok
                        nilai={tuntas}
                        maks={k.angka.sasaran_total}
                        nada={k.status === "jalan" ? "aksen" : "sekunder"}
                        label={`${tuntas} dari ${k.angka.sasaran_total} kontak tuntas`}
                      />
                    ) : null}

                    <dl className="grid gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <dt className="pixel-sm uppercase text-redup">Antre</dt>
                        <dd className="angka mt-1.5 text-teks">{k.angka.antre}</dd>
                      </div>
                      <div>
                        <dt className="pixel-sm uppercase text-redup">Terkirim</dt>
                        <dd className="angka mt-1.5 text-teks">
                          {k.angka.pesan_terkirim}
                        </dd>
                      </div>
                      <div>
                        <dt className="pixel-sm uppercase text-redup">Membalas</dt>
                        <dd className="angka mt-1.5 text-aksen-tinta">
                          {k.angka.dibalas}
                          {k.angka.tersentuh > 0 ? (
                            <span className="ml-1.5 text-redup">
                              {Math.round((k.angka.dibalas / k.angka.tersentuh) * 100)}%
                            </span>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="pixel-sm uppercase text-redup">Hari ini</dt>
                        <dd className="angka mt-1.5 text-teks">
                          {k.angka.terkirim_hari_ini}
                          <span className="ml-1 text-redup">
                            / {k.keputusan.batas_hari_ini}
                          </span>
                        </dd>
                      </div>
                    </dl>

                    {k.rem_alasan ? (
                      <p className="border-2 border-tunggu-tinta bg-permukaan-2 px-3 py-2 text-xs leading-relaxed text-tunggu-tinta">
                        Rem otomatis: {k.rem_alasan}
                      </p>
                    ) : (
                      <p className="text-xs leading-relaxed text-redup">
                        {k.keputusan.kirim
                          ? "Siap mengirim pada putaran antrean berikutnya."
                          : k.keputusan.sebab}
                      </p>
                    )}
                  </div>
                </Kartu>
              );
            })}
          </div>
        )}

        <Kartu className="p-4">
          <p className="text-xs leading-relaxed text-redup">
            Antrean dijalankan sekali per menit dan mengirim paling banyak satu
            pesan per kampanye. Yang menentukan kecepatan adalah jeda acak
            antar pesan, bukan seberapa sering antrean diperiksa. Sequence
            berhenti sendiri begitu kontak membalas, dan kontak yang membalas
            STOP tidak akan pernah masuk kampanye mana pun lagi.
          </p>
        </Kartu>
      </main>
    </>
  );
}
