CREATE OR REPLACE FUNCTION get_current_tenant_id() RETURNS uuid AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_tenant', true), '')::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_terminals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_code VARCHAR(64) NOT NULL,
    name VARCHAR(128) NOT NULL,
    warehouse_id UUID,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_PAIRING',
    hardware_fingerprint VARCHAR(256),
    device_public_key BYTEA,
    credential_epoch BIGINT NOT NULL DEFAULT 1,
    paired_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_terminal_code UNIQUE (tenant_id, terminal_code)
);

CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_pairing_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id) ON DELETE CASCADE,
    pairing_token_hash BYTEA NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    failed_attempts SMALLINT NOT NULL DEFAULT 0,
    created_by_user_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_pairing_token_hash UNIQUE (pairing_token_hash)
);

CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id) ON DELETE CASCADE,
    device_kind VARCHAR(32) NOT NULL,
    device_slot VARCHAR(64) NOT NULL,
    model VARCHAR(128) NOT NULL,
    connection_mode VARCHAR(32) NOT NULL,
    connection_params JSONB NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '{}',
    profile_signature VARCHAR(256),
    is_certified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pos_device_terminal_slot UNIQUE (tenant_id, terminal_id, device_kind, device_slot)
);

CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id) ON DELETE CASCADE,
    device_id UUID REFERENCES kudiba_treasury.pos_devices(id) ON DELETE SET NULL,
    sale_id UUID,
    job_class VARCHAR(32) NOT NULL,
    document_number VARCHAR(64) NOT NULL,
    copy_type VARCHAR(16) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    state VARCHAR(32) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    submit_lease_expires_at TIMESTAMPTZ,
    device_error TEXT,
    actor_user_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT uq_pos_print_job_key UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS kudiba_treasury.pos_drawer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    terminal_id UUID NOT NULL REFERENCES kudiba_treasury.pos_terminals(id) ON DELETE CASCADE,
    device_id UUID REFERENCES kudiba_treasury.pos_devices(id) ON DELETE SET NULL,
    sale_id UUID,
    reason VARCHAR(32) NOT NULL,
    amount NUMERIC(18, 4),
    actor_user_id VARCHAR(64) NOT NULL,
    authorized_by_user_id VARCHAR(64),
    state VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kudiba_treasury.pos_terminals
    ADD COLUMN IF NOT EXISTS hardware_fingerprint VARCHAR(256),
    ADD COLUMN IF NOT EXISTS device_public_key BYTEA,
    ADD COLUMN IF NOT EXISTS credential_epoch BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS paired_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE kudiba_treasury.pos_pairing_tokens
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_attempts SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE kudiba_treasury.pos_devices
    ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS is_certified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE kudiba_treasury.pos_print_jobs
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS submit_lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS device_error TEXT,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name FROM pg_constraint
     WHERE conname = 'uq_pos_terminal_code' AND conrelid = 'kudiba_treasury.pos_terminals'::regclass;
    IF constraint_name IS NULL THEN
        ALTER TABLE kudiba_treasury.pos_terminals
            ADD CONSTRAINT uq_pos_terminal_code UNIQUE (tenant_id, terminal_code);
    END IF;

    SELECT conname INTO constraint_name FROM pg_constraint
     WHERE conname = 'uq_pos_pairing_token_hash' AND conrelid = 'kudiba_treasury.pos_pairing_tokens'::regclass;
    IF constraint_name IS NULL THEN
        ALTER TABLE kudiba_treasury.pos_pairing_tokens
            ADD CONSTRAINT uq_pos_pairing_token_hash UNIQUE (pairing_token_hash);
    END IF;

    SELECT conname INTO constraint_name FROM pg_constraint
     WHERE conname = 'uq_pos_device_terminal_slot' AND conrelid = 'kudiba_treasury.pos_devices'::regclass;
    IF constraint_name IS NULL THEN
        ALTER TABLE kudiba_treasury.pos_devices
            ADD CONSTRAINT uq_pos_device_terminal_slot UNIQUE (tenant_id, terminal_id, device_kind, device_slot);
    END IF;

    SELECT conname INTO constraint_name FROM pg_constraint
     WHERE conname = 'uq_pos_print_job_key' AND conrelid = 'kudiba_treasury.pos_print_jobs'::regclass;
    IF constraint_name IS NULL THEN
        ALTER TABLE kudiba_treasury.pos_print_jobs
            ADD CONSTRAINT uq_pos_print_job_key UNIQUE (tenant_id, idempotency_key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pos_terminals_tenant_status
    ON kudiba_treasury.pos_terminals (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_pairing_tokens_tenant_terminal
    ON kudiba_treasury.pos_pairing_tokens (tenant_id, terminal_id);
CREATE INDEX IF NOT EXISTS idx_pos_pairing_tokens_expires
    ON kudiba_treasury.pos_pairing_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_pos_devices_tenant_terminal
    ON kudiba_treasury.pos_devices (tenant_id, terminal_id);
CREATE INDEX IF NOT EXISTS idx_pos_print_jobs_tenant_terminal_state
    ON kudiba_treasury.pos_print_jobs (tenant_id, terminal_id, state);
CREATE INDEX IF NOT EXISTS idx_pos_print_jobs_pending
    ON kudiba_treasury.pos_print_jobs (created_at)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pos_drawer_events_tenant_terminal
    ON kudiba_treasury.pos_drawer_events (tenant_id, terminal_id, created_at);

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'pos_terminals', 'pos_pairing_tokens', 'pos_devices', 'pos_print_jobs', 'pos_drawer_events'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables WHERE schemaname = 'kudiba_treasury' AND tablename = tbl
        ) THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE kudiba_treasury.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE kudiba_treasury.%I FORCE ROW LEVEL SECURITY', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON kudiba_treasury.%I', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON kudiba_treasury.%I FOR ALL '
            'USING (tenant_id = get_current_tenant_id()) '
            'WITH CHECK (tenant_id = get_current_tenant_id())',
            tbl
        );
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.kudiba_resolve_pos_pairing_token(p_hash BYTEA)
RETURNS TABLE (
    token_tenant_id UUID,
    token_terminal_id UUID,
    token_expires_at TIMESTAMPTZ,
    token_consumed_at TIMESTAMPTZ,
    token_revoked_at TIMESTAMPTZ,
    token_failed_attempts SMALLINT,
    token_terminal_status VARCHAR,
    token_credential_epoch BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT t.tenant_id, t.terminal_id, t.expires_at, t.consumed_at, t.revoked_at,
           t.failed_attempts, tr.status, tr.credential_epoch
      FROM kudiba_treasury.pos_pairing_tokens t
      JOIN kudiba_treasury.pos_terminals tr
        ON tr.tenant_id = t.tenant_id AND tr.id = t.terminal_id
     WHERE t.pairing_token_hash = p_hash
     LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.kudiba_resolve_pos_terminal(p_terminal_id UUID)
RETURNS TABLE (
    terminal_tenant_id UUID,
    terminal_status VARCHAR,
    terminal_credential_epoch BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT tenant_id, status, credential_epoch
      FROM kudiba_treasury.pos_terminals
     WHERE id = p_terminal_id
     LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.kudiba_resolve_pos_pairing_token(BYTEA) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kudiba_resolve_pos_terminal(UUID) FROM PUBLIC;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kudiba_treasury_app') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.kudiba_resolve_pos_pairing_token(BYTEA) TO kudiba_treasury_app';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.kudiba_resolve_pos_terminal(UUID) TO kudiba_treasury_app';
    END IF;
END $$;
