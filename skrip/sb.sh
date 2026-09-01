#!/usr/bin/env sh
# Menjalankan Supabase CLI memakai token yang khusus project ini.
#
# Login global `supabase login` cuma menyimpan satu token, jadi kalau dipakai
# untuk akun Reflows, akses ke project Seawise yang lain ikut hilang. Token
# di .env.local hanya berlaku di dalam folder ini, sisanya tidak terganggu.
set -e

if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "SUPABASE_ACCESS_TOKEN belum ada di .env.local." >&2
  echo "" >&2
  echo "Ambil di akun Supabase yang punya project Reflows:" >&2
  echo "  Account Settings, menu Access Tokens, Generate new token" >&2
  echo "Lalu tambahkan barisnya ke .env.local:" >&2
  echo "  SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx" >&2
  exit 1
fi

exec supabase "$@"
