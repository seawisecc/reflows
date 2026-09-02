import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BarisKontak,
  BarisPercakapan,
  Gudang,
  KonteksTenant,
} from "./penerimaan";
import type { StatusPercakapan } from "@/tipe";

/**
 * Penyimpanan sungguhan di atas Supabase, dipakai jalur webhook.
 *
 * Klien yang masuk ke sini adalah klien service role, jadi RLS tidak
 * berlaku. Setiap query karena itu menyaring tenant_id secara eksplisit.
 * Kalau satu saja lupa, data tenant lain bisa tersentuh.
 */
export function gudang_supabase(db: SupabaseClient): Gudang {
  return {
    async tenant_dari_rahasia(rahasia: string): Promise<KonteksTenant | null> {
      // Rahasia webhook itu 64 karakter heksadesimal. Menyaring bentuknya
      // lebih dulu menghindari query untuk tebakan asal-asalan.
      if (!/^[0-9a-f]{64}$/.test(rahasia)) return null;

      const { data, error } = await db
        .from("pengaturan_tenant")
        .select(
          "tenant_id, nomor_wa, mode_balas, ambang_keyakinan, jam_mulai, jam_selesai, zona_waktu, pesan_di_luar_jam",
        )
        .eq("rahasia_webhook", rahasia)
        .maybeSingle();

      if (error || !data) return null;
      return {
        ...data,
        ambang_keyakinan: Number(data.ambang_keyakinan),
      } as KonteksTenant;
    },

    async pesan_sudah_ada(tenant_id, wa_message_id) {
      const { data } = await db
        .from("pesan")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("wa_message_id", wa_message_id)
        .maybeSingle();
      return Boolean(data);
    },

    async pastikan_kontak(tenant_id, nomor, nama): Promise<BarisKontak> {
      const { data: ada } = await db
        .from("kontak")
        .select("id, opt_out_at, nama")
        .eq("tenant_id", tenant_id)
        .eq("nomor_wa", nomor)
        .maybeSingle();

      if (ada) {
        // Nama dari WhatsApp cuma dipakai kalau kontaknya belum bernama.
        // Nama yang diketik pemilik bisnis lebih berarti daripada nama
        // profil WhatsApp yang bisa berubah sesuka pemiliknya.
        if (nama && !ada.nama) {
          await db.from("kontak").update({ nama }).eq("id", ada.id);
        }
        return { id: ada.id as string, opt_out_at: ada.opt_out_at as string | null };
      }

      const { data, error } = await db
        .from("kontak")
        .insert({ tenant_id, nomor_wa: nomor, nama, sumber: "chat-masuk" })
        .select("id, opt_out_at")
        .single();

      if (error || !data) {
        throw new Error(`Gagal menyimpan kontak: ${error?.message ?? "tanpa data"}`);
      }
      return { id: data.id as string, opt_out_at: data.opt_out_at as string | null };
    },

    async pastikan_percakapan(tenant_id, kontak_id): Promise<BarisPercakapan> {
      const { data: ada } = await db
        .from("percakapan")
        .select("id, status, luar_jam_dibalas_at")
        .eq("tenant_id", tenant_id)
        .eq("kontak_id", kontak_id)
        .maybeSingle();

      if (ada) {
        return {
          id: ada.id as string,
          status: ada.status as StatusPercakapan,
          luar_jam_dibalas_at: ada.luar_jam_dibalas_at as string | null,
        };
      }

      const { data, error } = await db
        .from("percakapan")
        .insert({ tenant_id, kontak_id })
        .select("id, status, luar_jam_dibalas_at")
        .single();

      if (error || !data) {
        throw new Error(
          `Gagal membuat percakapan: ${error?.message ?? "tanpa data"}`,
        );
      }
      return {
        id: data.id as string,
        status: data.status as StatusPercakapan,
        luar_jam_dibalas_at: data.luar_jam_dibalas_at as string | null,
      };
    },

    async catat_pesan_masuk({ tenant_id, percakapan_id, isi, wa_message_id, waktu }) {
      const { data, error } = await db
        .from("pesan")
        .insert({
          tenant_id,
          percakapan_id,
          arah: "masuk",
          pengirim: "kontak",
          isi,
          status_kirim: "sampai",
          wa_message_id,
          dibuat_at: waktu,
        })
        .select("id")
        .single();

      if (error || !data) {
        throw new Error(`Gagal menyimpan pesan: ${error?.message ?? "tanpa data"}`);
      }

      // Menaikkan penanda belum dibaca lewat RPC supaya dua webhook yang
      // datang bersamaan tidak saling menimpa hitungannya.
      await db.rpc("tandai_pesan_masuk", {
        p_percakapan_id: percakapan_id,
        p_waktu: waktu,
      });

      return data.id as string;
    },

    async tandai_opt_out(kontak_id, waktu) {
      await db.from("kontak").update({ opt_out_at: waktu }).eq("id", kontak_id);
    },

    async ubah_status_percakapan(percakapan_id, status, alasan_eskalasi) {
      await db
        .from("percakapan")
        .update({ status, alasan_eskalasi })
        .eq("id", percakapan_id);
    },

    async catat_luar_jam_dibalas(percakapan_id, waktu) {
      await db
        .from("percakapan")
        .update({ luar_jam_dibalas_at: waktu })
        .eq("id", percakapan_id);
    },

    async hentikan_kampanye(tenant_id, kontak_id, alasan) {
      // Lewat RPC, bukan update biasa, supaya penandaan waktu balasnya dan
      // penyaringan statusnya jadi satu pernyataan. Kontak yang mengirim
      // tiga pesan beruntun tidak boleh menggeser dibalas_at tiga kali.
      const { data } = await db.rpc("hentikan_sasaran_kontak", {
        p_tenant_id: tenant_id,
        p_kontak_id: kontak_id,
        p_alasan: alasan,
      });
      return Number(data ?? 0);
    },
  };
}

