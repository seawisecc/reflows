import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...kelas: ClassValue[]) {
  return twMerge(clsx(kelas));
}

const RUPIAH = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function rupiah(nilai: number) {
  return RUPIAH.format(nilai);
}

export function angka(nilai: number) {
  return new Intl.NumberFormat("id-ID").format(nilai);
}

/** "5 menit lalu", "2 jam lalu", "kemarin". Dipakai di daftar percakapan. */
export function waktu_relatif(iso: string, sekarang = new Date()) {
  const selisih_detik = Math.round(
    (sekarang.getTime() - new Date(iso).getTime()) / 1000,
  );
  if (selisih_detik < 60) return "baru saja";
  const menit = Math.floor(selisih_detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari === 1) return "kemarin";
  if (hari < 7) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export function jam(iso: string) {
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
