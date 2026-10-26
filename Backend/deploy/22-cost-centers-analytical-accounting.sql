-- =============================================================================
-- Kudiba ERP — Migração 22: Centros de Custos, Rastreio de Custos (Cost Tracking),
-- Contabilidade Analítica, Regras de Repartição e Controlo Orçamental
-- Base de dados: kudiba_accounting
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_accounting;

-- 1. ENRIQUECER TABELA DE CENTROS DE CUSTOS (CostCenter + CostCenterResponsible)
ALTER TABLE kudiba_accounting.cost_centers
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS parent_cost_center_id UUID REFERENCES kudiba_accounting.cost_centers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS center_type VARCHAR(30) NOT NULL DEFAULT 'COST_CENTER',
    ADD COLUMN IF NOT EXISTS branch_name VARCHAR(120) NOT NULL DEFAULT 'Sede - Luanda',
    ADD COLUMN IF NOT EXISTS department_name VARCHAR(120),
    ADD COLUMN IF NOT EXISTS responsible_employee_id UUID,
    ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT '2026-01-01',
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS alert_threshold_pct NUMERIC(5, 2) NOT NULL DEFAULT 80.00,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cost_centers_parent ON kudiba_accounting.cost_centers(tenant_id, parent_cost_center_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_branch ON kudiba_accounting.cost_centers(tenant_id, branch_name);

-- 2. ORÇAMENTOS E COMPROMISSOS POR CENTRO DE CUSTO E PERÍODO (CostCenterBudget)
CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_center_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE CASCADE,
    fiscal_year INT NOT NULL,
    period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    account_category VARCHAR(80) NOT NULL DEFAULT 'GERAL',
    approved_budget NUMERIC(18, 4) NOT NULL DEFAULT 0,
    committed_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    alert_80_pct BOOLEAN NOT NULL DEFAULT TRUE,
    alert_90_pct BOOLEAN NOT NULL DEFAULT TRUE,
    alert_100_pct BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cost_center_budget_period UNIQUE (tenant_id, cost_center_id, fiscal_year, period_month, account_category)
);

CREATE INDEX IF NOT EXISTS idx_cc_budgets_tenant_year ON kudiba_accounting.cost_center_budgets(tenant_id, fiscal_year, period_month);

