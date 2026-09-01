import { Receipt } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";

export const metadata = { title: "Invoice | Reflows" };

export default function HalamanInvoice() {
  return (
    <>
      <BilahAtas judul="Invoice" keterangan="Generator invoice PDF, dijadwalkan Fase 4" />
      <main className="p-4 sm:p-6">
        <Kartu>
          <Kosong
            ikon={Receipt}
            judul="Belum digarap"
            keterangan="Invoice mengambil harga dari halaman Pengetahuan, lalu dikirim sebagai PDF lewat WhatsApp. Fitur ini menunggu gateway dan daftar layanan terisi lebih dulu."
          />
        </Kartu>
      </main>
    </>
  );
}
