/**
 * Memeriksa apakah antrean kampanye benar-benar dipanggil.
 *
 * Jadwal yang terpasang tidak membuktikan apa pun. pg_cron mencatat tiap
 * kali jalan beserta hasilnya, dan itu satu-satunya cara tahu bahwa
 * panggilan HTTP-nya sampai, bukan gagal diam-diam karena rahasianya salah
 * atau domainnya tidak bisa dijangkau dari dalam database.
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

async function sql(ref: string, token: string, query: string) {
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
  if (!jawab.ok) throw new Error(`Supabase menolak: ${jawab.status} ${teks}`);
  return teks ? JSON.parse(teks) : null;
}

async function main() {
  const env = muat_env();
  const token = env.SUPABASE_ACCESS_TOKEN;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!token || !url) throw new Error("SUPABASE_ACCESS_TOKEN atau URL belum ada.");
  const ref = new URL(url).hostname.split(".")[0];

  const jadwal = await sql(
    ref,
    token,
    `select jobid, jobname, schedule, active from cron.job order by jobid`,
  );
  console.log("\nJadwal terpasang");
  console.table(jadwal);

  const riwayat = await sql(
    ref,
    token,
    `select status, return_message, start_time
       from cron.job_run_details
      order by start_time desc
      limit 10`,
  );
  console.log("\nSepuluh putaran terakhir");
  console.table(riwayat);

  // pg_net menaruh jawaban HTTP di tabel terpisah, dan di sinilah kelihatan
  // apakah jalur Next.js benar-benar menjawab 200 atau menolak 404 karena
  // rahasianya tidak cocok.
  const jawaban = await sql(
    ref,
    token,
    `select id, status_code, left(content, 200) as isi, created
       from net._http_response
      order by created desc
      limit 10`,
  );
  console.log("\nSepuluh jawaban HTTP terakhir");
  console.table(jawaban);
}

main().catch((e) => {
  console.error(`\nGagal memeriksa cron:\n${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
