-- =============================================================================
-- Kudiba ERP: 28-tenant-backups.sql
-- Histórico de cópias de segurança lógicas por tenant (ZIP JSON cifrado AES-256).
-- Idempotente: seguro aplicar repetidamente em kudiba_auth e kudiba_erp.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_core;

CREATE TABLE IF NOT EXISTS kudiba_core.tenant_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    requested_by UUID,
    trigger VARCHAR(16) NOT NULL DEFAULT 'MANUAL',
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    file_name VARCHAR(255),
    file_path VARCHAR(512),
    size_bytes BIGINT,
    sha256 VARCHAR(64),
    encryption VARCHAR(32),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenant_backups_tenant_created
    ON kudiba_core.tenant_backups (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_backups_status
    ON kudiba_core.tenant_backups (status);

CREATE INDEX IF NOT EXISTS idx_tenant_backups_created
    ON kudiba_core.tenant_backups (created_at);
