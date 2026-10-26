-- ============================================================================
-- Kudiba ERP: Migração 18 - Fluxo de Caixa, Contas a Pagar, Transferências
-- Internas e Conciliação Bancária para o Mercado Angolano
-- Base de dados: kudiba_treasury
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_treasury;

-- 1. ADICIONAR ENUMS / TIPOS SE NÃO EXISTIREM
DO $$ BEGIN
    CREATE TYPE kudiba_treasury.activity_type AS ENUM ('OPERATIONAL', 'INVESTMENT', 'FINANCING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kudiba_treasury.payable_status AS ENUM ('OUTSTANDING', 'PARTIALLY_PAID', 'SETTLED', 'OVERDUE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Atualizar enum payment_method para incluir meios angolanos se não existirem
DO $$ BEGIN
    ALTER TYPE kudiba_treasury.payment_method ADD VALUE IF NOT EXISTS 'MULTICAIXA_EXPRESS';
    ALTER TYPE kudiba_treasury.payment_method ADD VALUE IF NOT EXISTS 'CHEQUE';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ATUALIZAR CONTAS BANCÁRIAS COM SALDO CONCILIADO E TAXA DE CÂMBIO DE REFERÊNCIA (BNA)
ALTER TABLE kudiba_treasury.bank_accounts
    ADD COLUMN IF NOT EXISTS reconciled_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS exchange_rate_to_aoa NUMERIC(15, 4) NOT NULL DEFAULT 1.0;

-- 3. CONTAS A PAGAR A FORNECEDORES (INVOICE PAYABLES)
CREATE TABLE IF NOT EXISTS kudiba_treasury.invoice_payables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    supplier_id VARCHAR(100),
    supplier_name VARCHAR(255) NOT NULL,
    supplier_nif VARCHAR(30),
    invoice_number VARCHAR(60) NOT NULL,
    activity_type kudiba_treasury.activity_type NOT NULL DEFAULT 'OPERATIONAL',
    category VARCHAR(60) NOT NULL DEFAULT 'FORNECEDORES_MERCADORIAS',
    currency kudiba_treasury.currency_code NOT NULL DEFAULT 'AOA',
    gross_total NUMERIC(15, 4) NOT NULL DEFAULT 0,
    withholding_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    withholding_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    net_payable NUMERIC(15, 4) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(15, 4) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method kudiba_treasury.payment_method,
    status kudiba_treasury.payable_status NOT NULL DEFAULT 'OUTSTANDING',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payables_tenant ON kudiba_treasury.invoice_payables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payables_status ON kudiba_treasury.invoice_payables(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payables_due_date ON kudiba_treasury.invoice_payables(tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_payables_supplier ON kudiba_treasury.invoice_payables(tenant_id, supplier_nif);

-- 4. LIQUIDAÇÕES DE CONTAS A PAGAR (PAYABLE SETTLEMENTS)
CREATE TABLE IF NOT EXISTS kudiba_treasury.payable_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    payable_id UUID NOT NULL REFERENCES kudiba_treasury.invoice_payables(id) ON DELETE CASCADE,
    bank_account_id UUID REFERENCES kudiba_treasury.bank_accounts(id) ON DELETE SET NULL,
    session_id UUID REFERENCES kudiba_treasury.cash_sessions(id) ON DELETE SET NULL,
    amount_paid NUMERIC(15, 4) NOT NULL,
    payment_method kudiba_treasury.payment_method NOT NULL,
    payment_reference VARCHAR(100),
    settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operator_user_id VARCHAR(100) NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_payable_settlements_tenant ON kudiba_treasury.payable_settlements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payable_settlements_payable ON kudiba_treasury.payable_settlements(payable_id);

-- 5. TRANSFERÊNCIAS ENTRE CONTAS PRÓPRIAS E CAIXA (SEM DUPLICAÇÃO DE FLUXO)
CREATE TABLE IF NOT EXISTS kudiba_treasury.cash_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    transfer_number VARCHAR(50) NOT NULL,
    source_type VARCHAR(20) NOT NULL, -- 'BANK' ou 'REGISTER'
    source_id UUID NOT NULL,
    target_type VARCHAR(20) NOT NULL, -- 'BANK' ou 'REGISTER'
    target_id UUID NOT NULL,
    amount NUMERIC(15, 4) NOT NULL,
    fee_amount NUMERIC(15, 4) NOT NULL DEFAULT 0,
    currency kudiba_treasury.currency_code NOT NULL DEFAULT 'AOA',
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    operator_user_id VARCHAR(100) NOT NULL,
    notes TEXT,
    transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON kudiba_treasury.cash_transfers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON kudiba_treasury.cash_transfers(tenant_id, transferred_at);

-- 6. EXTRATOS BANCÁRIOS E CONCILIAÇÃO
CREATE TABLE IF NOT EXISTS kudiba_treasury.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    bank_account_id UUID NOT NULL REFERENCES kudiba_treasury.bank_accounts(id) ON DELETE RESTRICT,
    reference_period VARCHAR(20) NOT NULL,
    start_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
    end_balance NUMERIC(15, 4) NOT NULL DEFAULT 0,
    statement_date DATE NOT NULL,
    file_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statements_tenant ON kudiba_treasury.bank_statements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statements_account ON kudiba_treasury.bank_statements(bank_account_id);

CREATE TABLE IF NOT EXISTS kudiba_treasury.bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id UUID NOT NULL REFERENCES kudiba_treasury.bank_statements(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    line_date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    document_ref VARCHAR(100),
    amount NUMERIC(15, 4) NOT NULL,
    balance_after NUMERIC(15, 4) NOT NULL DEFAULT 0,
    movement_type VARCHAR(30) NOT NULL, -- 'CREDIT' ou 'DEBIT'
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    matched_type VARCHAR(30), -- 'RECEIPT', 'PAYABLE', 'TRANSFER', 'COMMISSION', 'OTHER'
    matched_id UUID,
    reconciled_at TIMESTAMPTZ,
    reconciled_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_statement_lines_stmt ON kudiba_treasury.bank_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_statement_lines_tenant ON kudiba_treasury.bank_statement_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_statement_lines_reconciled ON kudiba_treasury.bank_statement_lines(tenant_id, is_reconciled);

-- 7. ENRIQUECER MOVIMENTOS DE CAIXA COM ATIVIDADE E CATEGORIA SE NÃO EXISTIREM
ALTER TABLE kudiba_treasury.cash_movements
    ADD COLUMN IF NOT EXISTS activity_type VARCHAR(30) NOT NULL DEFAULT 'OPERATIONAL',
    ADD COLUMN IF NOT EXISTS category VARCHAR(60) NOT NULL DEFAULT 'OPERACIONAL_GERAL';