-- 3. REGRAS DE REPARTIÇÃO DE CUSTOS PARTILHADOS (CostAllocationRule & Lines)
CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_allocation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(40) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    allocation_basis VARCHAR(60) NOT NULL DEFAULT 'CONSUMO_ESTIMADO',
    default_account_code VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_allocation_rule UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_allocation_rule_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES kudiba_accounting.cost_allocation_rules(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
    percentage NUMERIC(6, 2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    justification VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_alloc_rule_lines_rule ON kudiba_accounting.cost_allocation_rule_lines(rule_id);

-- 4. DISTRIBUIÇÃO ANALÍTICA E RASTREIO DE CUSTOS (CostCenterAllocation + Cadeia Documental)
CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_center_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    batch_id UUID NOT NULL,
    tracking_scope VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTO',
    source_module VARCHAR(40) NOT NULL DEFAULT 'CONTABILIDADE',
    source_document_ref VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(180),
    purchase_order_ref VARCHAR(80),
    receipt_delivery_ref VARCHAR(80),
    payment_settlement_ref VARCHAR(80),
    journal_entry_ref VARCHAR(80),
    journal_entry_id UUID REFERENCES kudiba_accounting.journal_entries(id) ON DELETE SET NULL,
    allocation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_month INT NOT NULL DEFAULT 10,
    fiscal_year INT NOT NULL DEFAULT 2026,
    account_code VARCHAR(30) NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    is_capex BOOLEAN NOT NULL DEFAULT FALSE,
    cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
    branch_name VARCHAR(120) NOT NULL DEFAULT 'Sede - Luanda',
    project_code VARCHAR(80),
    vehicle_or_asset VARCHAR(80),
    allocation_rule_id UUID REFERENCES kudiba_accounting.cost_allocation_rules(id) ON DELETE SET NULL,
    allocation_criterion VARCHAR(150),
    percentage NUMERIC(6, 2) NOT NULL DEFAULT 100.00,
    allocated_amount NUMERIC(18, 4) NOT NULL,
    total_document_amount NUMERIC(18, 4) NOT NULL,
    total_units NUMERIC(12, 2),
    allocated_units NUMERIC(12, 2),
    unit_measure VARCHAR(40),
    asset_tags VARCHAR(255),
    recipient_responsible VARCHAR(150),
    useful_life_months INT,
    monthly_depreciation NUMERIC(18, 4) NOT NULL DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(100) NOT NULL DEFAULT 'Contabilista Chefe',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kudiba_accounting.cost_center_allocations
    ADD COLUMN IF NOT EXISTS tracking_scope VARCHAR(30) NOT NULL DEFAULT 'DOCUMENTO',
    ADD COLUMN IF NOT EXISTS supplier_name VARCHAR(180),
    ADD COLUMN IF NOT EXISTS purchase_order_ref VARCHAR(80),
    ADD COLUMN IF NOT EXISTS receipt_delivery_ref VARCHAR(80),
    ADD COLUMN IF NOT EXISTS payment_settlement_ref VARCHAR(80),
    ADD COLUMN IF NOT EXISTS journal_entry_ref VARCHAR(80),
    ADD COLUMN IF NOT EXISTS total_units NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS allocated_units NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS unit_measure VARCHAR(40),
    ADD COLUMN IF NOT EXISTS asset_tags VARCHAR(255),
    ADD COLUMN IF NOT EXISTS recipient_responsible VARCHAR(150),
    ADD COLUMN IF NOT EXISTS useful_life_months INT,
    ADD COLUMN IF NOT EXISTS monthly_depreciation NUMERIC(18, 4) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cc_allocations_tenant ON kudiba_accounting.cost_center_allocations(tenant_id, fiscal_year, period_month);
CREATE INDEX IF NOT EXISTS idx_cc_allocations_cc ON kudiba_accounting.cost_center_allocations(tenant_id, cost_center_id);
CREATE INDEX IF NOT EXISTS idx_cc_allocations_doc ON kudiba_accounting.cost_center_allocations(tenant_id, source_document_ref);
CREATE INDEX IF NOT EXISTS idx_cc_allocations_batch ON kudiba_accounting.cost_center_allocations(tenant_id, batch_id);

-- 5. HISTÓRICO DE RECLASSIFICAÇÕES E TRANSFERÊNCIAS DE CUSTOS/ATIVOS ENTRE CENTROS
CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_tracking_reclassifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    allocation_id UUID REFERENCES kudiba_accounting.cost_center_allocations(id) ON DELETE SET NULL,
    batch_id UUID NOT NULL,
    source_document_ref VARCHAR(100) NOT NULL,
    from_cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
    to_cost_center_id UUID NOT NULL REFERENCES kudiba_accounting.cost_centers(id) ON DELETE RESTRICT,
    transferred_units NUMERIC(12, 2),
    transferred_amount NUMERIC(18, 4) NOT NULL,
    asset_tags_moved VARCHAR(255),
    reason TEXT NOT NULL,
    performed_by VARCHAR(120) NOT NULL DEFAULT 'Dr. António Manuel (OCPCA)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_reclass_tenant ON kudiba_accounting.cost_tracking_reclassifications(tenant_id, created_at DESC);

-- 6. HISTÓRICO AUDITÁVEL DE ALTERAÇÕES DE CLASSIFICAÇÃO E GOVERNANÇA
CREATE TABLE IF NOT EXISTS kudiba_accounting.cost_center_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    cost_center_id UUID REFERENCES kudiba_accounting.cost_centers(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    entity_ref VARCHAR(120) NOT NULL,
    details TEXT NOT NULL,
    performed_by VARCHAR(120) NOT NULL DEFAULT 'Admin / Contabilista',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cc_audit_tenant ON kudiba_accounting.cost_center_audit_logs(tenant_id, created_at DESC);
