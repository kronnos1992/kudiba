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
    commercial_registry VARCHAR(64),
    tax_office_code VARCHAR(32),
    agt_cert_number VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, CONTINGENCY
    contingency_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. SÉRIES DOCUMENTAIS E NUMERAÇÃO CRIPTOGRÁFICA
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
-- 3. CABEÇALHOS DE DOCUMENTOS FISCAIS (IMUTÁVEIS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    series_id UUID NOT NULL REFERENCES kudiba_core.series_fiscais(id) ON DELETE RESTRICT,
    document_number VARCHAR(64) NOT NULL, -- Ex: "FT KUD26/000001"
    sequence_number BIGINT NOT NULL,
    document_type VARCHAR(10) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_nif VARCHAR(32) NOT NULL DEFAULT 'Consumidor Final',
    currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    net_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    gross_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
    
    -- Criptografia mandatada pelo Decreto Presidencial n.º 71/25
    hash_sha256 VARCHAR(256) NOT NULL,
    signature_rsa_base64 TEXT NOT NULL,
    validation_chars VARCHAR(4) NOT NULL, -- 1º, 11º, 21º, 31º caracteres
    key_version VARCHAR(16) NOT NULL DEFAULT '1',
    is_contingency BOOLEAN NOT NULL DEFAULT FALSE,
    
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    system_entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_document_number UNIQUE (tenant_id, document_number)
);

-- -----------------------------------------------------------------------------
-- 4. LINHAS DE ARTIGOS DA FATURA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES kudiba_core.invoices(id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    product_code VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_price NUMERIC(18, 4) NOT NULL,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 14.00, -- IVA Normal 14%
    tax_exemption_code VARCHAR(16),               -- Ex: "M02", "M04"
    line_total NUMERIC(18, 4) NOT NULL,
    CONSTRAINT uq_invoice_line UNIQUE (invoice_id, line_number)
);

-- -----------------------------------------------------------------------------
-- 5. TRILHA DE AUDITORIA IMUTÁVEL (AUDIT LOG - AGT)
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
        tenant_id, table_name, action, document_reference, payload, created_at
    ) VALUES (
        OLD.tenant_id, 'invoices', 'ATTEMPTED_' || TG_OP, OLD.document_number, row_to_json(OLD)::jsonb, NOW()
    );
    RAISE EXCEPTION 'VIOLAÇÃO REGULATÓRIA (AGT n.º 71/25): Documentos fiscais emitidos são estritamente imutáveis. Emita uma Nota de Crédito/Débito para retificações.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_invoices ON kudiba_core.invoices;
CREATE TRIGGER trg_protect_invoices
BEFORE UPDATE OR DELETE ON kudiba_core.invoices
FOR EACH ROW
EXECUTE FUNCTION kudiba_core.prevent_invoice_mutation();

-- -----------------------------------------------------------------------------
-- TENANT DE DEMONSTRAÇÃO
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.tenants (id, slug, company_name, nif, agt_cert_number)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'demo',
    'Kudiba Comercial & Serviços Lda',
    '5001234567',
    'CERT-AGT-2026/0042'
) ON CONFLICT (slug) DO NOTHING;
