#!/usr/bin/env bash
set -euo pipefail

PG_USER="${PG_USER:-kudiba}"
PG_CONTAINER="${PG_CONTAINER:-kudiba-postgres}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/16-row-level-security.sql"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Ficheiro SQL não encontrado: $SQL_FILE" >&2
  exit 1
fi

echo "=== Aplicando Row-Level Security (RLS) nas bases do Kudiba ERP ==="

for db in kudiba_invoicing kudiba_treasury kudiba_inventory kudiba_accounting; do
  echo "[+] Configurando RLS em ${db}..."
  podman exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$db" -v ON_ERROR_STOP=1 < "$SQL_FILE"
done

echo "[✓] Row-Level Security (RLS) configurado com sucesso em todas as bases críticas multi-tenant."
