import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Action bawaannya membatasi badan permintaan 1 MB, dan itu
    // kekecilan untuk unggahan PDF penawaran. Batas atasnya tetap dijaga
    // supaya berkas raksasa tidak membebani server.
    serverActions: { bodySizeLimit: "12mb" },
  },
  /* config options here */
};

export default nextConfig;
