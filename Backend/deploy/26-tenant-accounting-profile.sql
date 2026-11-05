-- =============================================================================
-- Kudiba ERP — Perfil Contabilístico do Tenant
-- Aplicado nas bases onde existe kudiba_core.tenants (kudiba_auth e
-- kudiba_invoicing). Guarda o setor de atividade e o template de plano de
-- contas que deve ser provisionado no momento do registo do cliente.
-- =============================================================================

ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS sector_code VARCHAR(32) NOT NULL DEFAULT 'GERAL',
    ADD COLUMN IF NOT EXISTS accounting_template_code VARCHAR(64) NOT NULL DEFAULT 'PGC_GENERIC';

CREATE INDEX IF NOT EXISTS idx_tenants_accounting_template
    ON kudiba_core.tenants(accounting_template_code);
