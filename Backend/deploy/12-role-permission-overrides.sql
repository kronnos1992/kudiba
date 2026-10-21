-- =============================================================================
-- 12. PERSONALIZAÇÃO DE PERMISSÕES DE PERFIS POR ÂMBITO (RBAC multi-empresa)
--
-- kudiba_core.role_permissions guarda as permissões predefinidas do Kudiba ERP
-- (nunca são alteradas em runtime).
--
-- kudiba_core.role_permission_overrides guarda as personalizações:
--   * tenant_id IS NULL  -> âmbito global (definido pelo SYSADMIN; afecta todos os tenants)
--   * tenant_id = <id>   -> âmbito da empresa (definido pelo ADMIN da empresa)
--
-- Hierarquia de resolução: override da empresa > override global > predefinições ERP.
-- Cada linha guarda o conjunto completo de permissões do perfil no respectivo âmbito
-- (um array vazio significa um perfil sem qualquer permissão).
-- =============================================================================

CREATE TABLE IF NOT EXISTS kudiba_core.role_permission_overrides (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE,
    role_id VARCHAR(32) NOT NULL REFERENCES kudiba_core.roles(id) ON DELETE CASCADE,
    permissions VARCHAR(64)[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permission_overrides_tenant
    ON kudiba_core.role_permission_overrides(tenant_id, role_id)
    WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permission_overrides_global
    ON kudiba_core.role_permission_overrides(role_id)
    WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_role_permission_overrides_role
    ON kudiba_core.role_permission_overrides(role_id);

-- -----------------------------------------------------------------------------
-- Perfil de administrador do sistema (acesso total, permissões imutáveis)
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.roles (id, name, description, is_system) VALUES
    ('SYSADMIN', 'Administrador do Sistema',
     'Gestão integral do sistema ERP: empresas, licenças, configurações globais e suporte técnico', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- Módulo de Inventário (permissões em falta no catálogo original)
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.permissions (id, module, name, description) VALUES
    ('inventory:read', 'inventory', 'Consultar Inventário',
     'Consulta de produtos, existências por armazém e histórico de movimentos'),
    ('inventory:manage', 'inventory', 'Gerir Produtos e Existências',
     'Criação e actualização de produtos, unidades de medida e níveis mínimos de stock'),
    ('inventory:transfer', 'inventory', 'Transferir Stock entre Armazéns',
     'Criação e processamento de transferências de mercadorias entre armazéns')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- Perfis de administrador: todas as permissões do catálogo
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'SYSADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- GESTOR_STOCK: inventário, transferências e leitura de documentos
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('GESTOR_STOCK', 'inventory:read'),
    ('GESTOR_STOCK', 'inventory:manage'),
    ('GESTOR_STOCK', 'inventory:transfer'),
    ('GESTOR_STOCK', 'invoices:read')
ON CONFLICT DO NOTHING;
