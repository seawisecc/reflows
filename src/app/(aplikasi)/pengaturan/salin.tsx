"use client";

import * as React from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

/**
 * Menampilkan URL webhook yang di dalamnya ada rahasia.
 *
 * Disembunyikan secara bawaan, karena layar ini sering dibuka saat ada orang
 * lain melihat, dan rahasia itu setara kunci: siapa pun yang memegangnya
 * bisa menyuntik pesan palsu ke inbox.
 */
export function UrlWebhook({ url }: { url: string }) {
  const [terlihat, setTerlihat] = React.useState(false);
  const [tersalin, setTersalin] = React.useState(false);

  async function salin() {
    try {
      await navigator.clipboard.writeText(url);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // Papan klip diblokir peramban. Pengguna masih bisa menyalin manual
      // setelah menekan tombol mata.
      setTerlihat(true);
    }
  }

  const tampil = terlihat
    ? url
    : url.replace(/\/api\/wa\/masuk\/.*/, "/api/wa/masuk/••••••••••••");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <code className="angka min-w-0 flex-1 overflow-x-auto border-2 border-garis bg-permukaan-2 px-3 py-2 text-xs text-teks">
          {tampil}
        </code>
        <button
          type="button"
          onClick={() => setTerlihat((v) => !v)}
          aria-label={terlihat ? "Sembunyikan" : "Tampilkan"}
          className="fokus-pixel inline-flex size-9 shrink-0 items-center justify-center border-2 border-garis text-redup hover:border-garis-tegas hover:text-teks"
        >
          {terlihat ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
        <button
          type="button"
          onClick={salin}
          aria-label="Salin URL webhook"
          className="fokus-pixel inline-flex size-9 shrink-0 items-center justify-center border-2 border-garis text-redup hover:border-garis-tegas hover:text-teks"
        >
          {tersalin ? (
            <Check className="size-4 text-sukses-tinta" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
      {tersalin ? (
        <p role="status" className="text-xs text-sukses-tinta">
          URL tersalin.
        </p>
      ) : null}
    </div>
  );
}
