-- =============================================================================
-- 10. CATÁLOGO DE PAPÉIS POR TENANT (RBAC multi-empresa)
-- Perfis de sistema (tenant_id NULL) continuam comuns a todas as empresas.
-- Perfis personalizados passam a pertencer a um tenant específico.
-- =============================================================================
ALTER TABLE kudiba_core.roles
    ADD COLUMN IF NOT EXISTS tenant_id UUID NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON kudiba_core.roles(tenant_id);
