-- =============================================================================
-- Kudiba ERP: 32-pos-checkout-schema.sql
-- Coordenação durável de checkout POS: intenção idempotente + eventos pendentes.
-- A fatura continua a ser emitida pelo motor fiscal; este registo não a substitui.
-- =============================================================================

CREATE TABLE IF NOT EXISTS kudiba_core.pos_checkout_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    idempotency_key VARCHAR(160) NOT NULL,
    terminal_id UUID,
    state VARCHAR(32) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    invoice_id UUID REFERENCES kudiba_core.invoices(id) ON DELETE RESTRICT,
    document_number VARCHAR(64),
    result JSONB,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_checkout_intent_key UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS kudiba_core.pos_checkout_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE RESTRICT,
    checkout_id UUID NOT NULL REFERENCES kudiba_core.pos_checkout_intents(id) ON DELETE RESTRICT,
    event_type VARCHAR(48) NOT NULL,
    payload JSONB NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_checkout_event_key UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_pos_checkout_events_pending
    ON kudiba_core.pos_checkout_events (created_at)
    WHERE published_at IS NULL;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['pos_checkout_intents', 'pos_checkout_events']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = 'kudiba_core' AND tablename = tbl
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE kudiba_core.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE kudiba_core.%I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON kudiba_core.%I', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON kudiba_core.%I FOR ALL '
            'USING (tenant_id = get_current_tenant_id()) '
            'WITH CHECK (tenant_id = get_current_tenant_id())',
            tbl
        );
    END LOOP;
END $$;
