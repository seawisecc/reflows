import {
  ArrowUpRight,
  Bot,
  Clock,
  MessagesSquare,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { KartuStatistik, BarBlok } from "@/komponen/ui/statistik";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { GrafikAktivitas } from "@/komponen/ui/grafik-aktivitas";
import { Tombol } from "@/komponen/ui/tombol";
import { AKTIVITAS_7_HARI, RINGKASAN } from "@/lib/contoh-data";
import { ambil_percakapan, ambil_ringkasan } from "@/lib/data/percakapan";
import { waktu_relatif } from "@/lib/utils";

export const metadata = { title: "Ringkasan | Reflows" };

export const dynamic = "force-dynamic";

export default async function Dasbor() {
  const [{ daftar, sumber }, hitungan] = await Promise.all([
    ambil_percakapan(),
    ambil_ringkasan(),
  ]);

  // Angka nyata kalau database tersambung, angka contoh kalau belum.
  // Sengaja tidak dicampur, supaya tidak ada layar yang setengah nyata.
  const angka = hitungan ?? RINGKASAN;
  const perlu_perhatian = daftar.filter((p) => p.status === "manual");

  return (
    <>
      <BilahAtas
        judul="Ringkasan"
        keterangan="Kondisi admin WhatsApp kamu hari ini"
      />

      <main className="space-y-6 p-4 sm:p-6">
        <section
          aria-label="Angka utama"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KartuStatistik
            label="Pesan masuk hari ini"
            nilai={String(angka.pesan_masuk_hari_ini)}
            ikon={MessagesSquare}
            nada="netral"
            catatan={`${angka.kontak_baru_minggu_ini} kontak baru minggu ini`}
          />
          <KartuStatistik
            label="Dijawab AI sendiri"
            nilai={String(angka.dijawab_ai)}
            satuan={`dari ${angka.pesan_masuk_hari_ini}`}
            ikon={Bot}
            nada="sekunder"
            catatan="Kamu tidak perlu menyentuh percakapan ini"
          />
          <KartuStatistik
            label="Butuh kamu"
            nilai={String(angka.butuh_kamu)}
            ikon={TriangleAlert}
            nada="gagal"
            catatan="Percakapan yang AI serahkan ke kamu"
          />
          <KartuStatistik
            label="Rata-rata balas"
            nilai={sumber === "supabase" ? "0" : String(RINGKASAN.waktu_balas_rata_detik)}
            satuan="detik"
            ikon={Clock}
            nada="netral"
            catatan="Terisi setelah mesin AI menyala di Fase 2"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <Kartu className="self-start xl:col-span-2">
            <KepalaKartu
              judul="Tujuh hari terakhir"
              keterangan="Berapa pesan yang masuk, dan berapa yang lolos tanpa campur tangan kamu."
            />
            <GrafikAktivitas data={AKTIVITAS_7_HARI} />
          </Kartu>

          <div className="space-y-6">
            <Kartu>
              <KepalaKartu
                judul="Kuota kirim hari ini"
                keterangan="Batas harian menjaga nomor tidak dianggap spam."
              />
              <div className="space-y-4 p-4">
                <BarBlok
                  nilai={angka.pesan_masuk_hari_ini}
                  maks={RINGKASAN.kuota_pesan_harian}
                  nada="aksen"
                  label={`${angka.pesan_masuk_hari_ini} dari ${RINGKASAN.kuota_pesan_harian} pesan`}
                />
                <div className="pemisah-pixel" />
                <dl className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Status nomor</dt>
                    <dd>
                      <Lencana nada="tunggu">
                        <TitikStatus nada="tunggu" hidup />
                        Belum tersambung
                      </Lencana>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Jam aktif</dt>
                    <dd className="angka text-teks">08.00 sampai 20.00 WITA</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Biaya AI bulan ini</dt>
                    <dd className="angka text-teks">
                      $ {RINGKASAN.biaya_ai_bulan_ini.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Kartu>

            <Kartu>
              <KepalaKartu
                judul="Langkah berikutnya"
                keterangan="Reflows belum bisa membalas apa pun sebelum tiga hal ini beres."
              />
              <ol className="divide-y-2 divide-[var(--garis)]">
                {[
                  {
                    label: "Sambungkan nomor WhatsApp",
                    ke: "/pengaturan",
                    ikon: Sparkles,
                  },
                  {
                    label: "Isi layanan dan harga",
                    ke: "/pengetahuan",
                    ikon: Bot,
                  },
                  { label: "Impor kontak client", ke: "/kontak", ikon: UserPlus },
                ].map((l, i) => (
                  <li key={l.ke}>
                    <Link
                      href={l.ke}
                      className="fokus-pixel flex items-center gap-3 px-4 py-3 text-xs hover:bg-permukaan-2"
                    >
                      <span className="pixel-sm grid size-6 shrink-0 place-items-center border-2 border-garis text-redup">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-teks">{l.label}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-redup" />
                    </Link>
                  </li>
                ))}
              </ol>
            </Kartu>
          </div>
        </div>

        <Kartu>
          <KepalaKartu
            judul="Perlu kamu tangani"
            keterangan="Percakapan yang AI serahkan ke manusia, urut dari yang paling lama menunggu."
            aksi={
              <Link href="/percakapan">
                <Tombol varian="garis" ukuran="kecil">
                  Buka inbox
                </Tombol>
              </Link>
            }
          />
          {perlu_perhatian.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-redup">
              Tidak ada yang menunggu. Semua percakapan sedang aman.
            </p>
          ) : (
          <ul className="divide-y-2 divide-[var(--garis)]">
            {perlu_perhatian.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/percakapan?p=${p.id}`}
                  className="fokus-pixel flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-permukaan-2"
                >
                  <TitikStatus nada="gagal" hidup />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-teks">
                      {p.kontak.nama}
                    </span>
                    <span className="mt-1 block truncate text-xs text-redup">
                      {p.alasan_eskalasi}
                    </span>
                  </span>
                  {p.belum_dibaca > 0 ? (
                    <Lencana nada="gagal">{p.belum_dibaca} belum dibaca</Lencana>
                  ) : null}
                  <span className="angka shrink-0 text-xs text-redup">
                    {waktu_relatif(p.pesan_terakhir_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          )}
        </Kartu>
      </main>
    </>
  );
}
