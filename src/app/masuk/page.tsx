import { FormulirMasuk } from "./formulir";
import { Kartu } from "@/komponen/ui/kartu";

export const metadata = { title: "Masuk | Reflows" };

export default async function HalamanMasuk({
  searchParams,
}: {
  searchParams: Promise<{ lanjut?: string }>;
}) {
  const { lanjut } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center border-2 border-aksen bg-aksen text-aksen-teks"
          >
            <span className="pixel-lg leading-none">R</span>
          </span>
          <div>
            <h1 className="pixel-lg uppercase text-teks">Reflows</h1>
            <p className="mt-1 text-xs text-redup">Otomasi admin WhatsApp</p>
          </div>
        </div>

        <Kartu className="p-5">
          <FormulirMasuk lanjut={lanjut ?? "/dasbor"} />
        </Kartu>

        <p className="text-center text-xs leading-relaxed text-redup">
          Akun dibuatkan pemilik Reflows. Belum ada pendaftaran mandiri,
          karena tiap akun terikat ke satu bisnis.
        </p>
      </div>
    </main>
  );
}
