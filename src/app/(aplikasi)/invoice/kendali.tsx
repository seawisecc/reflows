"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CircleCheck,
  Download,
  RefreshCw,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  hapus_invoice,
  kirim_invoice,
  tautan_pdf,
  terbitkan_ulang,
  ubah_status_invoice,
} from "./aksi";
import { Tombol } from "@/komponen/ui/tombol";
import type { StatusInvoice } from "@/tipe";

export function KendaliInvoice({
  id,
  status,
  sudah_dikirim,
  ada_pdf,
}: {
  id: string;
  status: StatusInvoice;
  sudah_dikirim: boolean;
  ada_pdf: boolean;
}) {
  const [menunggu, mulai] = React.useTransition();
  const [galat, setGalat] = React.useState<string | null>(null);
  const [pesan, setPesan] = React.useState<string | null>(null);
  const [konfirmasi_kirim, setKonfirmasiKirim] = React.useState(false);
  const [konfirmasi_hapus, setKonfirmasiHapus] = React.useState(false);
  const router = useRouter();

  const jalankan = (kerja: () => Promise<{ galat: string | null }>) =>
    mulai(async () => {
      setPesan(null);
      const h = await kerja();
      setGalat(h.galat);
    });

  // PDF-nya di bucket tertutup, jadi tautannya diminta saat diklik dan
  // berumur terbatas. Membuka tab baru dilakukan setelah tautannya ada,
  // supaya tidak ada tab kosong yang menganga kalau gagal.
  const buka_pdf = () =>
    mulai(async () => {
      setGalat(null);
      const { url } = await tautan_pdf(id);
      if (!url) {
        setGalat("PDF-nya belum ada. Coba terbitkan ulang dulu.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Tombol
          varian="garis"
          ukuran="kecil"
          disabled={menunggu || !ada_pdf}
          onClick={buka_pdf}
        >
          <Download className="size-3.5" />
          Lihat PDF
        </Tombol>

        {status !== "batal" ? (
          konfirmasi_kirim ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <Tombol
                ukuran="kecil"
                disabled={menunggu}
                onClick={() =>
                  mulai(async () => {
                    const h = await kirim_invoice(id);
                    setGalat(h.galat);
                    if (!h.galat) {
                      setPesan("Invoice terkirim lewat WhatsApp.");
                      setKonfirmasiKirim(false);
                    }
                  })
                }
              >
                <Send className="size-3.5" />
                {menunggu ? "Mengirim" : "Ya, kirim sekarang"}
              </Tombol>
              <Tombol
                varian="hantu"
                ukuran="kecil"
                onClick={() => setKonfirmasiKirim(false)}
              >
                Batal
              </Tombol>
            </span>
          ) : (
            <Tombol ukuran="kecil" onClick={() => setKonfirmasiKirim(true)}>
              <Send className="size-3.5" />
              {sudah_dikirim ? "Kirim ulang" : "Kirim ke WhatsApp"}
            </Tombol>
          )
        ) : null}

        {status !== "lunas" && status !== "batal" ? (
          <Tombol
            varian="garis"
            ukuran="kecil"
            disabled={menunggu}
            onClick={() => jalankan(() => ubah_status_invoice(id, "lunas"))}
          >
            <CircleCheck className="size-3.5" />
            Tandai lunas
          </Tombol>
        ) : null}

        {status === "lunas" ? (
          <Tombol
            varian="hantu"
            ukuran="kecil"
            disabled={menunggu}
            onClick={() => jalankan(() => ubah_status_invoice(id, "terkirim"))}
          >
            Batalkan tanda lunas
          </Tombol>
        ) : null}

        {status !== "batal" ? (
          <Tombol
            varian="hantu"
            ukuran="kecil"
            disabled={menunggu}
            onClick={() => jalankan(() => ubah_status_invoice(id, "batal"))}
          >
            <Ban className="size-3.5" />
            Batalkan
          </Tombol>
        ) : null}

        <Tombol
          varian="hantu"
          ukuran="kecil"
          disabled={menunggu}
          onClick={() => jalankan(() => terbitkan_ulang(id))}
        >
          <RefreshCw className="size-3.5" />
          Terbitkan ulang PDF
        </Tombol>

        {status === "draf" ? (
          konfirmasi_hapus ? (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={menunggu}
                onClick={() =>
                  mulai(async () => {
                    const h = await hapus_invoice(id);
                    if (h.galat) setGalat(h.galat);
                    else router.push("/invoice");
                  })
                }
                className="pixel-sm fokus-pixel border-2 border-gagal-tinta px-2 py-1.5 uppercase text-gagal-tinta"
              >
                {menunggu ? "..." : "Hapus permanen"}
              </button>
              <button
                type="button"
                onClick={() => setKonfirmasiHapus(false)}
                className="pixel-sm fokus-pixel border-2 border-garis px-2 py-1.5 uppercase text-redup"
              >
                Batal
              </button>
            </span>
          ) : (
            <Tombol
              varian="hantu"
              ukuran="kecil"
              onClick={() => setKonfirmasiHapus(true)}
            >
              <Trash2 className="size-3.5" />
              Hapus
            </Tombol>
          )
        ) : null}
      </div>

      {konfirmasi_kirim ? (
        <p className="text-xs leading-relaxed text-redup">
          PDF-nya dikirim ke nomor WhatsApp client beserta ringkasan tagihan,
          dan ikut tercatat di inbox supaya balasannya mendarat di utas yang
          sama.
        </p>
      ) : null}

      {galat ? (
        <p role="alert" className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {galat}
        </p>
      ) : pesan ? (
        <p role="status" className="flex items-start gap-2 text-xs text-sukses-tinta">
          <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
          {pesan}
        </p>
      ) : null}
    </div>
  );
}
