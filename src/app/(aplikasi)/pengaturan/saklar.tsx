"use client";

import * as React from "react";
import { Pause, Play, ShieldOff, TriangleAlert } from "lucide-react";
import { ubah_jeda } from "./aksi";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { lama_dijeda, type IzinLayanan } from "@/lib/layanan";

const YANG_TETAP_UTUH = [
  "Nomor WhatsApp dan token gatewaynya",
  "URL webhook, jadi tidak perlu ditempel ulang di Fonnte",
  "Materi admin beserta harga yang sudah kamu periksa",
  "Semua kontak, tag, dan daftar berhentinya",
  "Riwayat percakapan dan draf yang belum disetujui",
  "Kampanye beserta antrean sasarannya",
];

export function SaklarLayanan({
  izin,
  dijeda_at,
  alasan_jeda,
}: {
  izin: IzinLayanan;
  dijeda_at: string | null;
  alasan_jeda: string | null;
}) {
  const [menunggu, mulai] = React.useTransition();
  const [galat, setGalat] = React.useState<string | null>(null);
  const [alasan, setAlasan] = React.useState("");
  const [konfirmasi, setKonfirmasi] = React.useState(false);

  const hari = lama_dijeda(dijeda_at);

  // Suspensi dari Seawise tidak bisa dilepas dari sini, dan tombolnya
  // memang tidak ditampilkan. Menampilkan tombol yang pasti gagal cuma
  // membuat orang menekannya berkali-kali.
  if (izin.jenis === "disuspensi") {
    return (
      <Kartu>
        <KepalaKartu
          judul="Layanan disuspensi"
          keterangan="Semua pengiriman berhenti, termasuk yang kamu ketik sendiri."
          aksi={
            <Lencana nada="gagal">
              <TitikStatus nada="gagal" hidup />
              Disuspensi
            </Lencana>
          }
        />
        <IsiKartu className="space-y-3">
          <p className="flex items-start gap-2.5 text-xs leading-relaxed text-gagal-tinta">
            <ShieldOff className="mt-0.5 size-4 shrink-0" />
            {izin.sebab}
          </p>
          <div className="pemisah-pixel" />
          <p className="text-xs leading-relaxed text-redup">
            Datamu tidak dihapus apa pun. Begitu langganan diaktifkan lagi,
            semuanya kembali persis seperti sekarang. Hubungi Seawise Studio
            untuk mengaktifkannya.
          </p>
        </IsiKartu>
      </Kartu>
    );
  }

  const dijeda = izin.jenis === "dijeda";

  return (
    <Kartu className={dijeda ? "border-tunggu-tinta" : undefined}>
      <KepalaKartu
        judul={dijeda ? "Otomasi sedang dijeda" : "Jeda otomasi"}
        keterangan={
          dijeda
            ? "Chat yang masuk tetap tercatat. Yang berhenti cuma balasan AI dan kampanye."
            : "Matikan sementara tanpa kehilangan apa pun. Nyalakan lagi kapan saja."
        }
        aksi={
          <Lencana nada={dijeda ? "tunggu" : "sukses"}>
            <TitikStatus nada={dijeda ? "tunggu" : "sukses"} hidup={dijeda} />
            {dijeda ? "Dijeda" : "Berjalan"}
          </Lencana>
        }
      />
      <IsiKartu className="space-y-4">
        {dijeda ? (
          <>
            <dl className="space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-redup">Dijeda sejak</dt>
                <dd className="angka text-teks">
                  {dijeda_at
                    ? new Date(dijeda_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                  {hari !== null && hari > 0 ? `, ${hari} hari lalu` : ""}
                </dd>
              </div>
              {alasan_jeda ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-redup">Catatan</dt>
                  <dd className="text-right text-teks">{alasan_jeda}</dd>
                </div>
              ) : null}
            </dl>
            <Tombol
              disabled={menunggu}
              onClick={() =>
                mulai(async () => {
                  const h = await ubah_jeda(false);
                  setGalat(h.galat);
                })
              }
            >
              <Play className="size-3.5" />
              {menunggu ? "Menyalakan" : "Nyalakan lagi"}
            </Tombol>
            <p className="text-xs leading-relaxed text-redup">
              Begitu dinyalakan, AI langsung membalas chat berikutnya dan
              kampanye yang statusnya jalan melanjutkan antreannya dari
              tempat berhenti tadi.
            </p>
          </>
        ) : (
          <>
            <div>
              <p className="pixel-sm uppercase text-redup">Yang tetap utuh</p>
              <ul className="mt-2 space-y-1.5">
                {YANG_TETAP_UTUH.map((y) => (
                  <li
                    key={y}
                    className="flex items-start gap-2 text-xs leading-relaxed text-redup"
                  >
                    <span aria-hidden className="mt-1.5 size-1.5 shrink-0 bg-sukses-tinta" />
                    {y}
                  </li>
                ))}
              </ul>
            </div>

            {konfirmasi ? (
              <div className="space-y-3 border-2 border-tunggu-tinta bg-permukaan-2 p-3">
                <Kolom
                  label="Catatan, kalau perlu"
                  petunjuk="Cuma untuk kamu sendiri, misalnya alasan atau kapan mau dinyalakan lagi."
                >
                  <Bidang
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                    maxLength={200}
                    placeholder="Libur sampai akhir bulan"
                  />
                </Kolom>
                <div className="flex flex-wrap gap-2">
                  <Tombol
                    ukuran="kecil"
                    disabled={menunggu}
                    onClick={() =>
                      mulai(async () => {
                        const h = await ubah_jeda(true, alasan);
                        setGalat(h.galat);
                        if (!h.galat) setKonfirmasi(false);
                      })
                    }
                  >
                    <Pause className="size-3.5" />
                    {menunggu ? "Menjeda" : "Ya, jeda sekarang"}
                  </Tombol>
                  <Tombol
                    varian="hantu"
                    ukuran="kecil"
                    onClick={() => setKonfirmasi(false)}
                  >
                    Batal
                  </Tombol>
                </div>
              </div>
            ) : (
              <Tombol varian="garis" onClick={() => setKonfirmasi(true)}>
                <Pause className="size-3.5" />
                Jeda otomasi
              </Tombol>
            )}
          </>
        )}

        {galat ? (
          <p role="alert" className="flex items-start gap-2 text-xs text-gagal-tinta">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            {galat}
          </p>
        ) : null}
      </IsiKartu>
    </Kartu>
  );
}
