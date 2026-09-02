import { MessagesSquare } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Inbox } from "@/komponen/inbox";
import { Penyegar } from "@/komponen/penyegar";
import { Kartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";
import { ambil_percakapan } from "@/lib/data/percakapan";

export const metadata = { title: "Percakapan | Reflows" };

/** Percakapan berubah setiap ada pesan masuk, jadi jangan disimpan cache. */
export const dynamic = "force-dynamic";

export default async function HalamanPercakapan() {
  const { daftar, sumber } = await ambil_percakapan();
  const butuh_kamu = daftar.filter((p) => p.status === "manual").length;

  return (
    <>
      <BilahAtas
        judul="Percakapan"
        keterangan={
          daftar.length === 0
            ? "Belum ada percakapan"
            : `${daftar.length} percakapan, ${butuh_kamu} menunggu kamu`
        }
        aksi={
          sumber === "contoh" ? (
            <Lencana nada="tunggu" className="hidden lg:inline-flex">
              Data contoh
            </Lencana>
          ) : (
            <Lencana nada="netral" className="hidden lg:inline-flex">
              <TitikStatus nada="sukses" hidup />
              Menyegar tiap 15 detik
            </Lencana>
          )
        }
      />
      {/* Chat client datang lewat webhook, bukan lewat klik, jadi halaman
          harus menarik sendiri. Tanpa ini pesan baru cuma muncul kalau
          pemiliknya kebetulan menekan muat ulang. */}
      {sumber === "supabase" ? <Penyegar jeda_detik={15} /> : null}
      <main className="p-4 sm:p-6">
        {daftar.length === 0 ? (
          <Kartu>
            <Kosong
              ikon={MessagesSquare}
              judul="Belum ada pesan masuk"
              keterangan="Percakapan muncul sendiri di sini begitu ada yang chat ke nomor WhatsApp bisnis kamu. Sambungkan nomornya dulu di halaman Pengaturan."
            />
          </Kartu>
        ) : (
          <Inbox percakapan={daftar} bisa_kirim={sumber === "supabase"} />
        )}
      </main>
    </>
  );
}
