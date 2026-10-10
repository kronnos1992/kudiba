-- =============================================================================
-- KUDIBA ERP - ESQUEMA INICIAL DE BASE DE DADOS (POSTGRESQL 16+)
-- Conformidade: Decreto Presidencial n.º 71/25 de Angola (AGT)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schemas estruturados
CREATE SCHEMA IF NOT EXISTS kudiba_core;
CREATE SCHEMA IF NOT EXISTS kudiba_audit;

-- -----------------------------------------------------------------------------
-- 1. TABELA DE ORGANIZAÇÕES (MULTI-TENANCY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    nif VARCHAR(20) UNIQUE NOT NULL,
    address_detail TEXT,
    city VARCHAR(128),
    country VARCHAR(2),
    commercial_registry VARCHAR(64),
    tax_office_code VARCHAR(32),
    agt_cert_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CONTINGENCY
    contingency_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. REGIMES TRIBUTÁRIOS DE IVA (CIVA)
-- -----------------------------------------------------------------------------
-- Enquadramento fiscal do sujeito passivo por volume de facturação (Kwanza).
-- As frações são [min_turnover, max_turnover] inclusivas em ambas as pontas,
-- excepto a última que não tem tecto. A resolução é total e sem sobreposição:
-- qualquer volume de facturação cai exactamente num regime.
CREATE TABLE IF NOT EXISTS kudiba_core.tax_regimes (
    regime_code VARCHAR(32) PRIMARY KEY,          -- REGIME_EXCLUSAO, REGIME_SIMPLIFICADO, REGIME_GERAL
    display_name VARCHAR(64) NOT NULL,
    min_turnover NUMERIC(18, 4) NOT NULL,
    max_turnover NUMERIC(18, 4),                  -- NULL = sem tecto superior
    standard_rate NUMERIC(5, 2) NOT NULL,         -- Taxa de IVA do regime (14.00 / 7.00 / 0.00)
    allowed_rates NUMERIC(5, 2)[] NOT NULL,       -- Taxas que o regime pode aplicar nas linhas
    requires_credit_note BOOLEAN NOT NULL,        -- Regime Geral: exige crédito fiscal (dedução)
    is_vat_exempt BOOLEAN NOT NULL,               -- Exclusão: desonerado das obrigações do IVA
    legal_basis VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_tax_regimes_rate_range CHECK (
        min_turnover >= 0 AND (max_turnover IS NULL OR max_turnover >= min_turnover)
    ),
    CONSTRAINT ck_tax_regimes_exempt_rate CHECK (
        is_vat_exempt = FALSE OR standard_rate = 0.00
    )
);

-- Códigos de isenção oficiais da AGT (art.º 12.º do CIVA).
-- Tabela de referência: a validação de formato "M" + 2 dígitos é feita no domínio.
CREATE TABLE IF NOT EXISTS kudiba_core.tax_exemption_codes (
    code VARCHAR(16) PRIMARY KEY,                 -- M00, M02, M04 ...
    description VARCHAR(255) NOT NULL,
    legal_basis VARCHAR(128) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_tax_exemption_code_format CHECK (code ~ '^M[0-9]{2}$')
);

-- -----------------------------------------------------------------------------
-- REGIMES DE IVA (CIVA) — TABELA DE REFERÊNCIA
-- -----------------------------------------------------------------------------
-- Enquadramento por volume de facturação anual (Kwanza):
--   REGIME_EXCLUSAO     : até 25.000.000,00                     -> isento (0.00)
--   REGIME_SIMPLIFICADO : > 25.000.000,00 e < 350.000.000,00   -> 7.00
--   REGIME_GERAL        : >= 350.000.000,00                     -> 14.00 (crédito fiscal)
--
-- As fracções são contíguas e fecham todo o espaço de volumes: a soma dos
-- intervalos é (0, +∞) sem sobreposição, pelo que a resolução do regime por
-- volume é sempre bem definida.
INSERT INTO kudiba_core.tax_regimes (
    regime_code, display_name, min_turnover, max_turnover, standard_rate,
    allowed_rates, requires_credit_note, is_vat_exempt, legal_basis
) VALUES
    ('REGIME_EXCLUSAO', 'Regime de Exclusão', 0, 25000000.00, 0.00,
     ARRAY[0.00]::NUMERIC(5,2)[], FALSE, TRUE,
     'Regime de exclusão: sujeito passivo desonerado das obrigações do IVA'),
    ('REGIME_SIMPLIFICADO', 'Regime Simplificado', 25000000.01, 349999999.99, 7.00,
     ARRAY[7.00, 0.00]::NUMERIC(5,2)[], FALSE, FALSE,
     'Regime simplificado de IVA: sem dedução do IVA suportado'),
    ('REGIME_GERAL', 'Regime Geral', 350000000.00, NULL, 14.00,
     ARRAY[14.00, 7.00, 5.00, 0.00]::NUMERIC(5,2)[], TRUE, FALSE,
     'Regime geral de IVA: dedução do IVA suportado (crédito fiscal)')
ON CONFLICT (regime_code) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    min_turnover = EXCLUDED.min_turnover,
    max_turnover = EXCLUDED.max_turnover,
    standard_rate = EXCLUDED.standard_rate,
    allowed_rates = EXCLUDED.allowed_rates,
    requires_credit_note = EXCLUDED.requires_credit_note,
    is_vat_exempt = EXCLUDED.is_vat_exempt,
    legal_basis = EXCLUDED.legal_basis;

-- Códigos de isenção do art.º 12.º do CIVA (referência; validado no domínio)
INSERT INTO kudiba_core.tax_exemption_codes (code, description, legal_basis) VALUES
    ('M00', 'Isenção nos termos da alínea a) do n.º 1 do art.º 12.º do CIVA', 'art.º 12.º CIVA'),
    ('M02', 'Transmissão de bens e prestação de serviços isentas de IVA', 'art.º 12.º CIVA'),
    ('M04', 'Isenção de bens da Cesta Básica', 'Lei n.º 42/20')
ON CONFLICT (code) DO UPDATE SET
    description = EXCLUDED.description,
    legal_basis = EXCLUDED.legal_basis;

-- Regime aplicado ao sujeito passivo, resolvido por volume de facturação.
-- O default é REGIME_GERAL (não REGIME_EXCLUSAO) por uma razão de segurança
-- fiscal: numa base já povoada, esta coluna fica preenchida pelo default e um
-- default permissivo isentaria silenciosamente empresas que liquidam IVA.
-- O erro conservador é cobrar a quem não deve, não o inverso.
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS tax_regime_code VARCHAR(32) DEFAULT 'REGIME_GERAL';

-- Resolução automática por volume vs. enquadramento declarado no cadastro da AGT
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS tax_regime_source VARCHAR(16) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS tax_regime_basis_turnover NUMERIC(18, 4);
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS tax_regime_resolved_at TIMESTAMPTZ;
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS tax_regime_resolved_year INT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_tenants_tax_regime'
    ) THEN
        ALTER TABLE kudiba_core.tenants
            ADD CONSTRAINT fk_tenants_tax_regime
            FOREIGN KEY (tax_regime_code)
            REFERENCES kudiba_core.tax_regimes(regime_code)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. SÉRIES DOCUMENTAIS E NUMERAÇÃO CRIPTOGRÁFICA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.series_fiscais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    document_type VARCHAR(10) NOT NULL, -- FT, FR, NC, ND, RC, GR, GT
    series_code VARCHAR(32) NOT NULL,    -- Ex: "KUD26"
    fiscal_year INT NOT NULL,           -- Ex: 2026
    current_sequence BIGINT NOT NULL DEFAULT 0,
    last_hash VARCHAR(256) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_series UNIQUE (tenant_id, document_type, series_code, fiscal_year)
);

