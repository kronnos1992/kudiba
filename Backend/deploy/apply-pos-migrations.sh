#!/usr/bin/env bash
set -euo pipefail

PG_USER="${PG_USER:-kudiba}"
PG_CONTAINER="${PG_CONTAINER:-kudiba-postgres}"
PG_SSH_HOST="${PG_SSH_HOST:-}"
PG_RUNTIME="${PG_RUNTIME:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for sql in 30-invoicing-proformas-and-payments.sql 32-pos-checkout-schema.sql 33-treasury-cash-movement-idempotency.sql; do
  if [[ ! -f "${SCRIPT_DIR}/${sql}" ]]; then
    echo "Ficheiro SQL não encontrado: ${SCRIPT_DIR}/${sql}" >&2
    exit 1
  fi
done

if [[ -z "$PG_RUNTIME" && -z "$PG_SSH_HOST" ]]; then
  if command -v docker >/dev/null 2>&1; then
    PG_RUNTIME="docker"
  elif command -v podman >/dev/null 2>&1; then
    PG_RUNTIME="podman"
  else
    echo "Nem docker nem podman estão disponíveis; defina PG_RUNTIME ou PG_SSH_HOST." >&2
    exit 1
  fi
fi

apply_migration() {
  local database="$1"
  local file="$2"

  echo "[+] ${file} em ${database}..."
  if [[ -n "$PG_SSH_HOST" ]]; then
    cat "$file" | ssh -o BatchMode=yes "$PG_SSH_HOST" \
      "docker exec -i '$PG_CONTAINER' psql -U '$PG_USER' -d '$database' -v ON_ERROR_STOP=1"
  else
    "$PG_RUNTIME" exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$database" -v ON_ERROR_STOP=1 \
      < "$file"
  fi
}

echo "=== Aplicando migrações POS em bases existentes ==="
apply_migration "kudiba_invoicing" "${SCRIPT_DIR}/30-invoicing-proformas-and-payments.sql"
apply_migration "kudiba_invoicing" "${SCRIPT_DIR}/32-pos-checkout-schema.sql"
apply_migration "kudiba_treasury" "${SCRIPT_DIR}/33-treasury-cash-movement-idempotency.sql"
echo "[✓] Migrações POS aplicadas."
