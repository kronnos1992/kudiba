-- ============================================================================
-- Kudiba ERP: Schema do Microsserviço de Tesouraria, Caixa e Pagamentos
-- Base de dados: kudiba_treasury
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_treasury;

-- 1. TIPOS ENUMERADOS DE DOMÍNIO
DO $$ BEGIN
    CREATE TYPE kudiba_treasury.session_status AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_treasury.movement_type AS ENUM ('SUPPLY', 'BLEED', 'SALE_RECEIPT', 'EXPENSE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_treasury.payment_method AS ENUM ('NUMERARIO', 'MULTICAIXA', 'TRANSFERENCIA', 'GPO_REFERENCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_treasury.currency_code AS ENUM ('AOA', 'USD', 'EUR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CAIXAS (FÍSICOS OU VIRTUAIS / PDV)
CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_treasury_register_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_registers_tenant ON kudiba_treasury.cash_registers(tenant_id);

-- 3. SESSÕES DE CAIXA (ABERTURA, OPERAÇÃO, FECHO CEGO E AUDITORIA DE QUEBRA/SOBRA)
CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    register_id UUID NOT NULL REFERENCES kudiba_treasury.cash_registers(id) ON DELETE RESTRICT,
    operator_user_id VARCHAR(100) NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opening_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
    closing_balance_counted NUMERIC(15, 4),
    closing_balance_system NUMERIC(15, 4),
    discrepancy NUMERIC(15, 4),
    status kudiba_treasury.session_status NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_tenant ON kudiba_treasury.cash_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sessions_register ON kudiba_treasury.cash_sessions(register_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON kudiba_treasury.cash_sessions(register_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_open_session_per_register ON kudiba_treasury.cash_sessions (tenant_id, register_id) WHERE status = 'OPEN';

-- 4. MOVIMENTOS DE CAIXA (SANGRIA, SUPRIMENTO, ENTRADA DE VENDA, DESPESA)
CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL REFERENCES kudiba_treasury.cash_sessions(id) ON DELETE RESTRICT,
    register_id UUID NOT NULL REFERENCES kudiba_treasury.cash_registers(id) ON DELETE RESTRICT,
    movement_type kudiba_treasury.movement_type NOT NULL,
    amount NUMERIC(15, 4) NOT NULL,
    reason TEXT NOT NULL,
    operator_user_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_tenant ON kudiba_treasury.cash_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movements_session ON kudiba_treasury.cash_movements(session_id);
CREATE INDEX IF NOT EXISTS idx_movements_register ON kudiba_treasury.cash_movements(register_id);

-- 5. CONTAS BANCÁRIAS DA EMPRESA (AOA, USD, EUR)
CREATE TABLE IF NOT EXISTS kudiba_treasury.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    iban VARCHAR(34) NOT NULL,
    currency kudiba_treasury.currency_code NOT NULL DEFAULT 'AOA',
    current_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_treasury_bank_iban UNIQUE (tenant_id, iban)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_tenant ON kudiba_treasury.bank_accounts(tenant_id);

-- 6. RECIBOS DE QUITAÇÃO / LIQUIDAÇÃO (COBRANÇA DE FACTURAS A PRAZO)
CREATE TABLE IF NOT EXISTS kudiba_treasury.treasury_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    receipt_number VARCHAR(50) NOT NULL,
    customer_id VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_nif VARCHAR(30),
    session_id UUID REFERENCES kudiba_treasury.cash_sessions(id) ON DELETE SET NULL,
    bank_account_id UUID REFERENCES kudiba_treasury.bank_accounts(id) ON DELETE SET NULL,
    payment_method kudiba_treasury.payment_method NOT NULL,
    total_amount NUMERIC(15, 4) NOT NULL,
    currency kudiba_treasury.currency_code NOT NULL DEFAULT 'AOA',
    notes TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_treasury_receipt_number UNIQUE (tenant_id, receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_tenant ON kudiba_treasury.treasury_receipts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_receipts_customer ON kudiba_treasury.treasury_receipts(tenant_id, customer_id);

-- 7. LINHAS DE RECIBO (FACTURAS LIQUIDADA POR ESTE RECIBO)
CREATE TABLE IF NOT EXISTS kudiba_treasury.treasury_receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES kudiba_treasury.treasury_receipts(id) ON DELETE CASCADE,
    invoice_id VARCHAR(100) NOT NULL,
    invoice_number VARCHAR(60) NOT NULL,
    amount_settled NUMERIC(15, 4) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON kudiba_treasury.treasury_receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_invoice ON kudiba_treasury.treasury_receipt_lines(invoice_id);

-- 8. SEQUÊNCIAS ATÓMICAS DE TESOURARIA
CREATE TABLE IF NOT EXISTS kudiba_treasury.treasury_sequences (
    tenant_id UUID NOT NULL,
    sequence_type VARCHAR(30) NOT NULL,
    fiscal_year INT NOT NULL,
    current_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, sequence_type, fiscal_year)
);
