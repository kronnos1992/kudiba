#!/bin/bash
set -e

echo "================================================================="
echo "Kudiba ERP: Inicializando Múltiplos Bancos de Dados Isolados"
echo "================================================================="

# 1. Criação das bases de dados isoladas para cada microsserviço
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE kudiba_auth;
    CREATE DATABASE kudiba_invoicing;
    CREATE DATABASE kudiba_inventory;
EOSQL

echo "Bancos de dados 'kudiba_auth', 'kudiba_invoicing' e 'kudiba_inventory' criados com sucesso."

# 2. Inicialização do schema fiscal no banco 'kudiba_invoicing'
echo "Aplicando schema fiscal no banco 'kudiba_invoicing'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_invoicing" -f /docker-entrypoint-initdb.d/01-invoicing-schema.sql

# 3. Inicialização do schema de identidade e RBAC no banco 'kudiba_auth'
echo "Aplicando schema de autenticação no banco 'kudiba_auth'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_auth" -f /docker-entrypoint-initdb.d/02-auth-schema.sql

# 4. Inicialização do schema de inventário no banco 'kudiba_inventory'
echo "Aplicando schema de inventário no banco 'kudiba_inventory'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_inventory" -f /docker-entrypoint-initdb.d/04-inventory-schema.sql

# 5. Compatibilidade regressiva para o banco padrão kudiba_erp
echo "Aplicando schema no banco padrão '$POSTGRES_DB'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/01-invoicing-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/02-auth-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/04-inventory-schema.sql

echo "================================================================="
echo "Inicialização de Bancos Concluída com Sucesso!"
echo "================================================================="
