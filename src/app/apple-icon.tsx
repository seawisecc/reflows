import { ImageResponse } from "next/og";
import { svg_logo, WARNA_LOGO } from "@/lib/merek";

/**
 * Ikon untuk iOS, yang tidak mau menerima SVG. Dirender jadi PNG dari
 * bentuk logo yang sama, jadi tidak ada berkas gambar kedua yang bisa
 * ketinggalan diperbarui.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IkonApple() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: WARNA_LOGO.dasar,
        }}
      >
        <img
          alt=""
          width={120}
          height={120}
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svg_logo())}`}
        />
      </div>
    ),
    size,
  );
}
