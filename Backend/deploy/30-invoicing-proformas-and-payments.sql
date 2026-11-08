CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE IF NOT EXISTS kudiba_core.proformas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    document_number VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_nif VARCHAR(32),
    customer_address TEXT,
    customer_city VARCHAR(128),
    customer_country VARCHAR(2),
    currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    lines JSONB NOT NULL,
    net_total NUMERIC(18, 4) NOT NULL,
    tax_total NUMERIC(18, 4) NOT NULL,
    gross_total NUMERIC(18, 4) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    converted_invoice_id UUID REFERENCES kudiba_core.invoices(id) ON DELETE RESTRICT,
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_proforma_number UNIQUE (tenant_id, document_number),
    CONSTRAINT ck_proforma_status CHECK (status IN ('OPEN', 'CONVERTING', 'CONVERTED')),
    CONSTRAINT ck_proforma_conversion CHECK (
        (status = 'CONVERTED' AND converted_invoice_id IS NOT NULL)
        OR (status <> 'CONVERTED' AND converted_invoice_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_proformas_tenant_created
    ON kudiba_core.proformas(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS kudiba_core.invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES kudiba_core.invoices(id) ON DELETE RESTRICT,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(40) NOT NULL,
    payer_name VARCHAR(255) NOT NULL,
    proof_file_name VARCHAR(255),
    proof_content_type VARCHAR(80),
    proof_data BYTEA,
    proof_sha256 VARCHAR(64),
    cashier_user_id VARCHAR(128) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_invoice_payment_proof CHECK (
        (proof_data IS NULL AND proof_file_name IS NULL AND proof_content_type IS NULL AND proof_sha256 IS NULL)
        OR (proof_data IS NOT NULL AND proof_file_name IS NOT NULL AND proof_content_type IS NOT NULL AND proof_sha256 IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_invoice
    ON kudiba_core.invoice_payments(tenant_id, invoice_id, received_at DESC);

ALTER TABLE kudiba_core.proformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudiba_core.proformas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON kudiba_core.proformas;
CREATE POLICY tenant_isolation_policy ON kudiba_core.proformas
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

ALTER TABLE kudiba_core.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudiba_core.invoice_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON kudiba_core.invoice_payments;
CREATE POLICY tenant_isolation_policy ON kudiba_core.invoice_payments
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());

CREATE OR REPLACE FUNCTION kudiba_core.prevent_invoice_payment_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Registos de pagamento são imutáveis; registe uma operação de correcção.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_invoice_payment_mutation ON kudiba_core.invoice_payments;
CREATE TRIGGER trg_prevent_invoice_payment_mutation
    BEFORE UPDATE OR DELETE ON kudiba_core.invoice_payments
    FOR EACH ROW EXECUTE FUNCTION kudiba_core.prevent_invoice_payment_mutation();
