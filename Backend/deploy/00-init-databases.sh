#!/bin/bash
set -e

POSTGRES_USER="${POSTGRES_USER:-kudiba}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
SQL_DIR="${KUDIBA_SQL_DIR:-/docker-entrypoint-initdb.d}"
RUNTIME_SQL_DIR="${KUDIBA_RUNTIME_SQL_DIR:-/opt/kudiba}"
INIT_TRACKING_DB="${KUDIBA_INIT_TRACKING_DB:-postgres}"
INIT_TRACKING_TABLE="public.kudiba_init_migrations"
INIT_SKIP_TRACKING="${KUDIBA_INIT_SKIP_TRACKING:-false}"

echo "================================================================="
echo "Kudiba ERP: Inicializando Múltiplos Bancos de Dados Isolados"
echo "================================================================="

if [ "$INIT_SKIP_TRACKING" != "true" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$INIT_TRACKING_DB" <<-EOSQL
        CREATE TABLE IF NOT EXISTS ${INIT_TRACKING_TABLE} (
            bundle_hash TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
EOSQL

    BUNDLE_HASH="$(
        {
            find "$SQL_DIR" -maxdepth 1 -type f -name '*.sql' -print | sort | xargs sha256sum
            sha256sum < "$0"
        } | sha256sum | awk '{print $1}'
    )"

    ALREADY_APPLIED="$(
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$INIT_TRACKING_DB" -tAc \
            "SELECT 1 FROM ${INIT_TRACKING_TABLE} WHERE bundle_hash = '${BUNDLE_HASH}'"
    )"

    if [ "$ALREADY_APPLIED" = "1" ]; then
        echo "Bundle de inicialização já aplicado (${BUNDLE_HASH}). A saltar."
        exit 0
    fi

    echo "Bundle de inicialização pendente (${BUNDLE_HASH})."
fi

# 1. Criação das bases de dados isoladas para cada microsserviço
for DB_NAME in \
    kudiba_auth \
    kudiba_invoicing \
    kudiba_inventory \
    kudiba_treasury \
    kudiba_accounting \
    kudiba_payroll \
    kudiba_integrations \
    kudiba_backoffice; do
    if psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tAc \
        "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
        echo "Banco '${DB_NAME}' já existe."
    else
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
            -c "CREATE DATABASE \"${DB_NAME}\""
        echo "Banco '${DB_NAME}' criado."
    fi
done

echo "Bancos de dados 'kudiba_auth', 'kudiba_invoicing', 'kudiba_inventory', 'kudiba_treasury', 'kudiba_accounting', 'kudiba_payroll', 'kudiba_integrations' e 'kudiba_backoffice' prontos."

