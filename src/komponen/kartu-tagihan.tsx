import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana, type NadaLencana } from "@/komponen/ui/lencana";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { PAKET, paket_sah } from "@/lib/paket";
import { rupiah } from "@/lib/utils";
import type { TagihanLangganan } from "@/lib/data/tagihan";
import { Receipt } from "lucide-react";

const NADA: Record<TagihanLangganan["status"], NadaLencana> = {
  draf: "netral",
  terkirim: "tunggu",
  lunas: "sukses",
  batal: "netral",
};

const LABEL: Record<TagihanLangganan["status"], string> = {
  draf: "Draf",
  terkirim: "Belum dibayar",
  lunas: "Lunas",
  batal: "Batal",
};

/**
 * Tagihan langganan yang dilihat tenant.
 *
 * Angkanya dibaca dari baris tagihan, bukan dihitung ulang dari PAKET.
 * Tagihan adalah rekaman satu momen: menaikkan harga paket bulan depan
 * tidak boleh mengubah angka yang sudah pernah ditagih.
 */
export function KartuTagihan({ daftar }: { daftar: TagihanLangganan[] }) {
  const belum = daftar.filter((t) => t.status === "terkirim");
  const cara_bayar = belum.find((t) => t.bank_rekening);

  return (
    <Kartu>
      <KepalaKartu
        judul="Tagihan langganan"
        keterangan="Tagihan dari Seawise untuk langganan Reflows, bukan invoice ke client kamu. Pembayaran lewat transfer, lalu ditandai lunas oleh Seawise."
        aksi={
          belum.length > 0 ? (
            <Lencana nada="tunggu">
              {belum.length} belum dibayar
            </Lencana>
          ) : null
        }
      />

      {daftar.length === 0 ? (
        <Kosong
          ikon={Receipt}
          judul="Belum ada tagihan"
          keterangan="Tagihan disusun setelah bulannya lewat, dari jumlah balasan yang benar-benar terpakai."
        />
      ) : (
        <>
          {cara_bayar ? (
            <div className="border-b-2 border-garis bg-permukaan-2 px-4 py-3">
              <p className="pixel-sm uppercase text-redup">Transfer ke</p>
              <p className="angka mt-2 text-sm text-teks">
                {cara_bayar.bank_nama} {cara_bayar.bank_rekening}
              </p>
              {cara_bayar.bank_atas_nama ? (
                <p className="mt-1 text-xs text-redup">
                  atas nama {cara_bayar.bank_atas_nama}
                </p>
              ) : null}
            </div>
          ) : belum.length > 0 ? (
            <div className="border-b-2 border-garis bg-permukaan-2 px-4 py-3">
              <p className="text-xs leading-relaxed text-redup">
                Cara pembayaran belum tercantum di tagihan ini. Tanyakan ke
                Seawise sebelum mentransfer.
              </p>
            </div>
          ) : null}

          <Tabel>
            <KepalaTabel>
              <tr>
                <Th>Periode</Th>
                <Th>Paket</Th>
                <Th>Pemakaian</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
              </tr>
            </KepalaTabel>
            <tbody>
              {daftar.map((t) => (
                <Tr key={t.id}>
                  <Td>{t.label}</Td>
                  <Td>{paket_sah(t.paket) ? PAKET[t.paket].label : t.paket}</Td>
                  <Td>
                    <span className="angka">
                      {t.terpakai}/{t.kuota}
                    </span>
                    {t.kelebihan > 0 ? (
                      <span className="text-redup">
                        {" "}
                        lebih {t.kelebihan}, {rupiah(t.biaya_kelebihan)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right">
                    <span className="angka text-teks">{rupiah(t.total)}</span>
                  </Td>
                  <Td>
                    <Lencana nada={NADA[t.status]}>{LABEL[t.status]}</Lencana>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Tabel>
        </>
      )}
    </Kartu>
  );
}
