"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Plus, TriangleAlert } from "lucide-react";
import { buat_kampanye } from "./aksi";
import { KAMPANYE_AWAL } from "./keadaan";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";

export function PanelBuat({ tag }: { tag: { tag: string; jumlah: number }[] }) {
  const [keadaan, aksi, menunggu] = React.useActionState(
    buat_kampanye,
    KAMPANYE_AWAL,
  );
  const [buka, setBuka] = React.useState(false);
  const [terpilih, setTerpilih] = React.useState<string[]>([]);
  const router = useRouter();

  // Begitu kampanye jadi, langsung ke halaman detailnya. Kampanye kosong
  // tidak berguna sampai langkahnya diisi, jadi jangan biarkan orang
  // berhenti di daftar dan mengira sudah selesai.
  const [id_terakhir, setIdTerakhir] = React.useState<string | null>(null);
  if (keadaan.id && keadaan.id !== id_terakhir) {
    setIdTerakhir(keadaan.id);
    router.push(`/kampanye/${keadaan.id}`);
  }

  if (!buka) {
    return (
      <Kartu className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-redup">
            Kampanye mengirim sapaan bertahap ke daftar kontak, lalu berhenti
            sendiri begitu orangnya membalas.
          </p>
          <Tombol ukuran="kecil" onClick={() => setBuka(true)}>
            <Plus className="size-3.5" />
            Kampanye baru
          </Tombol>
        </div>
      </Kartu>
    );
  }

  return (
    <Kartu>
      <KepalaKartu
        judul="Kampanye baru"
        keterangan="Langkah dan daftar kontaknya diisi setelah ini."
        aksi={
          <Tombol varian="hantu" ukuran="kecil" onClick={() => setBuka(false)}>
            Tutup
          </Tombol>
        }
      />
      <IsiKartu>
        <form action={aksi} className="space-y-4">
          <Kolom label="Nama kampanye" petunjuk="Cuma untuk kamu, tidak pernah dilihat kontak.">
            <Bidang name="nama" required maxLength={120} placeholder="Prospek kuliner September" />
          </Kolom>

          <Kolom
            label="Saringan tag"
            petunjuk="Kontak harus punya SEMUA tag ini. Kosongkan berarti semua kontak ikut."
          >
            <Bidang
              name="saringan_tag"
              placeholder="prospek, kuliner"
              value={terpilih.join(", ")}
              onChange={(e) =>
                setTerpilih(
                  e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                )
              }
            />
          </Kolom>

          {tag.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tag.map((t) => {
                const aktif = terpilih.includes(t.tag);
                return (
                  <button
                    key={t.tag}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() =>
                      setTerpilih((lama) =>
                        aktif ? lama.filter((x) => x !== t.tag) : [...lama, t.tag],
                      )
                    }
                    className={
                      aktif
                        ? "pixel-sm fokus-pixel border-2 border-aksen-tinta bg-[var(--sorot)] px-2 py-1 uppercase text-teks"
                        : "pixel-sm fokus-pixel border-2 border-garis px-2 py-1 uppercase text-redup hover:border-garis-tegas hover:text-teks"
                    }
                  >
                    {t.tag} <span className="angka">{t.jumlah}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Kolom label="Jeda antar pesan" petunjuk="Detik. Minimal 30, dan yang dipakai diacak di antara keduanya.">
              <div className="flex items-center gap-2">
                <Bidang name="jeda_min_detik" inputMode="numeric" defaultValue={40} aria-label="Jeda minimal" />
                <span className="pixel-sm shrink-0 uppercase text-redup">sampai</span>
                <Bidang name="jeda_maks_detik" inputMode="numeric" defaultValue={120} aria-label="Jeda maksimal" />
              </div>
            </Kolom>
            <Kolom label="Batas harian" petunjuk="Mulai dari kecil lalu naik 30 persen sehari sampai batas atas.">
              <div className="flex items-center gap-2">
                <Bidang name="batas_harian_awal" inputMode="numeric" defaultValue={20} aria-label="Batas hari pertama" />
                <span className="pixel-sm shrink-0 uppercase text-redup">naik ke</span>
                <Bidang name="batas_harian_maks" inputMode="numeric" defaultValue={150} aria-label="Batas maksimal" />
              </div>
            </Kolom>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tombol type="submit" disabled={menunggu}>
              <Plus className="size-3.5" />
              {menunggu ? "Membuat" : "Buat kampanye"}
            </Tombol>
            <Lencana nada="tunggu">Belum mengirim apa pun sampai kamu jalankan</Lencana>
          </div>

          {keadaan.galat ? (
            <p role="alert" className="flex items-start gap-2 text-xs text-gagal-tinta">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {keadaan.galat}
            </p>
          ) : keadaan.pesan ? (
            <p role="status" className="flex items-start gap-2 text-xs text-sukses-tinta">
              <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
              {keadaan.pesan}
            </p>
          ) : null}
        </form>
      </IsiKartu>
    </Kartu>
  );
}
