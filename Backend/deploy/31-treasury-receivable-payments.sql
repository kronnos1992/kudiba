CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE IF NOT EXISTS kudiba_treasury.invoice_receivable_payments (
    payment_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    invoice_id VARCHAR(100) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receivable_payments_invoice
    ON kudiba_treasury.invoice_receivable_payments(tenant_id, invoice_id);

ALTER TABLE kudiba_treasury.invoice_receivable_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kudiba_treasury.invoice_receivable_payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON kudiba_treasury.invoice_receivable_payments;
CREATE POLICY tenant_isolation_policy ON kudiba_treasury.invoice_receivable_payments
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());
