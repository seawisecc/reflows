import { FormulirMasuk } from "./formulir";
import { Kartu } from "@/komponen/ui/kartu";
import { Logo } from "@/komponen/merek/logo";

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
          <Logo className="size-12" />
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
