import { z } from "zod";

/** Bentuk hasil ekstraksi yang diminta ke Claude. */
export const SkemaLayanan = z.object({
  judul: z.string().describe("Nama layanan, singkat, tanpa embel-embel promosi"),
  isi: z
    .string()
    .describe("Apa saja yang termasuk, dan berapa lama pengerjaannya kalau disebut"),
  harga: z
    .number()
    .nullable()
    .describe(
      "Harga dalam rupiah sebagai angka bulat tanpa titik. null kalau harganya tidak tertulis jelas di sumber. Jangan pernah menebak.",
    ),
});

export const SkemaFaq = z.object({
  judul: z.string().describe("Pertanyaannya, ditulis seperti cara orang bertanya"),
  isi: z.string().describe("Jawabannya, ringkas dan langsung"),
});

export const SkemaEkstraksi = z.object({
  layanan: z.array(SkemaLayanan),
  faq: z.array(SkemaFaq),
  catatan: z
    .array(z.string())
    .describe(
      "Hal penting yang bukan layanan dan bukan FAQ, misalnya syarat, batasan, atau larangan",
    ),
  kutipan: z
    .array(
      z.object({
        judul: z.string().describe("Tentang apa kutipan ini, tiga sampai enam kata"),
        isi: z
          .string()
          .describe(
            "Isinya apa adanya dari dokumen, dirapikan seperlunya tapi tanpa mengubah makna, angka, maupun syarat",
          ),
      }),
    )
    .describe(
      "Keterangan penting yang tidak muat sebagai layanan maupun FAQ, misalnya syarat pembayaran, jumlah revisi, cakupan garansi, alur kerja, atau jangkauan wilayah. Inilah yang membuat AI bisa menjawab pertanyaan di luar daftar harga.",
    ),
  keraguan: z
    .array(z.string())
    .describe(
      "Bagian yang tidak yakin terbaca benar, terutama angka harga yang ambigu. Kosongkan kalau semuanya jelas.",
    ),
});

export type HasilEkstraksi = z.infer<typeof SkemaEkstraksi>;
export type LayananTerbaca = z.infer<typeof SkemaLayanan>;
export type FaqTerbaca = z.infer<typeof SkemaFaq>;

export type JenisSumber = "pdf" | "web" | "tabel" | "teks";

export type Sumber = {
  jenis: JenisSumber;
  /** Nama berkas atau URL, ditampilkan ke pengguna sebagai asal materi. */
  label: string;
  /** Untuk PDF: berkas mentah. Untuk sisanya: teks yang sudah diekstrak. */
  teks?: string;
  pdf_base64?: string;
};
