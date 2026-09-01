import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Inbox } from "@/komponen/inbox";
import { PERCAKAPAN } from "@/lib/contoh-data";

export const metadata = { title: "Percakapan | Reflows" };

export default function HalamanPercakapan() {
  const butuh_kamu = PERCAKAPAN.filter((p) => p.status === "manual").length;

  return (
    <>
      <BilahAtas
        judul="Percakapan"
        keterangan={`${PERCAKAPAN.length} percakapan, ${butuh_kamu} menunggu kamu`}
      />
      <main className="p-4 sm:p-6">
        <Inbox percakapan={PERCAKAPAN} />
      </main>
    </>
  );
}
