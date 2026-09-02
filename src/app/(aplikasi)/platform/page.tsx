import { Building2, Coins, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { BilahAtas } from "@/komponen/shell/bilah-atas";
import { Kartu, KepalaKartu } from "@/komponen/ui/kartu";
import { Kosong } from "@/komponen/ui/kosong";
import { Lencana, TitikStatus, type NadaLencana } from "@/komponen/ui/lencana";
import { KartuStatistik } from "@/komponen/ui/statistik";
import { Tabel, KepalaTabel, Th, Tr, Td } from "@/komponen/ui/tabel";
import { ambil_ringkasan_platform } from "@/lib/data/platform";
import { profil_saya } from "@/lib/data/pengguna";
import { PAKET } from "@/lib/paket";
import { supabase_siap } from "@/lib/lingkungan";
import { rupiah, angka as ke_angka, waktu_relatif } from "@/lib/utils";
import type { JenisLayanan } from "@/lib/layanan";

export const metadata = { title: "Platform | Reflows" };
export const dynamic = "force-dynamic";

const RUPA_LAYANAN: Record<JenisLayanan, { label: string; nada: NadaLencana }> = {
  menyala: { label: "Berjalan", nada: "sukses" },
  dijeda: { label: "Dijeda", nada: "tunggu" },
  disuspensi: { label: "Disuspensi", nada: "gagal" },
};

export default async function HalamanPlatform() {
  if (!supabase_siap()) {
    return (
      <>
        <BilahAtas judul="Platform" keterangan="Pemakaian lintas pelanggan" />
        <main className="p-4 sm:p-6">
          <Kartu>
            <Kosong ikon={Building2} judul="Database belum tersambung" />
          </Kartu>
        </main>
      </>
    );
  }

  const [profil, ringkasan] = await Promise.all([
    profil_saya(),
    ambil_ringkasan_platform(),
  ]);
  const super_admin = profil?.super_admin === true;

  return (
    <>
      <BilahAtas
        judul="Platform"
        keterangan={
          super_admin
            ? `${ringkasan?.total.tenant ?? 0} tenant, ${ringkasan?.total.aktif ?? 0} berjalan`
            : "Pemakaian bisnis kamu sendiri"
        }
        aksi={
          <Lencana nada={super_admin ? "sekunder" : "netral"}>
            <ShieldCheck className="size-3" />
            {super_admin ? "Super admin" : "Akun biasa"}
          </Lencana>
        }
      />
      <main className="space-y-6 p-4 sm:p-6">
        {!super_admin ? (
          <Kartu className="p-4">
            <p className="text-xs leading-relaxed text-redup">
              Akun kamu bukan super admin, jadi yang tampil di bawah cuma
              bisnismu sendiri. Yang menyaring bukan halaman ini melainkan Row
              Level Security di database, jadi angka pelanggan lain memang
              tidak pernah sampai ke browser kamu. Untuk melihat semuanya,
              dibutuhkan akun administrasi platform yang terpisah dari akun
              harian.
            </p>
          </Kartu>
        ) : null}

        {ringkasan ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KartuStatistik
                label="Tagihan bulan ini"
                nilai={rupiah(ringkasan.total.tagihan)}
                ikon={Coins}
                nada="aksen"
                catatan="Langganan pokok ditambah kelebihan kuota"
              />
              <KartuStatistik
                label="Biaya AI"
                nilai={rupiah(ringkasan.total.biaya_ai)}
                ikon={TrendingUp}
                nada="netral"
                catatan="Token yang benar-benar terpakai, dari tabel jalan_ai"
              />
              <KartuStatistik
                label="Marjin kotor"
                nilai={rupiah(ringkasan.total.marjin)}
                ikon={TrendingUp}
                nada={ringkasan.total.marjin >= 0 ? "sekunder" : "gagal"}
                catatan="Belum dikurangi Supabase, Vercel, dan waktu manusia"
              />
              <KartuStatistik
                label="Balasan AI"
                nilai={ke_angka(ringkasan.total.balasan_ai)}
                ikon={Users}
                nada="netral"
                catatan="Seluruh tenant, bulan kalender berjalan"
              />
            </section>

            <Kartu>
              <KepalaKartu
                judul="Tenant"
                keterangan="Angka bulan berjalan. Tenant yang lama diam biasanya bukan tenant yang puas, tapi yang sudah berhenti memakai tanpa pernah bilang."
                aksi={<Lencana nada="netral">{ringkasan.tenant.length} baris</Lencana>}
              />
              {ringkasan.tenant.length === 0 ? (
                <Kosong ikon={Building2} judul="Belum ada tenant" />
              ) : (
                <Tabel>
                  <KepalaTabel>
                    <tr>
                      <Th>Tenant</Th>
                      <Th>Paket</Th>
                      <Th>Layanan</Th>
                      <Th className="text-right">Balasan AI</Th>
                      <Th className="text-right">Biaya AI</Th>
                      <Th className="text-right">Tagihan</Th>
                      <Th className="text-right">Marjin</Th>
                      <Th className="text-right">Terakhir aktif</Th>
                    </tr>
                  </KepalaTabel>
                  <tbody>
                    {ringkasan.tenant.map((t) => {
                      const rupa = RUPA_LAYANAN[t.jenis_layanan];
                      return (
                        <Tr key={t.id}>
                          <Td className="max-w-52 text-sm text-teks">
                            {t.nama}
                            <span className="mt-1 block text-xs text-redup">
                              {ke_angka(t.kontak)} kontak,{" "}
                              {ke_angka(t.butuh_manusia)} butuh manusia
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap text-xs text-redup">
                            {t.paket ? PAKET[t.paket].label : "belum diatur"}
                            {t.paket ? (
                              <span className="angka mt-1 block">
                                {ke_angka(t.balasan_ai)} / {ke_angka(t.kuota)}
                              </span>
                            ) : null}
                          </Td>
                          <Td>
                            <Lencana nada={rupa.nada}>
                              <TitikStatus
                                nada={rupa.nada}
                                hidup={t.jenis_layanan !== "menyala"}
                              />
                              {rupa.label}
                            </Lencana>
                          </Td>
                          <Td className="angka text-right text-xs text-teks">
                            {ke_angka(t.balasan_ai)}
                            {t.kelebihan > 0 ? (
                              <span className="mt-1 block text-tunggu-tinta">
                                +{ke_angka(t.kelebihan)} lewat
                              </span>
                            ) : null}
                          </Td>
                          <Td className="angka whitespace-nowrap text-right text-xs text-redup">
                            {rupiah(t.biaya_ai)}
                          </Td>
                          <Td className="angka whitespace-nowrap text-right text-xs text-teks">
                            {rupiah(t.tagihan)}
                          </Td>
                          <Td
                            className={
                              t.marjin >= 0
                                ? "angka whitespace-nowrap text-right text-xs font-bold text-sukses-tinta"
                                : "angka whitespace-nowrap text-right text-xs font-bold text-gagal-tinta"
                            }
                          >
                            {rupiah(t.marjin)}
                          </Td>
                          <Td className="angka whitespace-nowrap text-right text-xs text-redup">
                            {t.terakhir_aktif
                              ? waktu_relatif(t.terakhir_aktif)
                              : "belum pernah"}
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Tabel>
              )}
            </Kartu>
          </>
        ) : null}

        <Kartu className="p-4">
          <p className="text-xs leading-relaxed text-redup">
            Halaman ini hanya membaca. Sejak hak super admin diperketat,
            pemegangnya tidak bisa mengubah maupun menghapus baris tenant lain
            lewat sesi browser sama sekali. Untuk menyuspensi atau
            mengaktifkan tenant, jalurnya lewat{" "}
            <span className="angka">npm run tenant-aktif</span>, yang memakai
            service role dan memeriksa jumlah datanya sebelum dan sesudah.
          </p>
        </Kartu>
      </main>
    </>
  );
}
