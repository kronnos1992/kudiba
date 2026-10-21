-- =============================================================================
-- Kudiba ERP — Migração 14: Parametrização de Conexões de Bases de Dados por Tenant
-- Permite configurar bases de dados primárias, réplicas de leitura e sincronização
-- =============================================================================

ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS database_connections JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN kudiba_core.tenants.database_connections IS
    'Configurações de conexões a bases de dados dedicadas, réplicas de leitura e sincronização externa.';
