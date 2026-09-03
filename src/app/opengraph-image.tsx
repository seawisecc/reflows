import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { svg_logo, WARNA_LOGO } from "@/lib/merek";
import { alamat_aplikasi } from "@/lib/lingkungan";

/**
 * Gambar pratinjau saat tautan Reflows ditempel di WhatsApp, Slack, atau
 * mana pun yang membaca Open Graph.
 *
 * Fontnya dibaca dari berkas di repo, bukan diambil dari internet saat
 * permintaan datang, karena satu panggilan jaringan yang gagal berarti
 * gambarnya gagal terbit dan yang muncul cuma tautan telanjang.
 *
 * Semua ukuran font kelipatan delapan, mengikuti aturan yang sama dengan
 * antarmuka: Press Start 2P digambar di grid seperdelapan em, jadi ukuran
 * di luar kelipatan delapan membuat hurufnya berbulu.
 */
export const alt = "Reflows, otomasi admin WhatsApp untuk bisnis kecil";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LENCANA = ["BALASAN AI", "KAMPANYE", "INVOICE"];

export default async function GambarOpenGraph() {
  const pixel = await readFile(
    join(process.cwd(), "src/aset/press-start-2p.ttf"),
  );

  const logo = `data:image/svg+xml;utf8,${encodeURIComponent(svg_logo())}`;

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "64px",
          background: WARNA_LOGO.dasar,
          color: WARNA_LOGO.teks,
          fontFamily: "Pixel",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <img alt="" width={112} height={112} src={logo} />
          <div style={{ display: "flex", fontSize: 64 }}>REFLOWS</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", fontSize: 48 }}>BALAS CHAT CLIENT</div>
          <div style={{ display: "flex", fontSize: 48, color: WARNA_LOGO.masuk }}>
            OTOMATIS
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "12px",
              fontSize: 16,
              lineHeight: 1.6,
              color: WARNA_LOGO.redup,
            }}
          >
            <div style={{ display: "flex" }}>
              Kelola percakapan, kejar prospek, dan kirim
            </div>
            <div style={{ display: "flex" }}>
              invoice, semuanya lewat satu nomor WhatsApp.
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "16px" }}>
            {LENCANA.map((teks) => (
              <div
                key={teks}
                style={{
                  display: "flex",
                  padding: "12px 16px",
                  border: `2px solid ${WARNA_LOGO.garis}`,
                  fontSize: 16,
                  color: WARNA_LOGO.redup,
                }}
              >
                {teks}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 16, color: WARNA_LOGO.redup }}>
            {new URL(alamat_aplikasi()).host}
          </div>
        </div>

        {/* Pita dua warna di kaki gambar, warnanya sama dengan dua gelembung
            di logo: yang masuk dan yang dibalas. */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            display: "flex",
            width: "1200px",
            height: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "660px",
              height: "12px",
              background: WARNA_LOGO.masuk,
            }}
          />
          <div
            style={{
              display: "flex",
              width: "540px",
              height: "12px",
              background: WARNA_LOGO.balas,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Pixel", data: pixel, style: "normal", weight: 400 }],
    },
  );
}