-- -----------------------------------------------------------------------------
-- 4. CABEÇALHOS DE DOCUMENTOS FISCAIS (IMUTÁVEIS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    series_id UUID NOT NULL REFERENCES kudiba_core.series_fiscais(id) ON DELETE RESTRICT,
    document_number VARCHAR(64) NOT NULL, -- Ex: "FT KUD26/000001"
    sequence_number BIGINT NOT NULL,
    document_type VARCHAR(10) NOT NULL,
    issuer_nif VARCHAR(20) NOT NULL,
    issuer_address TEXT NOT NULL,
    issuer_city VARCHAR(128) NOT NULL,
    issuer_country VARCHAR(2) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_nif VARCHAR(32) NOT NULL DEFAULT 'Consumidor Final',
    customer_address TEXT,
    customer_city VARCHAR(128),
    customer_country VARCHAR(2),
    source_document_number VARCHAR(64),
    payment_methods TEXT[] NOT NULL DEFAULT '{}',
    currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    net_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    gross_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    withholding_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    stamp_duty_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    
    -- Criptografia mandatada pelo Decreto Presidencial n.º 71/25
    hash_sha256 VARCHAR(256) NOT NULL,
    signature_rsa_base64 TEXT NOT NULL,
    validation_chars VARCHAR(4) NOT NULL, -- 1º, 11º, 21º, 31º caracteres
    key_version VARCHAR(16) NOT NULL DEFAULT '1',
    is_contingency BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Regime de IVA aplicado no momento da emissão (fotografia fiscal imutável).
    -- Fica congelado na fatura para que a SAF-T refita o enquadramento histórico.
    tax_regime_code VARCHAR(32) NOT NULL DEFAULT 'REGIME_GERAL',
    
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    system_entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_document_number UNIQUE (tenant_id, document_number)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_tax_regime'
    ) THEN
        ALTER TABLE kudiba_core.invoices
            ADD CONSTRAINT fk_invoices_tax_regime
            FOREIGN KEY (tax_regime_code)
            REFERENCES kudiba_core.tax_regimes(regime_code)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. LINHAS DE ARTIGOS DA FATURA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES kudiba_core.invoices(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    product_code VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 14.00, -- Validado contra tax_regimes.allowed_rates na emissão
    tax_exemption_code VARCHAR(16),               -- Ex: "M02", "M04" (obrigatório se tax_rate = 0.00)
    line_total NUMERIC(18, 4) NOT NULL,
    CONSTRAINT uq_invoice_line UNIQUE (invoice_id, line_number),
    CONSTRAINT ck_invoice_line_tax_rate_non_negative CHECK (tax_rate >= 0),
    -- Coerência IVA/código de isenção: isentar exige motivo legal declarado
    CONSTRAINT ck_invoice_line_exemption_coherent CHECK (
        (tax_rate = 0.00 AND tax_exemption_code IS NOT NULL)
        OR (tax_rate > 0.00 AND tax_exemption_code IS NULL)
    )
);

