import { BilahSisi } from "@/komponen/shell/bilah-sisi";
import { PenyediaLaci } from "@/komponen/shell/laci";
import { profil_saya } from "@/lib/data/pengguna";

/**
 * Bilah sisi dirender di sini, bukan di dalam bilah atas tiap halaman.
 *
 * Layout Next.js tidak dirender ulang saat pindah antar halaman di
 * dalamnya, jadi profil pengguna dibaca sekali per muat penuh, bukan sekali
 * per klik menu. Sebelumnya tiap navigasi menunggu dua query ke Supabase
 * hanya untuk menggambar ulang menu yang isinya sama persis.
 */
export default async function LayoutAplikasi({
  children,
}: {
  children: React.ReactNode;
}) {
  const profil = await profil_saya();

  return (
    <PenyediaLaci>
      <BilahSisi
        nama_bisnis={profil?.tenant_nama ?? "Seawise Studio"}
        nama_pengguna={profil?.nama ?? null}
        email={profil?.email ?? null}
      />
      <div className="min-h-dvh lg:pl-60">{children}</div>
    </PenyediaLaci>
  );
}
