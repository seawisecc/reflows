import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Inter, JetBrains_Mono } from "next/font/google";
import { SKRIP_TEMA_AWAL, TEMA_BAWAAN } from "@/lib/tema";
import { alamat_aplikasi } from "@/lib/lingkungan";
import "./globals.css";

const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-display",
  display: "swap",
});

const badan = Inter({
  subsets: ["latin"],
  variable: "--font-badan",
  display: "swap",
});

const angka = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-angka",
  display: "swap",
});

const JUDUL = "Reflows | Otomasi Admin WhatsApp";
const KETERANGAN =
  "Balas chat client otomatis, kelola percakapan, dan follow up calon client lewat WhatsApp.";

export const metadata: Metadata = {
  /* Tanpa ini, gambar Open Graph ditulis sebagai jalur relatif dan tidak
     satu pun crawler bisa mengambilnya. */
  metadataBase: new URL(alamat_aplikasi()),
  applicationName: "Reflows",
  title: JUDUL,
  description: KETERANGAN,
  openGraph: {
    type: "website",
    siteName: "Reflows",
    locale: "id_ID",
    url: "/",
    title: JUDUL,
    description: KETERANGAN,
  },
  twitter: { card: "summary_large_image", title: JUDUL, description: KETERANGAN },
};

export const viewport: Viewport = {
  themeColor: "#0b1220",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      data-tema={TEMA_BAWAAN}
      className={`${pixel.variable} ${badan.variable} ${angka.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA_AWAL }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
