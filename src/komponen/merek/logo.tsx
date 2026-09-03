import { BENTUK_BALAS, BENTUK_MASUK, PETAK_LOGO } from "@/lib/merek";
import { cn } from "@/lib/utils";

/**
 * Lambang Reflows untuk dipakai di dalam aplikasi.
 *
 * Warnanya lewat CSS variable, bukan nilai tetap, supaya logonya ikut
 * berganti saat tema diganti: teal dan biru di Deep Reef, oranye dan ungu
 * di Sunset Arcade. Versi warna tetapnya ada di svg_logo(), yang dipakai
 * favicon dan gambar Open Graph.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${PETAK_LOGO} ${PETAK_LOGO}`}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
    >
      {BENTUK_MASUK.map((p, i) => (
        <rect
          key={`masuk-${i}`}
          x={p.x}
          y={p.y}
          width={p.lebar}
          height={p.tinggi}
          fill="var(--aksen)"
        />
      ))}
      {BENTUK_BALAS.map((p, i) => (
        <rect
          key={`balas-${i}`}
          x={p.x}
          y={p.y}
          width={p.lebar}
          height={p.tinggi}
          fill="var(--sekunder)"
        />
      ))}
    </svg>
  );
}
