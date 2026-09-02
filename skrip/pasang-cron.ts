/**
 * Memasang penjadwal antrean kampanye di Supabase.
 *
 * Antrean butuh dipanggil sekali per menit. Penjadwalnya sengaja tinggal di
 * Supabase lewat pg_cron, bukan Vercel Cron, karena dua alasan: antrean
 * tidak boleh ikut mati kalau paket Vercel berubah, dan menaruh penjadwal
 * di sebelah datanya membuat satu hal lebih sedikit yang bisa lepas tanpa
 * ketahuan.
 *
 * Yang dipanggil tetap jalur Next.js biasa, bukan Edge Function. Aturan
 * anti-ban, adapter gateway, dan normalisasi nomor sudah ditulis sekali di
 * src/lib. Menyalinnya ke Deno berarti suatu saat dua salinan itu berbeda,
 * dan yang berbeda adalah remnya.
 *
 * Aman dijalankan berulang kali: jadwal lama dicabut dulu sebelum dipasang.
 */
import { readFileSync } from "node:fs";

function muat_env(berkas = ".env.local"): Record<string, string> {
  const isi: Record<string, string> = {};
  for (const baris of readFileSync(berkas, "utf8").split("\n")) {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith("#")) continue;
    const pisah = bersih.indexOf("=");
    if (pisah === -1) continue;
    isi[bersih.slice(0, pisah)] = bersih.slice(pisah + 1).trim();
  }
  return isi;
}

const NAMA_JADWAL = "reflows-antrean-kampanye";
const NAMA_RAHASIA = "reflows_rahasia_cron";

/** Menutupi rahasia di keluaran layar, karena skrip ini sering di-screenshot. */
function samar(nilai: string): string {
  return nilai.length <= 8 ? "..." : `${nilai.slice(0, 4)}...${nilai.slice(-4)}`;
}

async function jalankan_sql(
  ref: string,
  token: string,
  query: string,
): Promise<unknown> {
  const jawab = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const teks = await jawab.text();
  if (!jawab.ok) {
    throw new Error(`Supabase menolak: ${jawab.status} ${teks}`);
  }
  return teks ? JSON.parse(teks) : null;
}

async function main() {
  const env = muat_env();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const rahasia = env.RAHASIA_CRON;
  const asal = process.env.URL_APLIKASI ?? "https://reflows.seawise.id";

  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN belum ada di .env.local.");
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL belum ada di .env.local.");
  if (!rahasia) {
    throw new Error(
      'RAHASIA_CRON belum ada di .env.local. Buat dengan:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
        "lalu pasang nilai yang sama di Vercel: vercel env add RAHASIA_CRON production",
    );
  }

  const ref = new URL(url).hostname.split(".")[0];
  const jalur = `${asal.replace(/\/+$/, "")}/api/kampanye/jalan`;

  console.log(`\nProject   ${ref}`);
  console.log(`Jalur     ${jalur}`);
  console.log(`Rahasia   ${samar(rahasia)}\n`);

  console.log("Memasang ekstensi pg_cron dan pg_net");
  await jalankan_sql(
    ref,
    token,
    `create extension if not exists pg_cron;
     create extension if not exists pg_net;`,
  );

  // Rahasia cron tidak boleh ikut tertulis di dalam definisi jadwal, karena
  // isi cron.job bisa dibaca siapa pun yang punya akses baca ke database.
  //
  // Disimpan di Supabase Vault, bukan sebagai pengaturan database. Peran
  // postgres di Supabase bukan superuser, jadi ALTER DATABASE SET ditolak.
  // Vault memang tempatnya, dan isinya tersandi di penyimpanan.
  console.log("Menyimpan rahasia di Supabase Vault");
  await jalankan_sql(
    ref,
    token,
    `delete from vault.secrets where name = '${NAMA_RAHASIA}';
     select vault.create_secret(
       '${rahasia.replace(/'/g, "''")}',
       '${NAMA_RAHASIA}',
       'Header penjaga jalur antrean kampanye Reflows'
     );`,
  );

  console.log("Mencabut jadwal lama kalau ada");
  await jalankan_sql(
    ref,
    token,
    `select cron.unschedule('${NAMA_JADWAL}')
       where exists (select 1 from cron.job where jobname = '${NAMA_JADWAL}');`,
  );

  console.log("Memasang jadwal per menit");
  await jalankan_sql(
    ref,
    token,
    `select cron.schedule(
       '${NAMA_JADWAL}',
       '* * * * *',
       $cron$
       select net.http_post(
         url := '${jalur}',
         headers := jsonb_build_object(
           'Content-Type', 'application/json',
           'x-rahasia-cron', (
             select decrypted_secret from vault.decrypted_secrets
              where name = '${NAMA_RAHASIA}'
           )
         ),
         body := '{}'::jsonb,
         timeout_milliseconds := 30000
       )
       $cron$
     );`,
  );

  const jadwal = await jalankan_sql(
    ref,
    token,
    `select jobid, jobname, schedule, active from cron.job where jobname = '${NAMA_JADWAL}'`,
  );
  console.log("\nJadwal terpasang:");
  console.log(jadwal);

  console.log(
    "\nPeriksa hasilnya beberapa menit lagi dengan:\n" +
      "  npm run periksa-cron\n",
  );
}

main().catch((e) => {
  console.error(`\nGagal memasang cron:\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
