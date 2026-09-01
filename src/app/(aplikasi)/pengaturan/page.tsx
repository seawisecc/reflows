import { Bot, Plug, ShieldAlert } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { Bidang, Kolom, Pilih, AreaTeks } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana, TitikStatus } from "@/komponen/ui/lencana";

export const metadata = { title: "Pengaturan | Reflows" };

const ATURAN_ESKALASI = [
  "Kontak menanyakan harga atau layanan yang tidak ada di halaman Pengetahuan",
  "Kontak minta bicara dengan orang, misalnya menyebut admin atau minta ditelepon",
  "AI melaporkan keyakinan di bawah ambang batas",
  "Percakapan sudah lebih dari 6 giliran tanpa kesimpulan",
  "Terdeteksi kata sensitif: komplain, refund, batal, hukum, penipuan",
  "Pesan masuk di luar jam aktif",
];

export default function HalamanPengaturan() {
  return (
    <>
      <BilahAtas
        judul="Pengaturan"
        keterangan="Koneksi WhatsApp, perilaku AI, dan aturan eskalasi"
      />
      <main className="grid gap-6 p-4 sm:p-6 xl:grid-cols-2">
        <Kartu>
          <KepalaKartu
            judul="Koneksi WhatsApp"
            keterangan="Reflows tidak menyimpan nomor kamu di luar tenant ini. Token gateway dienkripsi sebelum masuk database."
            aksi={
              <Lencana nada="tunggu">
                <TitikStatus nada="tunggu" hidup />
                Belum tersambung
              </Lencana>
            }
          />
          <IsiKartu className="space-y-4">
            <Kolom label="Penyedia gateway">
              <Pilih defaultValue="fonnte" disabled>
                <option value="fonnte">Fonnte</option>
                <option value="mock">Mock, untuk pengujian tanpa kirim</option>
                <option value="meta">WhatsApp Business API resmi</option>
              </Pilih>
            </Kolom>
            <Kolom
              label="Token gateway"
              petunjuk="Ambil dari dasbor Fonnte, menu Device. Token ini setara kunci nomor kamu, jangan dibagikan."
            >
              <Bidang type="password" placeholder="Belum diisi" disabled />
            </Kolom>
            <Kolom
              label="Nomor pengirim"
              petunjuk="Pakai nomor baru khusus Reflows dulu. Nomor bisnis asli disambungkan setelah terbukti stabil."
            >
              <Bidang placeholder="62812xxxxxxx" disabled />
            </Kolom>
            <div className="flex flex-wrap gap-2 pt-1">
              <Tombol disabled>
                <Plug className="size-3.5" />
                Sambungkan
              </Tombol>
              <Tombol varian="garis" disabled>
                Uji kirim
              </Tombol>
            </div>
          </IsiKartu>
        </Kartu>

        <Kartu>
          <KepalaKartu
            judul="Perilaku AI"
            keterangan="Mode hybrid membuat AI mengirim sendiri hanya saat yakin, sisanya jadi draf yang menunggu kamu."
            aksi={
              <Lencana nada="aksen">
                <Bot className="size-3" />
                Hybrid
              </Lencana>
            }
          />
          <IsiKartu className="space-y-4">
            <Kolom label="Mode balas">
              <Pilih defaultValue="hybrid" disabled>
                <option value="hybrid">
                  Hybrid, kirim sendiri kalau yakin
                </option>
                <option value="draf">Draf dulu, semua menunggu persetujuan</option>
                <option value="otomatis">Otomatis penuh</option>
              </Pilih>
            </Kolom>
            <Kolom
              label="Ambang keyakinan"
              petunjuk="Di bawah angka ini, balasan tidak dikirim tapi masuk antrean draf. Mulai dari 85 lalu turunkan pelan setelah kamu percaya hasilnya."
            >
              <Bidang type="number" defaultValue={85} min={50} max={100} disabled />
            </Kolom>
            <div className="grid gap-4 sm:grid-cols-2">
              <Kolom label="Jam aktif mulai">
                <Bidang type="time" defaultValue="08:00" disabled />
              </Kolom>
              <Kolom label="Jam aktif selesai">
                <Bidang type="time" defaultValue="20:00" disabled />
              </Kolom>
            </div>
            <Kolom
              label="Pesan di luar jam aktif"
              petunjuk="Dikirim sekali per percakapan supaya kontak tidak merasa diabaikan."
            >
              <AreaTeks
                disabled
                defaultValue="Terima kasih sudah menghubungi Seawise Studio. Saat ini di luar jam kerja kami. Pesan Bapak atau Ibu sudah kami catat dan akan dibalas besok pagi mulai pukul 08.00."
              />
            </Kolom>
          </IsiKartu>
        </Kartu>

        <Kartu className="xl:col-span-2">
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
                Aturan eskalasi tidak bisa dimatikan semuanya. Minimal satu
                harus aktif, kalau tidak tidak ada jalan keluar buat percakapan
                yang di luar kemampuan AI.
              </p>
            </div>
          </IsiKartu>
        </Kartu>
      </main>
    </>
  );
}
