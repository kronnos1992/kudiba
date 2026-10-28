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
    CREATE DATABASE kudiba_backoffice;
EOSQL

echo "Bancos de dados 'kudiba_auth', 'kudiba_invoicing', 'kudiba_inventory', 'kudiba_treasury', 'kudiba_accounting', 'kudiba_payroll', 'kudiba_integrations' e 'kudiba_backoffice' criados com sucesso."

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
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f /docker-entrypoint-initdb.d/18-treasury-cash-flow-payables.sql

# 6. Inicialização do schema de contabilidade no banco 'kudiba_accounting'
echo "Aplicando schema de contabilidade no banco 'kudiba_accounting'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_accounting" -f /docker-entrypoint-initdb.d/06-accounting-schema.sql

# 7. Inicialização do schema de recursos humanos e payroll no banco 'kudiba_payroll'
echo "Aplicando schema de payroll no banco 'kudiba_payroll'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_payroll" -f /docker-entrypoint-initdb.d/07-payroll-schema.sql

# 8. Inicialização do schema do Integration Hub no banco 'kudiba_integrations'
echo "Aplicando schema de integrações no banco 'kudiba_integrations'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_integrations" -f /docker-entrypoint-initdb.d/08-integrations-schema.sql

# 8b. Inicialização do schema de clientes & licenças no banco 'kudiba_backoffice'
echo "Aplicando schema de backoffice no banco 'kudiba_backoffice'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_backoffice" -f /docker-entrypoint-initdb.d/09-backoffice-schema.sql

# 8c. Colunas de licença e parametrização no tenant (idempotente; cobre volumes anteriores)
echo "Sincronizando colunas de licença e parametrização em kudiba_core.tenants..."
for DB_TARGET in "kudiba_auth" "kudiba_invoicing"; do
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_TARGET" <<-EOSQL
    ALTER TABLE kudiba_core.tenants
        ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS province VARCHAR(128),
        ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32),
        ADD COLUMN IF NOT EXISTS phone VARCHAR(64),
        ADD COLUMN IF NOT EXISTS email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS website VARCHAR(255),
        ADD COLUMN IF NOT EXISTS logo_data_url TEXT,
        ADD COLUMN IF NOT EXISTS commercial_registry VARCHAR(64),
        ADD COLUMN IF NOT EXISTS share_capital VARCHAR(64),
        ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
        ADD COLUMN IF NOT EXISTS tax_regime_code VARCHAR(32) NOT NULL DEFAULT 'REGIME_GERAL',
        ADD COLUMN IF NOT EXISTS tax_office_code VARCHAR(128),
        ADD COLUMN IF NOT EXISTS agt_cert_number VARCHAR(64),
        ADD COLUMN IF NOT EXISTS default_withholding_rate NUMERIC(5, 2) NOT NULL DEFAULT 6.50,
        ADD COLUMN IF NOT EXISTS invoice_footer_notes TEXT,
        ADD COLUMN IF NOT EXISTS bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS license_valid_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscribed_modules TEXT[],
        ADD COLUMN IF NOT EXISTS database_connections JSONB NOT NULL DEFAULT '{}'::jsonb;
EOSQL
done

# 8c1. Migrações RBAC e parametrização avançada no banco 'kudiba_auth'
echo "Aplicando migrações 10 a 14 no banco 'kudiba_auth'..."
for MIGRATION_FILE in \
    /docker-entrypoint-initdb.d/10-roles-per-tenant.sql \
    /docker-entrypoint-initdb.d/11-tenants-contingency.sql \
    /docker-entrypoint-initdb.d/12-role-permission-overrides.sql \
    /docker-entrypoint-initdb.d/13-expand-full-permissions-matrix.sql \
    /docker-entrypoint-initdb.d/14-tenant-database-connections.sql; do
    if [ -f "$MIGRATION_FILE" ]; then
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_auth" -f "$MIGRATION_FILE"
    fi
done

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_auth" <<-EOSQL
    UPDATE kudiba_core.tenants
       SET license_valid_until = NOW() + INTERVAL '1 year',
           subscribed_modules = ARRAY[
               'invoicing', 'inventory', 'treasury',
               'payroll', 'accounting', 'integrations'
           ],
           onboarding_completed = TRUE
     WHERE slug = 'demo'
       AND license_valid_until IS NULL;
EOSQL

# 8d. Bootstrap do utilizador SYSADMIN (Superadministrador do Sistema)
echo "Provisionando utilizador inicial SYSADMIN no banco 'kudiba_auth'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_auth" -f /docker-entrypoint-initdb.d/15-bootstrap-sysadmin.sql

# 8e. Papéis de aplicação sem privilégios de superutilizador ou bypass de RLS
echo "Provisionando papéis de aplicação para os serviços Rust..."
APP_PASSWORD="${KUDIBA_APP_PASSWORD:-kudiba_app_secret}"
while IFS=' ' read -r DB_TARGET APP_ROLE; do
    psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$DB_TARGET" \
        -f /opt/kudiba/16-row-level-security.sql
    psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$DB_TARGET" \
        --set=owner_role="$POSTGRES_USER" \
        --set=app_role="$APP_ROLE" \
        --set=app_password="$APP_PASSWORD" \
        -f /opt/kudiba/17-application-role.sql
done <<'ROLES'
kudiba_invoicing kudiba_invoicing_app
kudiba_inventory kudiba_inventory_app
kudiba_treasury kudiba_treasury_app
kudiba_accounting kudiba_accounting_app
ROLES

echo "Carregando dados de demonstração de tesouraria no tenant demo..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f /docker-entrypoint-initdb.d/19-seed-treasury-cashflow.sql

# 9. Compatibilidade regressiva para o banco padrão kudiba_erp
echo "Aplicando schema no banco padrão '$POSTGRES_DB'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/01-invoicing-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/02-auth-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/04-inventory-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/05-treasury-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/18-treasury-cash-flow-payables.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/19-seed-treasury-cashflow.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/06-accounting-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/07-payroll-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/08-integrations-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-entrypoint-initdb.d/15-bootstrap-sysadmin.sql

echo "================================================================="
echo "Inicialização de Bancos Concluída com Sucesso!"
echo "================================================================="
