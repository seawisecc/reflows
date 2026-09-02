"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Pause,
  Play,
  Plus,
  Square,
  Trash2,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import {
  daftarkan_kontak,
  hapus_kampanye,
  hapus_langkah,
  tambah_langkah,
  ubah_status_kampanye,
} from "./aksi";
import { KAMPANYE_AWAL } from "./keadaan";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { AreaTeks, Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import type { StatusKampanye } from "@/tipe";

function Kabar({ galat, pesan }: { galat: string | null; pesan: string | null }) {
  if (galat) {
    return (
      <p role="alert" className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
        {galat}
      </p>
    );
  }
  if (pesan) {
    return (
      <p role="status" className="flex items-start gap-2 text-xs leading-relaxed text-sukses-tinta">
        <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
        {pesan}
      </p>
    );
  }
  return null;
}

export function KendaliKampanye({
  id,
  status,
}: {
  id: string;
  status: StatusKampanye;
}) {
  const [menunggu, mulai] = React.useTransition();
  const [galat, setGalat] = React.useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = React.useState(false);
  const router = useRouter();

  const ubah = (ke: "jalan" | "jeda" | "dihentikan") =>
    mulai(async () => {
      const h = await ubah_status_kampanye(id, ke);
      setGalat(h.galat);
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "jalan" ? (
          <Tombol varian="garis" ukuran="kecil" disabled={menunggu} onClick={() => ubah("jeda")}>
            <Pause className="size-3.5" />
            Jeda
          </Tombol>
        ) : status === "draf" || status === "jeda" ? (
          <Tombol ukuran="kecil" disabled={menunggu} onClick={() => ubah("jalan")}>
            <Play className="size-3.5" />
            {status === "draf" ? "Jalankan" : "Lanjutkan"}
          </Tombol>
        ) : null}

        {status !== "dihentikan" && status !== "selesai" ? (
          <Tombol
            varian="garis"
            ukuran="kecil"
            disabled={menunggu}
            onClick={() => ubah("dihentikan")}
          >
            <Square className="size-3.5" />
            Hentikan
          </Tombol>
        ) : null}

        {konfirmasi ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={menunggu}
              onClick={() =>
                mulai(async () => {
                  const h = await hapus_kampanye(id);
                  if (h.galat) setGalat(h.galat);
                  else router.push("/kampanye");
                })
              }
              className="pixel-sm fokus-pixel border-2 border-gagal-tinta px-2 py-1.5 uppercase text-gagal-tinta"
            >
              {menunggu ? "..." : "Hapus permanen"}
            </button>
            <button
              type="button"
              onClick={() => setKonfirmasi(false)}
              className="pixel-sm fokus-pixel border-2 border-garis px-2 py-1.5 uppercase text-redup"
            >
              Batal
            </button>
          </span>
        ) : (
          <Tombol varian="hantu" ukuran="kecil" onClick={() => setKonfirmasi(true)}>
            <Trash2 className="size-3.5" />
            Hapus
          </Tombol>
        )}
      </div>
      <Kabar galat={galat} pesan={null} />
    </div>
  );
}

export function PanelLangkah({
  kampanye_id,
  jumlah_langkah,
}: {
  kampanye_id: string;
  jumlah_langkah: number;
}) {
  const [keadaan, aksi, menunggu] = React.useActionState(
    tambah_langkah,
    KAMPANYE_AWAL,
  );
  const acuan = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (keadaan.pesan) acuan.current?.reset();
  }, [keadaan.pesan]);

  const pertama = jumlah_langkah === 0;

  return (
    <Kartu>
      <KepalaKartu
        judul={pertama ? "Langkah pertama" : `Langkah ${jumlah_langkah + 1}`}
        keterangan={
          pertama
            ? "Sapaan pembuka, dikirim begitu kontak masuk antrean."
            : "Dikirim beberapa hari setelah langkah sebelumnya, kalau kontaknya belum membalas."
        }
      />
      <IsiKartu>
        <form ref={acuan} action={aksi} className="space-y-4">
          <input type="hidden" name="kampanye_id" value={kampanye_id} />

          {!pertama ? (
            <Kolom label="Dikirim berapa hari setelah langkah sebelumnya">
              <Bidang
                name="tunda_hari"
                inputMode="numeric"
                defaultValue={3}
                className="max-w-32"
              />
            </Kolom>
          ) : null}

          <Kolom
            label="Kalimat"
            petunjuk="Satu baris satu varian. Tiap kontak dapat salah satunya, jadi tidak ada dua orang yang menerima teks identik. Pakai {{nama}} dan {{bisnis}}."
          >
            <AreaTeks
              name="varian"
              required
              className="min-h-32"
              placeholder={
                pertama
                  ? "Halo {{nama}}, saya dari {{bisnis}}. Kami bantu bisnis kecil bikin website. Boleh saya kirim contoh kerjanya?\nHalo {{nama}}, perkenalkan {{bisnis}}. Kami garap website untuk usaha kecil. Boleh saya kirimkan portofolionya?"
                  : "Halo {{nama}}, saya follow up soal website tadi. Masih relevan tidak?\n{{nama}}, saya kirim ulang ya. Kalau belum butuh sekarang juga tidak apa-apa."
              }
            />
          </Kolom>

          <div className="flex flex-wrap items-center gap-3">
            <Tombol type="submit" disabled={menunggu}>
              <Plus className="size-3.5" />
              {menunggu ? "Menyimpan" : "Tambah langkah"}
            </Tombol>
            <Kabar galat={keadaan.galat} pesan={keadaan.pesan} />
          </div>
        </form>
      </IsiKartu>
    </Kartu>
  );
}

export function TombolHapusLangkah({
  id,
  kampanye_id,
}: {
  id: string;
  kampanye_id: string;
}) {
  const [menunggu, mulai] = React.useTransition();
  return (
    <button
      type="button"
      disabled={menunggu}
      onClick={() => mulai(async () => void (await hapus_langkah(id, kampanye_id)))}
      aria-label="Hapus langkah"
      className="fokus-pixel text-redup hover:text-gagal-tinta disabled:opacity-40"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function PanelDaftarkan({
  kampanye_id,
  saringan_tag,
}: {
  kampanye_id: string;
  saringan_tag: string[];
}) {
  const [keadaan, aksi, menunggu] = React.useActionState(
    daftarkan_kontak,
    KAMPANYE_AWAL,
  );

  return (
    <form action={aksi} className="space-y-3">
      <input type="hidden" name="kampanye_id" value={kampanye_id} />
      <Tombol type="submit" varian="garis" ukuran="kecil" disabled={menunggu}>
        <UserPlus className="size-3.5" />
        {menunggu ? "Mendaftarkan" : "Masukkan kontak ke antrean"}
      </Tombol>
      <p className="text-xs leading-relaxed text-redup">
        {saringan_tag.length > 0
          ? `Yang masuk hanya kontak dengan semua tag: ${saringan_tag.join(", ")}.`
          : "Tanpa saringan tag, semua kontak ikut."}{" "}
        Kontak yang sudah minta berhenti tidak pernah ikut, dan yang sudah
        terdaftar tidak digandakan.
      </p>
      <Kabar galat={keadaan.galat} pesan={keadaan.pesan} />
    </form>
  );
}
