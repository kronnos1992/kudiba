#!/usr/bin/env bash
set -euo pipefail

PG_USER="${PG_USER:-kudiba}"
PG_CONTAINER="${PG_CONTAINER:-kudiba-postgres}"
APP_PASSWORD="${KUDIBA_APP_PASSWORD:-kudiba_app_secret}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/17-application-role.sql"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Ficheiro SQL não encontrado: $SQL_FILE" >&2
  exit 1
fi

while IFS=' ' read -r db app_role; do
  [[ -n "$db" ]] || continue
  echo "[+] Configurando ${app_role} em ${db}..."
  podman exec -i "$PG_CONTAINER" psql \
    -U "$PG_USER" \
    -d "$db" \
    -v ON_ERROR_STOP=1 \
    -v owner_role="$PG_USER" \
    -v app_role="$app_role" \
    -v app_password="$APP_PASSWORD" \
    < "$SQL_FILE"
done <<'ROLES'
kudiba_invoicing kudiba_invoicing_app
kudiba_inventory kudiba_inventory_app
kudiba_treasury kudiba_treasury_app
kudiba_accounting kudiba_accounting_app
ROLES

echo "[✓] Papéis de aplicação sem privilégios de bypass RLS configurados."
