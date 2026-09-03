"use client";

import { BENTUK_BALAS, BENTUK_MASUK, PETAK_LOGO, WARNA_LOGO } from "@/lib/merek";

/**
 * Jaring terakhir: galat yang terjadi di layout akar sendiri.
 *
 * Layout akar tidak ikut dirender di sini, jadi globals.css, font, dan
 * skrip pemilih tema semuanya tidak ada. Karena itu semua gaya di berkas
 * ini ditulis lurus sebagai style, bukan kelas Tailwind, dan warnanya
 * dipatok ke Deep Reef yang memang tema bawaan. Berkas yang bergantung
 * pada apa pun akan gagal justru di saat ia paling dibutuhkan. Lambangnya
 * pun digambar langsung di sini, bukan lewat komponen Logo, karena Logo
 * mewarnai dirinya dengan CSS variable yang saat ini tidak ada.
 */
export default function GalatMenyeluruh({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const monospace = "ui-monospace, SFMono-Regular, Menlo, monospace";

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "16px",
          background: WARNA_LOGO.dasar,
          color: WARNA_LOGO.teks,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            border: `2px solid ${WARNA_LOGO.garis}`,
            background: "#111b2e",
            boxShadow: `6px 6px 0 0 #04070d`,
            padding: "24px",
            textAlign: "center",
          }}
        >
          <svg
            viewBox={`0 0 ${PETAK_LOGO} ${PETAK_LOGO}`}
            width={40}
            height={40}
            shapeRendering="crispEdges"
            aria-hidden
            style={{ display: "block", margin: "0 auto" }}
          >
            {BENTUK_MASUK.map((kotak, i) => (
              <rect
                key={`masuk-${i}`}
                x={kotak.x}
                y={kotak.y}
                width={kotak.lebar}
                height={kotak.tinggi}
                fill={WARNA_LOGO.masuk}
              />
            ))}
            {BENTUK_BALAS.map((kotak, i) => (
              <rect
                key={`balas-${i}`}
                x={kotak.x}
                y={kotak.y}
                width={kotak.lebar}
                height={kotak.tinggi}
                fill={WARNA_LOGO.balas}
              />
            ))}
          </svg>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: "16px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Reflows berhenti
          </p>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: "13px",
              lineHeight: 1.7,
              color: WARNA_LOGO.redup,
            }}
          >
            Aplikasinya gagal dimuat dari akar. Data kamu tidak tersentuh:
            pesan yang masuk tetap tercatat dan tidak ada yang terkirim gara-gara
            ini. Muat ulang halamannya.
          </p>

          {error.digest ? (
            <p
              style={{
                margin: "16px 0 0",
                border: `2px solid ${WARNA_LOGO.garis}`,
                background: "#16233c",
                padding: "8px 12px",
                fontFamily: monospace,
                fontSize: "12px",
                wordBreak: "break-all",
                color: WARNA_LOGO.redup,
              }}
            >
              {error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              border: `2px solid ${WARNA_LOGO.masuk}`,
              background: WARNA_LOGO.masuk,
              color: "#04211c",
              padding: "10px 20px",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              cursor: "pointer",
              boxShadow: `3px 3px 0 0 #04070d`,
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
