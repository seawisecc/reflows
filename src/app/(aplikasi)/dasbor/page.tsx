import {
  ArrowUpRight,
  Bot,
  Clock,
  FileClock,
  MessagesSquare,
  Sparkles,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Penyegar } from "@/komponen/penyegar";
import { SpandukLayanan } from "@/komponen/spanduk-layanan";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { KartuStatistik, BarBlok } from "@/komponen/ui/statistik";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { GrafikAktivitas } from "@/komponen/ui/grafik-aktivitas";
import { Tombol } from "@/komponen/ui/tombol";
import { AKTIVITAS_7_HARI, RINGKASAN } from "@/lib/contoh-data";
import { ambil_percakapan } from "@/lib/data/percakapan";
import { ambil_ringkasan_nyata } from "@/lib/data/ringkasan";
import { pengaturan_ringkas } from "@/lib/data/pengaturan";
import { kurs_dolar } from "@/lib/ai/biaya";
import { rupiah, waktu_relatif } from "@/lib/utils";

export const metadata = { title: "Ringkasan | Reflows" };

export const dynamic = "force-dynamic";

/** Lewat semenit, "2.30 menit" lebih terbaca daripada "150 detik". */
function lama(detik: number): { nilai: string; satuan: string } {
  if (detik < 60) return { nilai: String(detik), satuan: "detik" };
  const menit = Math.floor(detik / 60);
  const sisa = detik % 60;
  return {
    nilai: sisa === 0 ? String(menit) : `${menit}.${String(sisa).padStart(2, "0")}`,
    satuan: "menit",
  };
}

