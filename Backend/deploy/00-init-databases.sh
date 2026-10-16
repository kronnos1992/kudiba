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
    CREATE DATABASE kudiba_treasury;
    CREATE DATABASE kudiba_accounting;
    CREATE DATABASE kudiba_payroll;
    CREATE DATABASE kudiba_integrations;
EOSQL

echo "Bancos de dados 'kudiba_auth', 'kudiba_invoicing', 'kudiba_inventory', 'kudiba_treasury', 'kudiba_accounting', 'kudiba_payroll' e 'kudiba_integrations' criados com sucesso."

# 2. Inicialização do schema fiscal no banco 'kudiba_invoicing'
echo "Aplicando schema fiscal no banco 'kudiba_invoicing'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_invoicing" -f /docker-entrypoint-initdb.d/01-invoicing-schema.sql

# 3. Inicialização do schema de identidade e RBAC no banco 'kudiba_auth'
echo "Aplicando schema de autenticação no banco 'kudiba_auth'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_auth" -f /docker-entrypoint-initdb.d/02-auth-schema.sql

# 4. Inicialização do schema de inventário no banco 'kudiba_inventory'
echo "Aplicando schema de inventário no banco 'kudiba_inventory'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_inventory" -f /docker-entrypoint-initdb.d/04-inventory-schema.sql

# 5. Inicialização do schema de tesouraria no banco 'kudiba_treasury'
echo "Aplicando schema de tesouraria no banco 'kudiba_treasury'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f /docker-entrypoint-initdb.d/05-treasury-schema.sql

# 6. Inicialização do schema de contabilidade no banco 'kudiba_accounting'
echo "Aplicando schema de contabilidade no banco 'kudiba_accounting'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_accounting" -f /docker-entrypoint-initdb.d/06-accounting-schema.sql

# 7. Inicialização do schema de recursos humanos e payroll no banco 'kudiba_payroll'
echo "Aplicando schema de payroll no banco 'kudiba_payroll'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_payroll" -f /docker-entrypoint-initdb.d/07-payroll-schema.sql

# 8. Inicialização do schema do Integration Hub no banco 'kudiba_integrations'
echo "Aplicando schema de integrações no banco 'kudiba_integrations'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_integrations" -f /docker-entrypoint-initdb.d/08-integrations-schema.sql

# 9. Compatibilidade regressiva para o banco padrão kudiba_erp
echo "Aplicando schema no banco padrão '$POSTGRES_DB'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/01-invoicing-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/02-auth-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/04-inventory-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/05-treasury-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/06-accounting-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/07-payroll-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/08-integrations-schema.sql

echo "================================================================="
echo "Inicialização de Bancos Concluída com Sucesso!"
echo "================================================================="
