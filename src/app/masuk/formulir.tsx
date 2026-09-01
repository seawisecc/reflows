"use client";

import { useActionState } from "react";
import { TriangleAlert } from "lucide-react";
import { masuk, type KeadaanMasuk } from "./aksi";
import { Bidang, Kolom } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";

const AWAL: KeadaanMasuk = { galat: null };

export function FormulirMasuk({ lanjut }: { lanjut: string }) {
  const [keadaan, aksi, menunggu] = useActionState(masuk, AWAL);

  return (
    <form action={aksi} className="space-y-4">
      <input type="hidden" name="lanjut" value={lanjut} />

      <Kolom label="Email">
        <Bidang
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="nama@bisniskamu.com"
        />
      </Kolom>

      <Kolom label="Kata sandi">
        <Bidang
          name="sandi"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Kata sandi"
        />
      </Kolom>

      {keadaan.galat ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-2 border-gagal-tinta bg-permukaan-2 px-3 py-2.5 text-xs leading-relaxed text-gagal-tinta"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {keadaan.galat}
        </p>
      ) : null}

      <Tombol type="submit" disabled={menunggu} className="w-full">
        {menunggu ? "Sedang masuk" : "Masuk"}
      </Tombol>
    </form>
  );
}