export default async function Dasbor() {
  const pengaturan = await pengaturan_ringkas();
  const [{ daftar, sumber }, hitungan] = await Promise.all([
    ambil_percakapan(),
    ambil_ringkasan_nyata(pengaturan?.zona_waktu ?? "Asia/Makassar"),
  ]);

  // Angka nyata kalau database tersambung, angka contoh kalau belum.
  // Sengaja tidak dicampur, supaya tidak ada layar yang setengah nyata.
  const angka = sumber === "supabase" ? hitungan : null;
  const nyata = angka !== null;
  const perlu_perhatian = daftar.filter((p) => p.status === "manual");

  const kuota = pengaturan?.kuota_pesan_harian ?? RINGKASAN.kuota_pesan_harian;
  const terpakai = angka?.pesan_keluar_hari_ini ?? 0;
  const balas = lama(angka?.waktu_balas_rata_detik ?? 0);
  const biaya_rp = (angka?.biaya_bulan_ini_dolar ?? 0) * kurs_dolar();

  const aktivitas = angka
    ? angka.aktivitas.map((a) => ({
        hari: a.label,
        masuk: a.masuk,
        ai: a.ai,
        // Sisanya ditangani manusia. Dihitung sebagai selisih, bukan diquery
        // sendiri, karena pesan keluar dari manusia bisa lebih banyak dari
        // pesan masuk dan grafik tumpukannya jadi melebihi batangnya.
        manusia: Math.max(0, a.masuk - a.ai),
      }))
    : AKTIVITAS_7_HARI;

  return (
    <>
      <BilahAtas
        judul="Ringkasan"
        keterangan="Kondisi admin WhatsApp kamu hari ini"
        aksi={
          nyata ? null : (
            <Lencana nada="tunggu" className="hidden lg:inline-flex">
              Data contoh
            </Lencana>
          )
        }
      />
      {nyata ? <Penyegar jeda_detik={30} /> : null}

      <main className="space-y-6 p-4 sm:p-6">
        {pengaturan ? <SpandukLayanan izin={pengaturan.izin} /> : null}

        <section
          aria-label="Angka utama"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KartuStatistik
            label="Pesan masuk hari ini"
            nilai={String(angka?.pesan_masuk_hari_ini ?? RINGKASAN.pesan_masuk_hari_ini)}
            ikon={MessagesSquare}
            nada="netral"
            catatan={`${angka?.kontak_baru_minggu_ini ?? 0} kontak baru minggu ini`}
          />
          <KartuStatistik
            label="Dijawab AI sendiri"
            nilai={String(angka?.dijawab_ai ?? RINGKASAN.dijawab_ai)}
            satuan={`dari ${angka?.pesan_masuk_hari_ini ?? 0}`}
            ikon={Bot}
            nada="sekunder"
            catatan="Kamu tidak perlu menyentuh percakapan ini"
          />
          <KartuStatistik
            label="Butuh kamu"
            nilai={String(angka?.butuh_kamu ?? RINGKASAN.butuh_kamu)}
            ikon={TriangleAlert}
            nada="gagal"
            catatan={
              angka && angka.draf_menunggu > 0
                ? `${angka.draf_menunggu} draf AI menunggu persetujuan`
                : "Percakapan yang AI serahkan ke kamu"
            }
          />
          <KartuStatistik
            label="Rata-rata balas"
            nilai={balas.nilai}
            satuan={balas.satuan}
            ikon={Clock}
            nada="netral"
            catatan={
              angka && angka.balasan_terhitung > 0
                ? `Dari ${angka.balasan_terhitung} balasan tujuh hari terakhir`
                : "Terisi setelah ada pesan masuk yang dibalas"
            }
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <Kartu className="self-start xl:col-span-2">
            <KepalaKartu
              judul="Tujuh hari terakhir"
              keterangan="Berapa pesan yang masuk, dan berapa yang lolos tanpa campur tangan kamu."
            />
            <GrafikAktivitas data={aktivitas} />
          </Kartu>

          <div className="space-y-6">
            <Kartu>
              <KepalaKartu
                judul="Kuota kirim hari ini"
                keterangan="Batas harian menjaga nomor tidak dianggap spam."
              />
              <div className="space-y-4 p-4">
                <BarBlok
                  nilai={terpakai}
                  maks={kuota}
                  nada={terpakai / kuota > 0.9 ? "gagal" : "aksen"}
                  label={`${terpakai} dari ${kuota} pesan keluar`}
                />
                <div className="pemisah-pixel" />
                <dl className="space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Status nomor</dt>
                    <dd>
                      <StatusNomor pengaturan={pengaturan} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Jam aktif</dt>
                    <dd className="angka text-teks">
                      {pengaturan
                        ? `${pengaturan.jam_mulai} sampai ${pengaturan.jam_selesai}`
                        : "08.00 sampai 20.00"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Biaya AI bulan ini</dt>
                    <dd className="angka text-teks">
                      $ {(angka?.biaya_bulan_ini_dolar ?? 0).toFixed(3)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-redup">Kira-kira rupiah</dt>
                    <dd className="angka text-teks">{rupiah(biaya_rp)}</dd>
                  </div>
                </dl>
                <Link href="/penggunaan" className="fokus-pixel block">
                  <Tombol varian="garis" ukuran="kecil" className="w-full">
                    <FileClock className="size-3.5" />
                    Rincian pemakaian
                  </Tombol>
                </Link>
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
                    beres: pengaturan?.tersambung === true,
                  },
                  {
                    label: "Isi layanan dan harga",
                    ke: "/pengetahuan",
                    ikon: Bot,
                    beres: (angka?.materi_aktif ?? 0) > 0,
                  },
                  {
                    label: "Impor kontak client",
                    ke: "/kontak",
                    ikon: UserPlus,
                    beres: (angka?.kontak_total ?? 0) > 0,
                  },
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
                      {l.beres ? <Lencana nada="sukses">Beres</Lencana> : null}
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

function StatusNomor({
  pengaturan,
}: {
  pengaturan: Awaited<ReturnType<typeof pengaturan_ringkas>>;
}) {
  if (!pengaturan) {
    return (
      <Lencana nada="tunggu">
        <TitikStatus nada="tunggu" hidup />
        Belum tersambung
      </Lencana>
    );
  }
  if (pengaturan.gateway !== "fonnte") {
    return (
      <Lencana nada="netral">
        <TitikStatus nada="netral" />
        Gateway tiruan
      </Lencana>
    );
  }
  if (pengaturan.tersambung === null) {
    return (
      <Lencana nada="tunggu">
        <TitikStatus nada="tunggu" hidup />
        Belum diperiksa
      </Lencana>
    );
  }
  return pengaturan.tersambung ? (
    <Lencana nada="sukses">
      <TitikStatus nada="sukses" />
      Tersambung
    </Lencana>
  ) : (
    <Lencana nada="gagal">
      <TitikStatus nada="gagal" hidup />
      Terputus
    </Lencana>
  );
}
