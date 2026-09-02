import { cn } from "@/lib/utils";

/**
 * Rangka isi sementara, dipakai berkas loading.tsx tiap halaman.
 *
 * Gunanya bukan hiasan. Tanpa loading.tsx, Next.js menahan halaman lama di
 * layar sampai halaman baru selesai disusun di server, sehingga klik menu
 * terasa tidak menghasilkan apa-apa selama satu detik lebih. Dengan rangka,
 * pindah halaman terasa langsung dan yang ditunggu cuma isinya.
 */
export function Rangka({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse border-2 border-garis bg-permukaan-2", className)}
    />
  );
}

export function RangkaHalaman({ baris = 3 }: { baris?: number }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b-2 border-garis bg-bg">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Rangka className="size-9 lg:hidden" />
          <div className="min-w-0 flex-1 space-y-2">
            <Rangka className="h-4 w-40" />
            <Rangka className="h-3 w-56" />
          </div>
        </div>
      </header>
      <main className="space-y-6 p-4 sm:p-6" role="status" aria-label="Memuat">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Rangka key={i} className="h-28" />
          ))}
        </div>
        {Array.from({ length: baris }, (_, i) => (
          <Rangka key={i} className="h-40" />
        ))}
      </main>
    </>
  );
}
