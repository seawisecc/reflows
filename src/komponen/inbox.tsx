"use client";

import * as React from "react";
import { Bot, Search, Send, TriangleAlert, User } from "lucide-react";
import type { Percakapan, StatusPercakapan } from "@/tipe";
import { cn, jam, waktu_relatif } from "@/lib/utils";
import { Lencana, TitikStatus, type NadaLencana } from "@/komponen/ui/lencana";
import { Bidang } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Kosong } from "@/komponen/ui/kosong";

const RUPA_STATUS: Record<
  StatusPercakapan,
  { label: string; nada: NadaLencana }
> = {
  ai: { label: "Ditangani AI", nada: "sekunder" },
  manual: { label: "Butuh kamu", nada: "gagal" },
  selesai: { label: "Selesai", nada: "netral" },
};

const SARINGAN = [
  { kunci: "semua", label: "Semua" },
  { kunci: "manual", label: "Butuh kamu" },
  { kunci: "ai", label: "AI" },
  { kunci: "selesai", label: "Selesai" },
] as const;

type Saringan = (typeof SARINGAN)[number]["kunci"];

export function Inbox({ percakapan }: { percakapan: Percakapan[] }) {
  const [saringan, setSaringan] = React.useState<Saringan>("semua");
  const [cari, setCari] = React.useState("");
  const [terpilih, setTerpilih] = React.useState<string>(
    percakapan.find((p) => p.status === "manual")?.id ?? percakapan[0]?.id ?? "",
  );

  const daftar = percakapan.filter((p) => {
    const cocok_saringan = saringan === "semua" || p.status === saringan;
    const kunci = cari.trim().toLowerCase();
    const cocok_cari =
      !kunci ||
      p.kontak.nama.toLowerCase().includes(kunci) ||
      p.kontak.nomor_wa.includes(kunci);
    return cocok_saringan && cocok_cari;
  });

  const aktif = percakapan.find((p) => p.id === terpilih) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* Daftar percakapan */}
      <div className="kotak kotak-tegas bayang-pixel flex max-h-[calc(100dvh-9rem)] flex-col">
        <div className="space-y-3 border-b-2 border-garis p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-redup" />
            <Bidang
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama atau nomor"
              className="pl-8"
              aria-label="Cari percakapan"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SARINGAN.map((s) => (
              <button
                key={s.kunci}
                type="button"
                onClick={() => setSaringan(s.kunci)}
                aria-pressed={saringan === s.kunci}
                className={cn(
                  "pixel-sm fokus-pixel border-2 px-2 py-1 uppercase",
                  saringan === s.kunci
                    ? "border-aksen-tinta bg-[var(--sorot)] text-teks"
                    : "border-garis text-redup hover:border-garis-tegas hover:text-teks",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 divide-y-2 divide-[var(--garis)] overflow-y-auto">
          {daftar.map((p) => {
            const dipilih = p.id === terpilih;
            const rupa = RUPA_STATUS[p.status];
            const terakhir = p.pesan[p.pesan.length - 1];
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setTerpilih(p.id)}
                  aria-current={dipilih ? "true" : undefined}
                  className={cn(
                    "fokus-pixel block w-full px-3 py-3 text-left",
                    dipilih
                      ? "border-l-4 border-l-aksen-tinta bg-[var(--sorot)]"
                      : "border-l-4 border-l-transparent hover:bg-permukaan-2",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <TitikStatus
                      nada={rupa.nada}
                      hidup={p.status === "manual"}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-teks">
                      {p.kontak.nama}
                    </span>
                    <span className="angka shrink-0 text-xs text-redup">
                      {waktu_relatif(p.pesan_terakhir_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-redup">
                    {terakhir?.pengirim === "ai" ? "AI: " : ""}
                    {terakhir?.isi}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Lencana nada={rupa.nada}>{rupa.label}</Lencana>
                    {p.belum_dibaca > 0 ? (
                      <Lencana nada="netral">{p.belum_dibaca} baru</Lencana>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
          {daftar.length === 0 ? (
            <li>
              <Kosong
                ikon={Search}
                judul="Tidak ada yang cocok"
                keterangan="Coba ganti kata kunci atau lepas saringannya."
              />
            </li>
          ) : null}
        </ul>
      </div>

      {/* Utas percakapan */}
      <div className="kotak kotak-tegas bayang-pixel flex max-h-[calc(100dvh-9rem)] min-h-96 flex-col">
        {aktif ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-garis p-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-teks">
                  {aktif.kontak.nama}
                </h2>
                <p className="angka mt-1.5 text-xs text-redup">
                  +{aktif.kontak.nomor_wa}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {aktif.kontak.tag.map((t) => (
                    <Lencana key={t} nada="netral">
                      {t}
                    </Lencana>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Lencana nada={RUPA_STATUS[aktif.status].nada}>
                  {RUPA_STATUS[aktif.status].label}
                </Lencana>
                <Tombol varian="garis" ukuran="kecil" disabled>
                  {aktif.status === "manual" ? "Kembalikan ke AI" : "Ambil alih"}
                </Tombol>
              </div>
            </div>

            {aktif.alasan_eskalasi ? (
              <div className="flex items-start gap-2.5 border-b-2 border-garis bg-permukaan-2 px-4 py-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-tunggu-tinta" />
                <p className="text-xs leading-relaxed text-redup">
                  <span className="pixel-sm uppercase text-tunggu-tinta">
                    AI berhenti bicara
                  </span>
                  <br />
                  {aktif.alasan_eskalasi}. Percakapan menunggu balasan kamu.
                </p>
              </div>
            ) : null}

            <ol className="flex-1 space-y-4 overflow-y-auto p-4">
              {aktif.pesan.map((m) => {
                const dari_kita = m.arah === "keluar";
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "flex flex-col gap-1.5",
                      dari_kita ? "items-end" : "items-start",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {m.pengirim === "ai" ? (
                        <Bot className="size-3.5 text-aksen-tinta" />
                      ) : m.pengirim === "manusia" ? (
                        <User className="size-3.5 text-sekunder-tinta" />
                      ) : null}
                      <span className="pixel-sm uppercase text-redup">
                        {m.pengirim === "ai"
                          ? "Reflows AI"
                          : m.pengirim === "manusia"
                            ? "Kamu"
                            : "Kontak"}
                      </span>
                      <span className="angka text-xs text-redup">
                        {jam(m.waktu)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "max-w-[42rem] border-2 px-3 py-2.5 text-sm leading-relaxed",
                        dari_kita
                          ? "border-garis-tegas bg-permukaan-2 text-teks"
                          : "border-garis bg-permukaan text-teks",
                      )}
                    >
                      {m.isi}
                    </div>
                    {typeof m.keyakinan === "number" ? (
                      <span className="pixel-sm uppercase text-redup">
                        Keyakinan {Math.round(m.keyakinan * 100)}%
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="border-t-2 border-garis p-3">
              <div className="flex items-end gap-2">
                <Bidang
                  placeholder="Ketik balasan, atau minta AI membuat draf"
                  disabled
                  aria-label="Balasan"
                />
                <Tombol ukuran="sedang" disabled className="shrink-0">
                  <Send className="size-3.5" />
                  Kirim
                </Tombol>
              </div>
              <p className="mt-2 text-xs text-redup">
                Pengiriman aktif setelah gateway WhatsApp tersambung di Fase 1.
              </p>
            </div>
          </>
        ) : (
          <Kosong
            judul="Pilih satu percakapan"
            keterangan="Daftar di sebelah kiri berisi semua chat yang masuk ke nomor bisnis kamu."
          />
        )}
      </div>
    </div>
  );
}
