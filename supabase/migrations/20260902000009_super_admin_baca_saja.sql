-- =========================================================
-- Reflows | Super admin jadi baca saja
--
-- Kebijakan lama memakai `for all` dengan super admin di klausa using-nya.
-- Akibatnya pemegang super_admin bukan cuma bisa membaca data tenant mana
-- pun, tapi juga MENGHAPUS dan MENGUBAHNYA. Untuk pekerjaan dukungan itu
-- terlalu longgar: satu salah klik atau satu akun yang bocor bisa
-- menghapus seluruh riwayat percakapan pelanggan.
--
-- Sekarang dipecah dua. Membaca boleh lintas tenant, menulis tidak pernah.
-- Kalau suatu saat memang perlu memperbaiki data pelanggan, jalurnya lewat
-- service role dengan skrip yang tercatat, bukan lewat sesi browser.
-- =========================================================

do $$
declare t text;
begin
  foreach t in array array[
    'pengaturan_tenant', 'pengetahuan', 'kontak', 'percakapan', 'pesan',
    'jalan_ai', 'log_audit', 'kampanye', 'langkah_kampanye',
    'sasaran_kampanye', 'invoice', 'baris_invoice'
  ] loop
    execute format('drop policy if exists %1$s_akses on public.%1$s', t);

    -- Membaca: tenant sendiri, atau siapa pun yang super admin.
    execute format($f$
      create policy %1$s_baca on public.%1$s for select to authenticated
        using (tenant_id = public.tenant_saya() or public.saya_super_admin());
    $f$, t);

    -- Menulis: tenant sendiri saja. Super admin sengaja tidak disebut.
    execute format($f$
      create policy %1$s_sisip on public.%1$s for insert to authenticated
        with check (tenant_id = public.tenant_saya());
    $f$, t);

    execute format($f$
      create policy %1$s_ubah on public.%1$s for update to authenticated
        using (tenant_id = public.tenant_saya())
        with check (tenant_id = public.tenant_saya());
    $f$, t);

    execute format($f$
      create policy %1$s_hapus on public.%1$s for delete to authenticated
        using (tenant_id = public.tenant_saya());
    $f$, t);
  end loop;
end $$;

comment on function public.saya_super_admin() is
  'Membuka pembacaan lintas tenant di kebijakan RLS. Sengaja tidak pernah membuka penulisan: sejak migrasi ini, super admin tidak bisa mengubah maupun menghapus baris tenant lain.';