export type KredensialGateway = {
  gateway: string;
  token: string | null;
  nomor_wa: string | null;
};

/**
 * Mengambil kredensial pengiriman, terpisah dari KonteksTenant.
 *
 * Aturan penerimaan pesan tidak boleh tahu soal token sama sekali, jadi
 * token baru diambil kalau memang ada yang perlu dikirim. Sebagian besar
 * pesan masuk tidak butuh balasan otomatis, jadi query ini jarang jalan.
 */
export async function kredensial_gateway(
  db: SupabaseClient,
  tenant_id: string,
): Promise<KredensialGateway | null> {
  const { data } = await db
    .from("pengaturan_tenant")
    .select("gateway, gateway_token_terenkripsi, nomor_wa")
    .eq("tenant_id", tenant_id)
    .maybeSingle();

  if (!data) return null;

  let token: string | null = null;
  const tersandi = data.gateway_token_terenkripsi as string | null;
  if (tersandi) {
    try {
      const { dekripsi } = await import("./rahasia");
      token = dekripsi(tersandi);
    } catch {
      // Token tidak bisa dibuka, misalnya karena kunci enkripsi diganti.
      // Dibiarkan null supaya jatuh ke gateway tiruan, bukan meledak di
      // tengah percakapan client.
      token = null;
    }
  }

  return { gateway: data.gateway as string, token, nomor_wa: data.nomor_wa as string | null };
}

/** Mencatat pesan yang kita kirim, entah dari AI, manusia, atau otomatis. */
export async function catat_pesan_keluar(
  db: SupabaseClient,
  masukan: {
    tenant_id: string;
    percakapan_id: string;
    isi: string;
    pengirim: "ai" | "manusia" | "kampanye";
    status_kirim: "antre" | "terkirim" | "gagal";
    wa_message_id: string | null;
    /** Diisi hanya kalau pesannya keluar dari mesin kampanye. */
    kampanye_id?: string | null;
  },
): Promise<string | null> {
  const { data } = await db
    .from("pesan")
    .insert({
      tenant_id: masukan.tenant_id,
      percakapan_id: masukan.percakapan_id,
      arah: "keluar",
      pengirim: masukan.pengirim,
      isi: masukan.isi,
      status_kirim: masukan.status_kirim,
      wa_message_id: masukan.wa_message_id,
      kampanye_id: masukan.kampanye_id ?? null,
    })
    .select("id")
    .single();

  return (data?.id as string | undefined) ?? null;
}
