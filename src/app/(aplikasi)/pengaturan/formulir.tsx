"use client";

import * as React from "react";
import { CircleCheck, Plug, TriangleAlert } from "lucide-react";
import {
  simpan_pengaturan,
  type KeadaanPengaturan,
} from "./aksi";
import { Kartu, KepalaKartu, IsiKartu } from "@/komponen/ui/kartu";
import { AreaTeks, Bidang, Kolom, Pilih } from "@/komponen/ui/bidang";
import { Tombol } from "@/komponen/ui/tombol";
import { Lencana } from "@/komponen/ui/lencana";
import type { Pengaturan } from "@/lib/data/pengaturan";

const AWAL: KeadaanPengaturan = { galat: null, pesan: null };

const ZONA = [
  { nilai: "Asia/Jakarta", label: "WIB, Asia/Jakarta" },
  { nilai: "Asia/Makassar", label: "WITA, Asia/Makassar" },
  { nilai: "Asia/Jayapura", label: "WIT, Asia/Jayapura" },
];

export function FormulirPengaturan({ awal }: { awal: Pengaturan }) {
  const [keadaan, aksi, menunggu] = React.useActionState(simpan_pengaturan, AWAL);
  const [gateway, setGateway] = React.useState(awal.gateway);

  return (
    <form action={aksi} className="grid gap-6 xl:grid-cols-2">
      <Kartu>
        <KepalaKartu
          judul="Koneksi WhatsApp"
          keterangan="Token gateway disandi sebelum masuk database, dan tidak pernah dikirim balik ke browser."
          aksi={
            <Lencana nada={awal.ada_token ? "sukses" : "tunggu"}>
              {awal.ada_token ? "Token tersimpan" : "Token belum ada"}
            </Lencana>
          }
        />
        <IsiKartu className="space-y-4">
          <Kolom label="Penyedia gateway">
            <Pilih
              name="gateway"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
            >
              <option value="mock">Tiruan, mencatat tanpa benar-benar mengirim</option>
              <option value="fonnte">Fonnte</option>
            </Pilih>
          </Kolom>

          <Kolom
            label={awal.ada_token ? "Ganti token gateway" : "Token gateway"}
            petunjuk={
              gateway === "fonnte"
                ? "Ambil di dasbor Fonnte, menu Device. Dikosongkan berarti token yang lama tetap dipakai."
                : "Gateway tiruan tidak butuh token."
            }
          >
            <Bidang
              name="token"
              type="password"
              autoComplete="off"
              disabled={gateway !== "fonnte"}
              placeholder={awal.ada_token ? "Biarkan kosong kalau tidak diganti" : "Tempel token di sini"}
            />
          </Kolom>

          <Kolom
            label="Nomor pengirim"
            petunjuk="Nomor WhatsApp yang dipakai membalas. Dipakai juga memastikan pesan masuk memang untuk kamu."
          >
            <Bidang
              name="nomor_wa"
              defaultValue={awal.nomor_wa ?? ""}
              placeholder="0812xxxxxxx"
              inputMode="tel"
            />
          </Kolom>

          <Kolom
            label="Kuota pesan harian"
            petunjuk="Batas aman supaya nomor tidak dianggap spam. Naikkan pelan-pelan, jangan langsung tinggi."
          >
            <Bidang
              name="kuota_pesan_harian"
              type="number"
              min={1}
              max={2000}
              defaultValue={awal.kuota_pesan_harian}
            />
          </Kolom>
        </IsiKartu>
      </Kartu>

      <Kartu>
        <KepalaKartu
          judul="Perilaku AI"
          keterangan="Mode hybrid membuat AI mengirim sendiri hanya saat yakin, sisanya menunggu kamu."
        />
        <IsiKartu className="space-y-4">
          <Kolom label="Mode balas">
            <Pilih name="mode_balas" defaultValue={awal.mode_balas}>
              <option value="hybrid">Hybrid, kirim sendiri kalau yakin</option>
              <option value="draf">Draf dulu, semua menunggu persetujuan</option>
              <option value="otomatis">Otomatis penuh</option>
            </Pilih>
          </Kolom>

          <Kolom
            label="Ambang keyakinan"
            petunjuk="Di bawah angka ini, balasan tidak dikirim tapi masuk antrean draf. Mulai dari 85 lalu turunkan pelan setelah kamu percaya hasilnya."
          >
            <Bidang
              name="ambang_keyakinan"
              type="number"
              min={50}
              max={100}
              defaultValue={Math.round(awal.ambang_keyakinan * 100)}
            />
          </Kolom>

          <div className="grid gap-4 sm:grid-cols-3">
            <Kolom label="Jam mulai">
              <Bidang name="jam_mulai" type="time" defaultValue={awal.jam_mulai} required />
            </Kolom>
            <Kolom label="Jam selesai">
              <Bidang name="jam_selesai" type="time" defaultValue={awal.jam_selesai} required />
            </Kolom>
            <Kolom label="Zona waktu">
              <Pilih name="zona_waktu" defaultValue={awal.zona_waktu}>
                {ZONA.map((z) => (
                  <option key={z.nilai} value={z.nilai}>
                    {z.label}
                  </option>
                ))}
              </Pilih>
            </Kolom>
          </div>

          <Kolom
            label="Pesan di luar jam aktif"
            petunjuk="Dikirim sekali per percakapan dalam 12 jam, supaya kontak yang mengirim lima pesan tengah malam tidak dibalas lima kali."
          >
            <AreaTeks
              name="pesan_di_luar_jam"
              defaultValue={awal.pesan_di_luar_jam ?? ""}
              maxLength={1000}
            />
          </Kolom>
        </IsiKartu>
      </Kartu>

      <div className="flex flex-wrap items-center gap-3 xl:col-span-2">
        <Tombol type="submit" disabled={menunggu}>
          <Plug className="size-3.5" />
          {menunggu ? "Menyimpan" : "Simpan pengaturan"}
        </Tombol>

        {keadaan.galat ? (
          <p
            role="alert"
            className="flex items-start gap-2 text-xs leading-relaxed text-gagal-tinta"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {keadaan.galat}
          </p>
        ) : null}

        {keadaan.pesan ? (
          <p
            role="status"
            className="flex items-start gap-2 text-xs leading-relaxed text-sukses-tinta"
          >
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            {keadaan.pesan}
          </p>
        ) : null}
      </div>
    </form>
  );
}
