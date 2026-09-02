import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana, TitikStatus, type NadaLencana } from "@/komponen/ui/lencana";
import { KartuStatistik, BarBlok } from "@/komponen/ui/statistik";
import { Penyegar } from "@/komponen/penyegar";
import {
  KendaliKampanye,
  PanelDaftarkan,
  PanelLangkah,
  TombolHapusLangkah,
} from "../kendali";
import { RUPA_STATUS } from "../page";
import { ambil_sasaran, ambil_satu_kampanye } from "@/lib/data/kampanye";
import { batas_hari_ke } from "@/lib/kampanye/antiban";
import { tampilkan_nomor } from "@/lib/gateway/nomor";
import { waktu_relatif } from "@/lib/utils";
import type { StatusSasaran } from "@/tipe";

export const dynamic = "force-dynamic";

const RUPA_SASARAN: Record<StatusSasaran, { label: string; nada: NadaLencana }> = {
  antre: { label: "Antre", nada: "netral" },
  selesai: { label: "Tuntas tanpa balasan", nada: "sekunder" },
  berhenti: { label: "Berhenti", nada: "sukses" },
  gagal: { label: "Gagal", nada: "gagal" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const k = await ambil_satu_kampanye(id);
  return { title: k ? `${k.nama} | Reflows` : "Kampanye | Reflows" };
}

export default async function DetailKampanye({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const k = await ambil_satu_kampanye(id);
  if (!k) notFound();

  const sasaran = await ambil_sasaran(id);
  const rupa = RUPA_STATUS[k.status];
  const tuntas = k.angka.selesai + k.angka.berhenti + k.angka.gagal;
  const rasio =
    k.angka.tersentuh > 0
      ? Math.round((k.angka.dibalas / k.angka.tersentuh) * 100)
      : null;

  // Kurva warm-up beberapa hari ke depan, supaya pemilik tahu kampanyenya
  // akan sampai kecepatan penuh kapan, bukan menebak-nebak.
  const kurva = [1, 2, 3, 5, 7, 10, 14].map((h) => ({
    hari: h,
    batas: batas_hari_ke(k.batas_harian_awal, k.batas_harian_maks, h),
  }));

  return (
    <>
      <BilahAtas
        judul={k.nama}
        keterangan={`${k.langkah.length} langkah, ${k.angka.sasaran_total} kontak, hari ke-${k.angka.hari_ke || 0}`}
        aksi={
          <div className="flex items-center gap-2">
            <Lencana nada={rupa.nada}>
              <TitikStatus nada={rupa.nada} hidup={k.status === "jalan"} />
              {rupa.label}
            </Lencana>
            <Link href="/kampanye">
              <span className="pixel-sm fokus-pixel inline-flex items-center gap-1.5 border-2 border-garis px-2 py-1.5 uppercase text-redup hover:border-garis-tegas hover:text-teks">
                <ArrowLeft className="size-3.5" />
                Semua
              </span>
            </Link>
          </div>
        }
      />
      {k.status === "jalan" ? <Penyegar jeda_detik={20} /> : null}

      <main className="space-y-6 p-4 sm:p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KartuStatistik
            label="Antre"
            nilai={String(k.angka.antre)}
            nada="netral"
            catatan={`${tuntas} dari ${k.angka.sasaran_total} kontak sudah tuntas`}
          />
          <KartuStatistik
            label="Pesan terkirim"
            nilai={String(k.angka.pesan_terkirim)}
            nada="sekunder"
            catatan={`${k.angka.terkirim_hari_ini} hari ini, batas ${k.keputusan.batas_hari_ini}`}
          />
          <KartuStatistik
            label="Membalas"
            nilai={String(k.angka.dibalas)}
            satuan={rasio !== null ? `${rasio}%` : undefined}
            nada="aksen"
            catatan={
              rasio === null
                ? "Belum ada kontak yang tersentuh"
                : `Dari ${k.angka.tersentuh} kontak yang sudah dikirimi`
            }
          />
          <KartuStatistik
            label="Gagal kirim"
            nilai={String(k.angka.gagal)}
            nada={k.angka.gagal > 0 ? "gagal" : "netral"}
            catatan="Nomor yang ditolak gateway"
          />
        </section>

        <Kartu>
          <KepalaKartu
            judul="Kendali"
            keterangan="Kampanye tidak pernah mengirim apa pun sebelum dijalankan."
          />
          <div className="space-y-4 p-4">
            <KendaliKampanye id={k.id} status={k.status} />
            <div className="pemisah-pixel" />
            {k.rem_alasan ? (
              <p className="border-2 border-tunggu-tinta bg-permukaan-2 px-3 py-2.5 text-xs leading-relaxed text-tunggu-tinta">
                <span className="pixel-sm block uppercase">Rem otomatis menyala</span>
                <span className="mt-1.5 block">{k.rem_alasan}</span>
                <span className="mt-1.5 block text-redup">
                  Periksa dulu daftar kontak dan kalimatnya sebelum dilanjutkan.
                </span>
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-redup">
                {k.keputusan.kirim
                  ? "Siap mengirim pada putaran antrean berikutnya."
                  : k.keputusan.sebab}
              </p>
            )}
            {k.angka.sasaran_total > 0 ? (
              <BarBlok
                nilai={tuntas}
                maks={k.angka.sasaran_total}
                nada={k.status === "jalan" ? "aksen" : "sekunder"}
                label={`${tuntas} dari ${k.angka.sasaran_total} kontak tuntas`}
              />
            ) : null}
          </div>
        </Kartu>

        <div className="grid gap-6 xl:grid-cols-2">
          <Kartu>
            <KepalaKartu
              judul="Kontak di antrean"
              keterangan="Daftar sasaran disusun dari kontak yang cocok dengan saringan tag."
            />
            <div className="p-4">
              <PanelDaftarkan kampanye_id={k.id} saringan_tag={k.saringan_tag} />
            </div>
          </Kartu>

          <Kartu>
            <KepalaKartu
              judul="Kecepatan"
              keterangan="Naik bertahap supaya nomor tidak terlihat seperti mesin yang baru dinyalakan."
            />
            <div className="space-y-4 p-4">
              <dl className="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt className="pixel-sm uppercase text-redup">Jeda antar pesan</dt>
                  <dd className="angka mt-1.5 text-teks">
                    {k.jeda_min_detik} sampai {k.jeda_maks_detik} detik, diacak
                  </dd>
                </div>
                <div>
                  <dt className="pixel-sm uppercase text-redup">Rem otomatis</dt>
                  <dd className="angka mt-1.5 text-teks">
                    di bawah {Math.round(k.rem_rasio_balas * 100)}% setelah{" "}
                    {k.rem_min_terkirim} kontak
                  </dd>
                </div>
              </dl>
              <div className="pemisah-pixel" />
              <ul className="space-y-1.5">
                {kurva.map((b) => (
                  <li key={b.hari} className="flex items-center gap-3">
                    <span className="pixel-sm w-16 shrink-0 uppercase text-redup">
                      Hari {b.hari}
                    </span>
                    <span className="h-3 flex-1 border-2 border-garis bg-permukaan-2 p-0.5">
                      <span
                        aria-hidden
                        className="bar-blok block h-full text-seri-2"
                        style={{ width: `${(b.batas / k.batas_harian_maks) * 100}%` }}
                      />
                    </span>
                    <span className="angka w-10 shrink-0 text-right text-xs text-teks">
                      {b.batas}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Kartu>
        </div>

        <Kartu>
          <KepalaKartu
            judul="Langkah"
            keterangan="Dikirim berurutan, dan berhenti di tengah jalan begitu kontaknya membalas."
            aksi={<Lencana nada="netral">{k.langkah.length} langkah</Lencana>}
          />
          {k.langkah.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-redup">
              Belum ada langkah. Kampanye tanpa langkah tidak bisa dijalankan.
            </p>
          ) : (
            <ol className="divide-y-2 divide-[var(--garis)]">
              {k.langkah.map((l) => (
                <li key={l.id} className="flex gap-3 px-4 py-3">
                  <span className="pixel-sm grid size-6 shrink-0 place-items-center border-2 border-garis text-redup">
                    {l.urutan + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="pixel-sm uppercase text-redup">
                      {l.urutan === 0
                        ? "Langsung saat masuk antrean"
                        : `${l.tunda_hari} hari setelah langkah sebelumnya`}
                      {" | "}
                      {l.varian.length} varian
                    </p>
                    <ul className="space-y-1.5">
                      {l.varian.map((v, i) => (
                        <li
                          key={i}
                          className="border-l-2 border-garis pl-3 text-sm leading-relaxed text-teks"
                        >
                          {v}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <TombolHapusLangkah id={l.id} kampanye_id={k.id} />
                </li>
              ))}
            </ol>
          )}
        </Kartu>

        <PanelLangkah kampanye_id={k.id} jumlah_langkah={k.langkah.length} />

        <Kartu>
          <KepalaKartu
            judul="Sasaran"
            keterangan="Berhenti itu hasil yang bagus: artinya kontaknya membalas dan percakapannya pindah ke inbox."
            aksi={<Lencana nada="netral">{sasaran.length} baris</Lencana>}
          />
          {sasaran.length === 0 ? (
            <Kosong
              ikon={Send}
              judul="Belum ada kontak di antrean"
              keterangan="Tekan tombol masukkan kontak di atas untuk menyusun daftar sasarannya."
            />
          ) : (
            <Tabel>
              <KepalaTabel>
                <tr>
                  <Th>Kontak</Th>
                  <Th>Nomor</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Terkirim</Th>
                  <Th className="text-right">Jadwal</Th>
                </tr>
              </KepalaTabel>
              <tbody>
                {sasaran.map((s) => {
                  const r = RUPA_SASARAN[s.status];
                  return (
                    <Tr key={s.id}>
                      <Td className="max-w-56 truncate text-sm text-teks">{s.nama}</Td>
                      <Td className="angka whitespace-nowrap text-xs text-redup">
                        {s.nomor_wa ? tampilkan_nomor(s.nomor_wa) : "-"}
                      </Td>
                      <Td>
                        <Lencana nada={r.nada}>{r.label}</Lencana>
                        {s.alasan_berhenti ? (
                          <span className="mt-1 block text-xs text-redup">
                            {s.alasan_berhenti}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="angka text-right text-xs text-teks">
                        {s.terkirim}
                      </Td>
                      <Td className="angka whitespace-nowrap text-right text-xs text-redup">
                        {s.status === "antre" ? waktu_relatif(s.jadwal_at) : "-"}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Tabel>
          )}
        </Kartu>
      </main>
    </>
  );
}
