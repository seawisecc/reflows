import { headers } from "next/headers";
import { Link2, ShieldAlert } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana } from "@/komponen/ui/lencana";
import { ambil_pengaturan } from "@/lib/data/pengaturan";
import { FormulirPengaturan } from "./formulir";
import { PanelQr } from "./panel-qr";
import { UrlWebhook } from "./salin";

export const metadata = { title: "Pengaturan | Reflows" };
export const dynamic = "force-dynamic";

const ATURAN_ESKALASI = [
  "Kontak menanyakan harga atau layanan yang tidak ada di halaman Pengetahuan",
  "Kontak minta bicara dengan orang, misalnya menyebut admin atau minta ditelepon",
  "AI melaporkan keyakinan di bawah ambang batas",
  "Percakapan sudah lebih dari 6 giliran tanpa kesimpulan",
  "Terdeteksi kata sensitif: komplain, refund, batal, hukum, penipuan",
  "Pesan masuk di luar jam aktif",
];

/** Alamat asal, dipakai menyusun URL webhook yang ditempel ke gateway. */
async function asal(): Promise<string> {
  const h = await headers();
  const tuan_rumah = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protokol =
    h.get("x-forwarded-proto") ?? (tuan_rumah.startsWith("localhost") ? "http" : "https");
  return `${protokol}://${tuan_rumah}`;
}

export default async function HalamanPengaturan() {
  const pengaturan = await ambil_pengaturan(await asal());

  return (
    <>
      <BilahAtas
        judul="Pengaturan"
        keterangan="Koneksi WhatsApp, perilaku AI, dan aturan eskalasi"
      />
      <main className="space-y-6 p-4 sm:p-6">
        {!pengaturan ? (
          <Kartu>
            <Kosong
              judul="Pengaturan belum tersedia"
              keterangan="Database belum tersambung, atau tenant kamu belum punya baris pengaturan. Jalankan npm run siapkan-tenant lebih dulu."
            />
          </Kartu>
        ) : (
          <>
            <FormulirPengaturan awal={pengaturan} />

            <PanelQr awal={pengaturan} />

            {pengaturan.url_webhook ? (
              <Kartu>
                <KepalaKartu
                  judul="URL webhook"
                  keterangan="Tempel alamat ini di dasbor Fonnte, kolom Webhook URL, supaya pesan masuk sampai ke Reflows."
                  aksi={
                    <Lencana nada="tunggu">
                      <Link2 className="size-3" />
                      Setara kunci
                    </Lencana>
                  }
                />
                <IsiKartu className="space-y-3">
                  <UrlWebhook url={pengaturan.url_webhook} />
                  <p className="text-xs leading-relaxed text-redup">
                    Fonnte tidak menandatangani webhooknya, jadi rahasia di
                    dalam alamat inilah yang membuktikan pesan benar-benar
                    datang dari gateway kamu. Jangan ditempel di grup atau
                    dokumen bersama. Reflows juga mencocokkan nomor perangkat
                    sebagai lapisan kedua.
                  </p>
                </IsiKartu>
              </Kartu>
            ) : null}
          </>
        )}

        <Kartu>
          <KepalaKartu
            judul="Kapan AI menyerah ke kamu"
            keterangan="Begitu salah satu terpicu, AI berhenti bicara dan percakapan pindah ke antrean Butuh kamu."
          />
          <ul className="divide-y-2 divide-[var(--garis)]">
            {ATURAN_ESKALASI.map((a, i) => (
              <li key={a} className="flex items-start gap-3 px-4 py-3">
                <span className="pixel-sm grid size-6 shrink-0 place-items-center border-2 border-garis text-redup">
                  {i + 1}
                </span>
                <p className="flex-1 text-xs leading-relaxed text-teks">{a}</p>
                <Lencana nada="sukses">Aktif</Lencana>
              </li>
            ))}
          </ul>
          <IsiKartu className="border-t-2 border-garis">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-tunggu-tinta" />
              <p className="text-xs leading-relaxed text-redup">
                Aturan eskalasi belum bisa dimatikan satu per satu. Itu
                disengaja untuk sekarang: minimal satu harus aktif, kalau tidak
                tidak ada jalan keluar buat percakapan yang di luar kemampuan
                AI.
              </p>
            </div>
          </IsiKartu>
        </Kartu>
      </main>
    </>
  );
}
