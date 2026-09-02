import {
  BookOpen,
  Coins,
  LayoutDashboard,
  MessagesSquare,
  Receipt,
  Send,
  Settings,
  Users,
  Building2,
} from "lucide-react";

export type ItemNav = {
  href: string;
  label: string;
  ikon: React.ComponentType<{ className?: string }>;
  /** Belum digarap. Tetap ditampilkan supaya arah produk kelihatan. */
  nanti?: string;
};

export type GrupNav = { judul: string; item: ItemNav[] };

export const NAVIGASI: GrupNav[] = [
  {
    judul: "Kerja harian",
    item: [
      { href: "/dasbor", label: "Ringkasan", ikon: LayoutDashboard },
      { href: "/percakapan", label: "Percakapan", ikon: MessagesSquare },
      { href: "/kontak", label: "Kontak", ikon: Users },
      { href: "/kampanye", label: "Kampanye", ikon: Send },
      { href: "/invoice", label: "Invoice", ikon: Receipt },
    ],
  },
  {
    judul: "Otak AI",
    item: [
      { href: "/pengetahuan", label: "Pengetahuan", ikon: BookOpen },
      { href: "/pengaturan", label: "Pengaturan", ikon: Settings },
      { href: "/penggunaan", label: "Penggunaan", ikon: Coins },
    ],
  },
  {
    judul: "Platform",
    item: [{ href: "/platform", label: "Semua tenant", ikon: Building2 }],
  },
];
