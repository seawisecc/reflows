import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Inter, JetBrains_Mono } from "next/font/google";
import { SKRIP_TEMA_AWAL, TEMA_BAWAAN } from "@/lib/tema";
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

export const metadata: Metadata = {
  title: "Reflows | Otomasi Admin WhatsApp",
  description:
    "Balas chat client otomatis, kelola percakapan, dan follow up calon client lewat WhatsApp.",
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
