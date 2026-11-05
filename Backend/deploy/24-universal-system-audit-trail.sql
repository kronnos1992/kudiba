-- =============================================================================
-- KUDIBA ERP: TRILHA DE AUDITORIA UNIVERSAL DO SISTEMA (AUDIT TRAIL DDL)
-- Idempotente: seguro para execução em todas as bases de dados isoladas
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_audit;

CREATE TABLE IF NOT EXISTS kudiba_audit.system_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    document_reference VARCHAR(100),
    actor_user_id VARCHAR(100) DEFAULT 'sistema',
    actor_name VARCHAR(255) DEFAULT 'Sistema / Administrador',
    ip_address INET,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sys_audit_tenant_created 
    ON kudiba_audit.system_audit_trail(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_module 
    ON kudiba_audit.system_audit_trail(tenant_id, module);
CREATE INDEX IF NOT EXISTS idx_sys_audit_action 
    ON kudiba_audit.system_audit_trail(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_sys_audit_doc_ref 
    ON kudiba_audit.system_audit_trail(tenant_id, document_reference);

-- Conceder permissões para o schema e tabelas para garantir compatibilidade
-- com os perfis de aplicação (kudiba_app, kudiba_*_app, etc.)
GRANT USAGE ON SCHEMA kudiba_audit TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA kudiba_audit TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA kudiba_audit GRANT ALL PRIVILEGES ON TABLES TO PUBLIC;
