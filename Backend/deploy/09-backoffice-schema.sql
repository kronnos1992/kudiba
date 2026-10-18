-- =============================================================================
-- KudibaBackoffice — Esquema de Clientes & Licenças Anuais (B2B)
-- Aplicado na base de dados isolada `kudiba_backoffice`.
--
-- Nota de coerência: o KudibaBackoffice escreve também no `kudiba_auth`
-- (kudiba_core.tenants) para provisionar o tenant e sincronizar o espelho de
-- licença (license_valid_until / subscribed_modules), que é o que o Auth e o
-- Gateway consumem na altura do login e do encaminhamento de pedidos.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_backoffice;

-- -----------------------------------------------------------------------------
-- 1. CLIENTES (empresas subscritoras do Kudiba ERP)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_backoffice.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    nif VARCHAR(20) NOT NULL UNIQUE,
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(32),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. LICENÇAS ANUAIS (períodos de subscrição com módulos escolhidos)
--    Cada renovação cria um novo período; o estado "EXPIRED" é derivado de
--    valid_until < CURRENT_DATE (o Auth bloqueia o login pela data-espelho).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_backoffice.licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES kudiba_backoffice.clients(id) ON DELETE CASCADE,
    license_key VARCHAR(64) NOT NULL UNIQUE,
    plan VARCHAR(32) NOT NULL DEFAULT 'STANDARD',
    seats INTEGER NOT NULL DEFAULT 5,
    modules TEXT[] NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_license_period CHECK (valid_until > valid_from),
    CONSTRAINT ck_license_seats CHECK (seats > 0)
);

CREATE INDEX IF NOT EXISTS idx_licenses_client
    ON kudiba_backoffice.licenses(client_id);
CREATE INDEX IF NOT EXISTS idx_licenses_valid_until
    ON kudiba_backoffice.licenses(valid_until);
CREATE INDEX IF NOT EXISTS idx_licenses_status
    ON kudiba_backoffice.licenses(status);