-- Campos fiscais aditivos para bases criadas antes desta versão do serviço.
ALTER TABLE kudiba_core.invoices
    ADD COLUMN IF NOT EXISTS issuer_nif VARCHAR(20),
    ADD COLUMN IF NOT EXISTS issuer_address TEXT,
    ADD COLUMN IF NOT EXISTS issuer_city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS issuer_country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS customer_address TEXT,
    ADD COLUMN IF NOT EXISTS customer_city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS customer_country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS source_document_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS payment_methods TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS withholding_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stamp_duty_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS vehicle_registration VARCHAR(32),
    ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS carrier_nif VARCHAR(32),
    ADD COLUMN IF NOT EXISTS load_address TEXT,
    ADD COLUMN IF NOT EXISTS load_city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS load_country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS load_date_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unload_address TEXT,
    ADD COLUMN IF NOT EXISTS unload_city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS unload_country VARCHAR(2),
    ADD COLUMN IF NOT EXISTS unload_date_time TIMESTAMPTZ;
ALTER TABLE kudiba_core.invoice_lines
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(18, 4) NOT NULL DEFAULT 0;
ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS address_detail TEXT,
    ADD COLUMN IF NOT EXISTS city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS country VARCHAR(2);

-- Outbox transacional para o sistema de contabilidade consumir sem perder eventos.
CREATE TABLE IF NOT EXISTS kudiba_core.accounting_outbox (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES kudiba_core.invoices(id) ON DELETE RESTRICT,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    CONSTRAINT uq_accounting_outbox_invoice_event UNIQUE (invoice_id, event_type)
);
CREATE INDEX IF NOT EXISTS ix_accounting_outbox_pending
    ON kudiba_core.accounting_outbox (created_at)
    WHERE published_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_line_exemption_code'
    ) THEN
        ALTER TABLE kudiba_core.invoice_lines
            ADD CONSTRAINT fk_invoice_line_exemption_code
            FOREIGN KEY (tax_exemption_code)
            REFERENCES kudiba_core.tax_exemption_codes(code)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. TRILHA DE AUDITORIA IMUTÁVEL (AUDIT LOG - AGT)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_audit.fiscal_audit_trail (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    table_name VARCHAR(64) NOT NULL,
    action VARCHAR(16) NOT NULL, -- INSERT, ATTEMPTED_UPDATE, ATTEMPTED_DELETE
    document_reference VARCHAR(64),
    payload JSONB NOT NULL,
    actor_user_id VARCHAR(64),
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger de segurança: impede DELETE ou UPDATE físico em faturas emitidas
CREATE OR REPLACE FUNCTION kudiba_core.prevent_invoice_mutation()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO kudiba_audit.fiscal_audit_trail (
        tenant_id, table_name, action, document_reference, payload, actor_user_id, created_at
    ) VALUES (
        OLD.tenant_id, 'invoices', 'ATTEMPTED_' || TG_OP, OLD.document_number,
        row_to_json(OLD)::jsonb,
        COALESCE(NULLIF(current_setting('app.actor_user_id', TRUE), ''), session_user), NOW()
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_invoices ON kudiba_core.invoices;
CREATE TRIGGER trg_protect_invoices
BEFORE UPDATE OR DELETE ON kudiba_core.invoices
FOR EACH ROW
EXECUTE FUNCTION kudiba_core.prevent_invoice_mutation();

CREATE OR REPLACE FUNCTION kudiba_core.audit_invoice_issue()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO kudiba_audit.fiscal_audit_trail (
        tenant_id, table_name, action, document_reference, payload, actor_user_id, created_at
    ) VALUES (
        NEW.tenant_id, 'invoices', 'INSERT', NEW.document_number,
        row_to_json(NEW)::jsonb,
        COALESCE(NULLIF(current_setting('app.actor_user_id', TRUE), ''), session_user), NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_invoice_issue ON kudiba_core.invoices;
CREATE TRIGGER trg_audit_invoice_issue
AFTER INSERT ON kudiba_core.invoices
FOR EACH ROW
EXECUTE FUNCTION kudiba_core.audit_invoice_issue();

CREATE OR REPLACE FUNCTION kudiba_core.prevent_invoice_line_mutation()
RETURNS TRIGGER AS $$
DECLARE
    invoice_row kudiba_core.invoices%ROWTYPE;
    changed_line JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT * INTO invoice_row FROM kudiba_core.invoices WHERE id = OLD.invoice_id;
        changed_line := row_to_json(OLD)::jsonb;
    ELSE
        SELECT * INTO invoice_row FROM kudiba_core.invoices WHERE id = NEW.invoice_id;
        changed_line := row_to_json(NEW)::jsonb;
    END IF;
    INSERT INTO kudiba_audit.fiscal_audit_trail (
        tenant_id, table_name, action, document_reference, payload, actor_user_id, created_at
    ) VALUES (
        invoice_row.tenant_id, 'invoice_lines', 'ATTEMPTED_' || TG_OP,
        invoice_row.document_number, changed_line,
        COALESCE(NULLIF(current_setting('app.actor_user_id', TRUE), ''), session_user), NOW()
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_invoice_lines ON kudiba_core.invoice_lines;
CREATE TRIGGER trg_protect_invoice_lines
BEFORE UPDATE OR DELETE ON kudiba_core.invoice_lines
FOR EACH ROW
EXECUTE FUNCTION kudiba_core.prevent_invoice_line_mutation();

-- -----------------------------------------------------------------------------
-- 7. FECHOS FISCAIS DE CAIXA / MEMÓRIA POS (LEITURA X E FECHO Z)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.pos_z_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    fiscal_year INT NOT NULL,
    sequence_number BIGINT NOT NULL,
    z_number VARCHAR(64) NOT NULL, -- Ex: "Z 2026/000001"
    closing_date DATE NOT NULL,
    pos_terminal_id VARCHAR(64),
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    first_document_number VARCHAR(64),
    last_document_number VARCHAR(64),
    invoices_count BIGINT NOT NULL DEFAULT 0,
    credit_notes_count BIGINT NOT NULL DEFAULT 0,
    
    gross_sales_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    discounts_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    credit_notes_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    net_sales_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    vat_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    withholding_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    stamp_duty_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    final_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    
    taxes_summary JSONB NOT NULL DEFAULT '[]',
    payment_methods_summary JSONB NOT NULL DEFAULT '[]',
    
    actor_user_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_z_report_number UNIQUE (tenant_id, z_number),
    CONSTRAINT uq_tenant_z_sequence UNIQUE (tenant_id, fiscal_year, sequence_number)
);

-- -----------------------------------------------------------------------------
-- TENANT DE DEMONSTRAÇÃO
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.tenants (id, slug, company_name, nif, agt_cert_number, tax_regime_code)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'demo',
    'Kudiba Comercial & Serviços Lda',
    '5001234567',
    'CERT-AGT-2026/0042',
    'REGIME_GERAL'
) ON CONFLICT (slug) DO NOTHING;

