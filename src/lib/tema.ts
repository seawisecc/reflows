export const TEMA = ["deep-reef", "sunset-arcade"] as const;

export type Tema = (typeof TEMA)[number];

export const TEMA_BAWAAN: Tema = "deep-reef";

export const KUNCI_TEMA = "reflows.tema";

export const LABEL_TEMA: Record<Tema, string> = {
  "deep-reef": "Deep Reef",
  "sunset-arcade": "Sunset Arcade",
};

export function tema_valid(nilai: unknown): nilai is Tema {
  return typeof nilai === "string" && (TEMA as readonly string[]).includes(nilai);
}

/**
 * Skrip yang disisipkan sebelum body dirender supaya tema tersimpan
 * dipasang lebih dulu. Tanpa ini, halaman berkedip dari tema bawaan
 * ke tema pilihan pengguna setiap kali dimuat.
 */
export const SKRIP_TEMA_AWAL = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  KUNCI_TEMA,
)});if(t!==${JSON.stringify(TEMA[0])}&&t!==${JSON.stringify(
  TEMA[1],
)})t=${JSON.stringify(
  TEMA_BAWAAN,
)};document.documentElement.setAttribute("data-tema",t);}catch(e){}})();`;
