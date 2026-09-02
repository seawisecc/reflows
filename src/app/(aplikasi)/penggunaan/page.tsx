import { Bot, BookOpen, Coins, Gauge, TriangleAlert } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { KartuStatistik } from "@/komponen/ui/statistik";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana } from "@/komponen/ui/lencana";
import { ambil_penggunaan, biaya_jenis } from "@/lib/data/penggunaan";
import { ambil_kuota } from "@/lib/data/kuota";
import { KartuKuota } from "@/komponen/kartu-kuota";
import { pengaturan_ringkas } from "@/lib/data/pengaturan";
import { kurs_dolar } from "@/lib/ai/biaya";
import { MODEL, model_sah } from "@/lib/ai/model";
import { angka as ke_angka, rupiah } from "@/lib/utils";

export const metadata = { title: "Penggunaan | Reflows" };
export const dynamic = "force-dynamic";

const HARI = 30;

function label_model(nama: string) {
  return model_sah(nama) ? MODEL[nama].label : nama;
}

export default async function HalamanPenggunaan() {
  const pengaturan = await pengaturan_ringkas();
  const [pakai, kuota] = await Promise.all([
    ambil_penggunaan(HARI, pengaturan?.zona_waktu ?? "Asia/Makassar"),
    ambil_kuota(),
  ]);
  const kurs = kurs_dolar();

  if (!pakai) {
    return (
      <>
        <BilahAtas judul="Penggunaan" keterangan="Pemakaian AI dan biayanya" />
        <main className="p-4 sm:p-6">
          <Kartu>
            <Kosong
              ikon={Coins}
              judul="Database belum tersambung"
              keterangan="Angka pemakaian dibaca dari catatan tiap panggilan AI, jadi butuh Supabase menyala."
            />
          </Kartu>
        </main>
      </>
    );
  }

  const per_balasan =
    pakai.panggilan > 0 ? pakai.biaya_dolar / pakai.panggilan : 0;
  // Sebulan ke depan diperkirakan dari laju sekarang, bukan dari rata-rata
  // seluruh periode. Kalau mesinnya baru menyala seminggu lalu, membagi
  // dengan tiga puluh hari membuat biayanya terlihat sepertiga dari nyatanya.
  const hari_terpakai = Math.max(1, pakai.per_hari.length);
  const proyeksi = (pakai.biaya_dolar / hari_terpakai) * 30;
  const total_token = pakai.per_model.reduce(
    (n, m) => n + m.token_masuk + m.token_keluar + m.token_cache_baca + m.token_cache_tulis,
    0,
  );
  const puncak = Math.max(1, ...pakai.per_hari.map((h) => h.panggilan));

  return (
    <>
      <BilahAtas
        judul="Penggunaan"
        keterangan={`Pemakaian AI ${HARI} hari terakhir dan biayanya`}
        aksi={
          <Lencana nada="netral" className="hidden lg:inline-flex">
            Kurs $1 = {rupiah(kurs)}
          </Lencana>
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        {kuota ? <KartuKuota kuota={kuota} /> : null}

        <section
          aria-label="Angka pemakaian"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <KartuStatistik
            label="Biaya AI"
            nilai={`$${pakai.biaya_dolar.toFixed(3)}`}
            ikon={Coins}
            nada="aksen"
            catatan={`Sekitar ${rupiah(pakai.biaya_dolar * kurs)} dalam ${HARI} hari`}
          />
          <KartuStatistik
            label="Balasan disusun AI"
            nilai={ke_angka(pakai.panggilan)}
            ikon={Bot}
            nada="sekunder"
            catatan={
              pakai.panggilan > 0
                ? `$${per_balasan.toFixed(4)} per balasan, sekitar ${rupiah(per_balasan * kurs)}`
                : "Belum ada panggilan AI di periode ini"
            }
          />
          <KartuStatistik
            label="Diserahkan ke kamu"
            nilai={ke_angka(pakai.eskalasi)}
            ikon={TriangleAlert}
            nada="gagal"
            catatan={
              pakai.panggilan > 0
                ? `${Math.round((pakai.eskalasi / pakai.panggilan) * 100)}% dari semua panggilan`
                : "AI belum pernah menyerah di periode ini"
            }
          />
          <KartuStatistik
            label="Waktu susun tengah"
            nilai={(pakai.latensi_tengah_ms / 1000).toFixed(1)}
            satuan="detik"
            ikon={Gauge}
            nada="netral"
            catatan={
              pakai.keyakinan_rata > 0
                ? `Keyakinan rata-rata ${Math.round(pakai.keyakinan_rata * 100)}%`
                : "Belum ada keyakinan tercatat"
            }
          />
        </section>

        <Kartu>
          <KepalaKartu
            judul="Dipakai untuk apa"
            keterangan="Dua-duanya memanggil Claude dan dua-duanya ditagih, tapi cuma balasan yang memakan kuota paket."
          />
          <div className="grid gap-px bg-[var(--garis)] sm:grid-cols-2">
            {(
              [
                {
                  jenis: "balasan" as const,
                  ikon: Bot,
                  judul: "Balasan ke client",
                  catatan: "Memakan kuota paket",
                },
                {
                  jenis: "impor" as const,
                  ikon: BookOpen,
                  judul: "Baca dokumen dan web",
                  catatan: "Tidak memakan kuota, tapi tetap ditagih",
                },
              ]
            ).map((b) => {
              const Ikon = b.ikon;
              const h = biaya_jenis(pakai.per_jenis, b.jenis);
              const porsi =
                pakai.biaya_dolar > 0
                  ? Math.round((h.biaya_dolar / pakai.biaya_dolar) * 100)
                  : 0;
              return (
                <div key={b.jenis} className="space-y-2 bg-permukaan p-4">
                  <div className="flex items-center gap-2">
                    <Ikon className="size-4 shrink-0 text-redup" />
                    <span className="pixel-sm uppercase text-redup">{b.judul}</span>
                  </div>
                  <p className="angka text-2xl font-bold text-teks">
                    ${h.biaya_dolar.toFixed(4)}
                    <span className="ml-2 text-sm font-normal text-redup">
                      {porsi}%
                    </span>
                  </p>
                  <p className="text-xs leading-relaxed text-redup">
                    {ke_angka(h.panggilan)} panggilan, {ke_angka(h.token)} token.{" "}
                    {b.catatan}.
                  </p>
                </div>
              );
            })}
          </div>
          <p className="border-t-2 border-garis px-4 py-3 text-xs leading-relaxed text-redup">
            Sebelum 2 September 2026, pembacaan dokumen tidak pernah dicatat
            sama sekali, jadi angka di halaman ini lebih kecil daripada
            tagihan sungguhan. Yang tercatat sebelum tanggal itu hanya
            balasan.
          </p>
        </Kartu>

        <Kartu>
          <KepalaKartu
            judul="Perkiraan sebulan penuh"
            keterangan="Dihitung dari laju hari-hari yang benar-benar ada pemakaiannya, bukan dibagi rata tiga puluh hari."
          />
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <div>
              <p className="pixel-sm uppercase text-redup">Biaya model</p>
              <p className="angka mt-2 text-2xl font-bold text-aksen-tinta">
                ${proyeksi.toFixed(2)}
              </p>
              <p className="mt-1.5 text-xs text-redup">{rupiah(proyeksi * kurs)}</p>
            </div>
            <div>
              <p className="pixel-sm uppercase text-redup">Token terpakai</p>
              <p className="angka mt-2 text-2xl font-bold text-teks">
                {ke_angka(total_token)}
              </p>
              <p className="mt-1.5 text-xs text-redup">
                masuk, keluar, dan cache digabung
              </p>
            </div>
            <div>
              <p className="pixel-sm uppercase text-redup">Hari ada pemakaian</p>
              <p className="angka mt-2 text-2xl font-bold text-teks">
                {pakai.per_hari.length}
              </p>
              <p className="mt-1.5 text-xs text-redup">dari {HARI} hari terakhir</p>
            </div>
          </div>
        </Kartu>

        <Kartu>
          <KepalaKartu
            judul="Rincian per model"
            keterangan="Token cache dihitung dengan tarifnya sendiri: menulis 1,25 kali harga token masuk, membaca 0,1 kali."
          />
          {pakai.per_model.length === 0 ? (
            <Kosong
              ikon={Bot}
              judul="Belum ada pemakaian"
              keterangan="Angka muncul begitu ada chat masuk yang dibalas AI."
            />
          ) : (
            <Tabel>
              <KepalaTabel>
                <tr>
                  <Th>Model</Th>
                  <Th className="text-right">Panggilan</Th>
                  <Th className="text-right">Token masuk</Th>
                  <Th className="text-right">Token keluar</Th>
                  <Th className="text-right">Cache baca</Th>
                  <Th className="text-right">Biaya</Th>
                </tr>
              </KepalaTabel>
              <tbody>
                {pakai.per_model.map((m) => (
                  <Tr key={m.model}>
                    <Td className="text-sm text-teks">{label_model(m.model)}</Td>
                    <Td className="angka text-right text-xs">{ke_angka(m.panggilan)}</Td>
                    <Td className="angka text-right text-xs">{ke_angka(m.token_masuk)}</Td>
                    <Td className="angka text-right text-xs">{ke_angka(m.token_keluar)}</Td>
                    <Td className="angka text-right text-xs text-redup">
                      {ke_angka(m.token_cache_baca)}
                    </Td>
                    <Td className="angka text-right text-xs font-bold text-aksen-tinta">
                      ${m.biaya_dolar.toFixed(4)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Tabel>
          )}
        </Kartu>

        <Kartu>
          <KepalaKartu
            judul="Per hari"
            keterangan="Batangnya sebanding dengan jumlah panggilan hari itu."
          />
          {pakai.per_hari.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-redup">
              Belum ada satu hari pun dengan pemakaian AI.
            </p>
          ) : (
            <ul className="divide-y-2 divide-[var(--garis)]">
              {[...pakai.per_hari].reverse().map((h) => (
                <li key={h.tanggal} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="angka w-24 shrink-0 text-xs text-redup">
                    {h.tanggal}
                  </span>
                  <span className="h-3 flex-1 border-2 border-garis bg-permukaan-2 p-0.5">
                    <span
                      aria-hidden
                      className="bar-blok block h-full text-seri-2"
                      style={{ width: `${(h.panggilan / puncak) * 100}%` }}
                    />
                  </span>
                  <span className="angka w-12 shrink-0 text-right text-xs text-teks">
                    {h.panggilan}
                  </span>
                  <span className="angka w-20 shrink-0 text-right text-xs text-redup">
                    ${h.biaya_dolar.toFixed(4)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Kartu>

        <Kartu className="p-4">
          <p className="text-xs leading-relaxed text-redup">
            Angka ini pemakaian tenant kamu sendiri, disaring Row Level
            Security seperti halaman lain. Rekap lintas pelanggan untuk
            penagihan langganan adalah pekerjaan Fase 5, dan butuh akun
            administrasi platform yang terpisah dari akun harian.
          </p>
        </Kartu>
      </main>
    </>
  );
}