# 2. Inicialização do schema fiscal no banco 'kudiba_invoicing'
echo "Aplicando schema fiscal no banco 'kudiba_invoicing'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_invoicing" -f $SQL_DIR/01-invoicing-schema.sql
if [ -f $SQL_DIR/30-invoicing-proformas-and-payments.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_invoicing" -f $SQL_DIR/30-invoicing-proformas-and-payments.sql
fi

# 3. Inicialização do schema de identidade e RBAC no banco 'kudiba_auth'
echo "Aplicando schema de autenticação no banco 'kudiba_auth'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_auth" -f $SQL_DIR/02-auth-schema.sql

# 4. Inicialização do schema de inventário no banco 'kudiba_inventory'
echo "Aplicando schema de inventário no banco 'kudiba_inventory'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_inventory" -f $SQL_DIR/04-inventory-schema.sql
if [ -f $SQL_DIR/24-purchase-uom-conversion.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_inventory" -f $SQL_DIR/24-purchase-uom-conversion.sql
fi
if [ -f $SQL_DIR/29-stock-movement-supplier.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_inventory" -f $SQL_DIR/29-stock-movement-supplier.sql
fi

# 5. Inicialização do schema de tesouraria no banco 'kudiba_treasury'
echo "Aplicando schema de tesouraria no banco 'kudiba_treasury'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f $SQL_DIR/05-treasury-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f $SQL_DIR/18-treasury-cash-flow-payables.sql
if [ -f $SQL_DIR/23-partial-invoice-payments.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f $SQL_DIR/23-partial-invoice-payments.sql
fi
if [ -f $SQL_DIR/31-treasury-receivable-payments.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f $SQL_DIR/31-treasury-receivable-payments.sql
fi

# 6. Inicialização do schema de contabilidade no banco 'kudiba_accounting'
echo "Aplicando schema de contabilidade no banco 'kudiba_accounting'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_accounting" -f $SQL_DIR/06-accounting-schema.sql
if [ -f $SQL_DIR/22-cost-centers-analytical-accounting.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_accounting" -f $SQL_DIR/22-cost-centers-analytical-accounting.sql
fi
if [ -f $SQL_DIR/25-accounting-chart-templates.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_accounting" -f $SQL_DIR/25-accounting-chart-templates.sql
fi

# 7. Inicialização do schema de recursos humanos e payroll no banco 'kudiba_payroll'
echo "Aplicando schema de payroll no banco 'kudiba_payroll'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_payroll" -f $SQL_DIR/07-payroll-schema.sql
if [ -f $SQL_DIR/20-conflict-management-schema.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_payroll" -f $SQL_DIR/20-conflict-management-schema.sql
fi
if [ -f $SQL_DIR/21-seed-conflict-cases.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_payroll" -f $SQL_DIR/21-seed-conflict-cases.sql
fi

# 8. Inicialização do schema do Integration Hub no banco 'kudiba_integrations'
echo "Aplicando schema de integrações no banco 'kudiba_integrations'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_integrations" -f $SQL_DIR/08-integrations-schema.sql

# 8b. Inicialização do schema de clientes & licenças no banco 'kudiba_backoffice'
echo "Aplicando schema de backoffice no banco 'kudiba_backoffice'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_backoffice" -f $SQL_DIR/09-backoffice-schema.sql

# 8b2. Inicialização do schema e tabela de auditoria universal em todos os bancos de dados
echo "Aplicando schema de auditoria universal 'kudiba_audit' em todos os bancos de dados..."
for DB_TARGET in "kudiba_invoicing" "kudiba_auth" "kudiba_inventory" "kudiba_treasury" "kudiba_accounting" "kudiba_payroll" "kudiba_integrations" "kudiba_backoffice"; do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_TARGET" -f $SQL_DIR/24-universal-system-audit-trail.sql
done

# 8b3. Histórico de backups lógicos por tenant
echo "Aplicando schema de backups por tenant..."
for DB_TARGET in "kudiba_auth" "$POSTGRES_DB"; do
    if [ -f $SQL_DIR/28-tenant-backups.sql ]; then
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_TARGET" -f $SQL_DIR/28-tenant-backups.sql
    fi
done

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
        ADD COLUMN IF NOT EXISTS alvara_number VARCHAR(64),
        ADD COLUMN IF NOT EXISTS alvara_issue_date DATE,
        ADD COLUMN IF NOT EXISTS alvara_expiry_date DATE,
        ADD COLUMN IF NOT EXISTS share_capital VARCHAR(64),
        ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
        ADD COLUMN IF NOT EXISTS tax_regime_code VARCHAR(32) NOT NULL DEFAULT 'REGIME_GERAL',
        ADD COLUMN IF NOT EXISTS tax_office_code VARCHAR(128),
        ADD COLUMN IF NOT EXISTS agt_cert_number VARCHAR(64),
        ADD COLUMN IF NOT EXISTS default_withholding_rate NUMERIC(5, 2) NOT NULL DEFAULT 6.50,
        ADD COLUMN IF NOT EXISTS invoice_footer_notes TEXT,
        ADD COLUMN IF NOT EXISTS bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS sector_code VARCHAR(32) NOT NULL DEFAULT 'GERAL',
        ADD COLUMN IF NOT EXISTS accounting_template_code VARCHAR(64) NOT NULL DEFAULT 'PGC_GENERIC',
        ADD COLUMN IF NOT EXISTS license_valid_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS subscribed_modules TEXT[],
        ADD COLUMN IF NOT EXISTS database_connections JSONB NOT NULL DEFAULT '{}'::jsonb;

    ALTER TABLE kudiba_core.tenants
        ALTER COLUMN currency SET DEFAULT 'AOA',
        ALTER COLUMN tax_regime_code SET DEFAULT 'REGIME_GERAL',
        ALTER COLUMN default_withholding_rate SET DEFAULT 6.50,
        ALTER COLUMN bank_accounts SET DEFAULT '[]'::jsonb,
        ALTER COLUMN database_connections SET DEFAULT '{}'::jsonb,
        ALTER COLUMN onboarding_completed SET DEFAULT FALSE,
        ALTER COLUMN status SET DEFAULT 'ACTIVE';
EOSQL
done

# 8c0. Perfil contabilístico do tenant (setor + template de plano de contas)
for DB_TARGET in "kudiba_auth" "kudiba_invoicing"; do
    if [ -f $SQL_DIR/26-tenant-accounting-profile.sql ]; then
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$DB_TARGET" -f $SQL_DIR/26-tenant-accounting-profile.sql
    fi
done

# 8c1. Migrações RBAC e parametrização avançada no banco 'kudiba_auth'
echo "Aplicando migrações 10 a 14 no banco 'kudiba_auth'..."
for MIGRATION_FILE in \
    $SQL_DIR/10-roles-per-tenant.sql \
    $SQL_DIR/11-tenants-contingency.sql \
    $SQL_DIR/12-role-permission-overrides.sql \
    $SQL_DIR/13-expand-full-permissions-matrix.sql \
    $SQL_DIR/14-tenant-database-connections.sql; do
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

# 8e. Papéis de aplicação sem privilégios de superutilizador ou bypass de RLS
echo "Provisionando papéis de aplicação para os serviços Rust..."
APP_PASSWORD="${KUDIBA_APP_PASSWORD:-kudiba_app_secret}"
while IFS=' ' read -r DB_TARGET APP_ROLE; do
    psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$DB_TARGET" \
        -f $RUNTIME_SQL_DIR/16-row-level-security.sql
    psql -v ON_ERROR_STOP=1 \
        --username "$POSTGRES_USER" \
        --dbname "$DB_TARGET" \
        --set=owner_role="$POSTGRES_USER" \
        --set=app_role="$APP_ROLE" \
        --set=app_password="$APP_PASSWORD" \
        -f $RUNTIME_SQL_DIR/17-application-role.sql
done <<'ROLES'
kudiba_invoicing kudiba_invoicing_app
kudiba_inventory kudiba_inventory_app
kudiba_treasury kudiba_treasury_app
kudiba_accounting kudiba_accounting_app
ROLES

echo "Carregando dados de demonstração de tesouraria no tenant demo..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "kudiba_treasury" -f $SQL_DIR/19-seed-treasury-cashflow.sql

# 9. Compatibilidade regressiva para o banco padrão kudiba_erp
echo "Aplicando schema no banco padrão '$POSTGRES_DB'..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/01-invoicing-schema.sql
if [ -f $SQL_DIR/30-invoicing-proformas-and-payments.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/30-invoicing-proformas-and-payments.sql
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/02-auth-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/04-inventory-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/05-treasury-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/18-treasury-cash-flow-payables.sql
if [ -f $SQL_DIR/31-treasury-receivable-payments.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/31-treasury-receivable-payments.sql
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/19-seed-treasury-cashflow.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/06-accounting-schema.sql
if [ -f $SQL_DIR/25-accounting-chart-templates.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/25-accounting-chart-templates.sql
fi
if [ -f $SQL_DIR/26-tenant-accounting-profile.sql ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/26-tenant-accounting-profile.sql
fi
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/07-payroll-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/08-integrations-schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f $SQL_DIR/24-universal-system-audit-trail.sql

if [ "$INIT_SKIP_TRACKING" != "true" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$INIT_TRACKING_DB" -c \
        "INSERT INTO ${INIT_TRACKING_TABLE} (bundle_hash) VALUES ('${BUNDLE_HASH}') ON CONFLICT DO NOTHING"
    echo "Bundle de inicialização registado (${BUNDLE_HASH})."
fi

echo "================================================================="
echo "Inicialização de Bancos Concluída com Sucesso!"
echo "================================================================="
