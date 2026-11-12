#!/bin/bash
set -e

export PGHOST="${PGHOST:-postgres}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-${POSTGRES_USER:-kudiba}}"
export POSTGRES_USER="${POSTGRES_USER:-$PGUSER}"
export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-kudiba_secret_pass}}"

until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1; do
    echo "Aguardando PostgreSQL em ${PGHOST}:${PGPORT}..."
    sleep 2
done

exec /docker-entrypoint-initdb.d/00-init-databases.sh
