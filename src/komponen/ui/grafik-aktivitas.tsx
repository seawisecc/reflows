"use client";

import * as React from "react";
import { Table2, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type BarisAktivitas = {
  hari: string;
  masuk: number;
  ai: number;
  manusia: number;
};

const SERI = [
  {
    kunci: "ai" as const,
    label: "Dijawab AI",
    warna: "bg-seri-2",
    teks: "text-seri-2",
  },
  {
    kunci: "manusia" as const,
    label: "Ditangani kamu",
    warna: "bg-seri-1",
    teks: "text-seri-1",
  },
];

/**
 * Batang bertumpuk: satu batang per hari, dipecah jadi porsi AI dan porsi
 * manusia. Bentuk ini dipilih karena pertanyaannya ada dua sekaligus,
 * berapa total pesan hari itu dan berapa yang lolos tanpa campur tangan.
 *
 * Ujung batang sengaja kotak, bukan membulat seperti anjuran umum, karena
 * seluruh design system Reflows nol radius. Pemisah 2px antar segmen tetap
 * dipakai supaya batas tumpukan terbaca.
 */
export function GrafikAktivitas({ data }: { data: BarisAktivitas[] }) {
  const [tabel, setTabel] = React.useState(false);
  const [sorot, setSorot] = React.useState<number | null>(null);

  const puncak = Math.max(...data.map((d) => d.masuk), 1);
  const total = data.reduce(
    (a, d) => ({ masuk: a.masuk + d.masuk, ai: a.ai + d.ai, manusia: a.manusia + d.manusia }),
    { masuk: 0, ai: 0, manusia: 0 },
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* Legenda selalu ada untuk dua seri, identitas tidak pernah warna saja */}
        <ul className="flex flex-wrap items-center gap-4">
          {SERI.map((s) => (
            <li key={s.kunci} className="flex items-center gap-2">
              <span aria-hidden className={cn("size-3 shrink-0", s.warna)} />
              <span className="text-xs text-redup">{s.label}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setTabel((v) => !v)}
          className="pixel-sm fokus-pixel inline-flex items-center gap-2 border-2 border-garis px-2 py-1.5 uppercase text-redup hover:border-garis-tegas hover:text-teks"
        >
          {tabel ? (
            <BarChart3 className="size-3.5" />
          ) : (
            <Table2 className="size-3.5" />
          )}
          {tabel ? "Grafik" : "Tabel"}
        </button>
      </div>

      {tabel ? (
        <div className="overflow-x-auto px-4 pb-4">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b-2 border-garis">
              <tr>
                <th className="pixel-sm py-2 pr-4 font-normal uppercase text-redup">
                  Hari
                </th>
                <th className="pixel-sm py-2 pr-4 text-right font-normal uppercase text-redup">
                  Masuk
                </th>
                <th className="pixel-sm py-2 pr-4 text-right font-normal uppercase text-redup">
                  Dijawab AI
                </th>
                <th className="pixel-sm py-2 text-right font-normal uppercase text-redup">
                  Ditangani kamu
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.hari} className="border-b-2 border-garis last:border-b-0">
                  <td className="py-2 pr-4 text-xs">{d.hari}</td>
                  <td className="angka py-2 pr-4 text-right text-xs">{d.masuk}</td>
                  <td className="angka py-2 pr-4 text-right text-xs">{d.ai}</td>
                  <td className="angka py-2 text-right text-xs">{d.manusia}</td>
                </tr>
              ))}
              <tr>
                <td className="pixel-sm py-2 pr-4 uppercase text-redup">
                  Total
                </td>
                <td className="angka py-2 pr-4 text-right text-xs font-bold">
                  {total.masuk}
                </td>
                <td className="angka py-2 pr-4 text-right text-xs font-bold">
                  {total.ai}
                </td>
                <td className="angka py-2 text-right text-xs font-bold">
                  {total.manusia}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="flex h-52 items-end gap-2 sm:gap-3">
            {data.map((d, i) => {
              const tinggi_ai = (d.ai / puncak) * 100;
              const tinggi_manusia = (d.manusia / puncak) * 100;
              const aktif = sorot === i;
              return (
                <div
                  key={d.hari}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  onMouseEnter={() => setSorot(i)}
                  onMouseLeave={() => setSorot(null)}
                  onFocus={() => setSorot(i)}
                  onBlur={() => setSorot(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.hari}, ${d.masuk} pesan masuk, ${d.ai} dijawab AI, ${d.manusia} ditangani kamu`}
                >
                  {aktif ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2 flex justify-center">
                      <div className="kotak kotak-tegas bayang-pixel-kecil w-max min-w-32 space-y-1.5 p-2.5 text-left">
                        <p className="pixel-sm uppercase text-teks">
                          {d.hari}
                        </p>
                        {SERI.map((s) => (
                          <p
                            key={s.kunci}
                            className="flex items-center gap-2 whitespace-nowrap text-xs text-redup"
                          >
                            <span aria-hidden className={cn("size-2 shrink-0", s.warna)} />
                            {s.label}
                            <span className="angka ml-auto font-bold text-teks">
                              {d[s.kunci]}
                            </span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Label langsung di atas batang, jadi angka tidak bergantung warna */}
                  <p
                    className={cn(
                      "angka mb-1.5 text-center text-xs tabular-nums",
                      aktif ? "font-bold text-teks" : "text-redup",
                    )}
                  >
                    {d.masuk}
                  </p>
                  <div
                    className={cn(
                      "flex w-full flex-col justify-end border-2 border-garis bg-permukaan-2 p-0.5",
                      aktif && "border-garis-tegas",
                    )}
                    style={{ height: "calc(100% - 22px)" }}
                  >
                    {/* Jarak 2px antar segmen supaya batas tumpukan tetap terlihat */}
                    <div
                      className="w-full bg-seri-1"
                      style={{ height: `${tinggi_manusia}%` }}
                    />
                    <div className="h-0.5 w-full shrink-0 bg-permukaan-2" />
                    <div
                      className="w-full bg-seri-2"
                      style={{ height: `${tinggi_ai}%` }}
                    />
                  </div>
                  <p className="pixel-sm mt-2 text-center uppercase text-redup">
                    {d.hari}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
