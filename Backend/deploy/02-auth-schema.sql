-- =============================================================================
-- KUDIBA ERP - ESQUEMA DE AUTENTICAÇÃO E CONTROLE DE ACESSO (RBAC)
-- Compatível com: API Gateway Rust, KudibaInvoicing e Módulos Comerciais
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Garante existência dos schemas
CREATE SCHEMA IF NOT EXISTS kudiba_core;
CREATE SCHEMA IF NOT EXISTS kudiba_audit;

-- -----------------------------------------------------------------------------
-- 1. TABELA DE UTILIZADORES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(32),
    full_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON kudiba_core.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON kudiba_core.users(is_active);

-- -----------------------------------------------------------------------------
-- 2. TABELA DE ORGANIZAÇÕES / EMPRESAS (TENANTS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    nif VARCHAR(20) UNIQUE NOT NULL,
    address_detail TEXT,
    city VARCHAR(128),
    country VARCHAR(2) DEFAULT 'AO',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO kudiba_core.tenants (id, slug, company_name, nif, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'demo',
    'Kudiba Comercial & Serviços Lda',
    '5001234567',
    'ACTIVE'
) ON CONFLICT (slug) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. FILIAIS / ESTABELECIMENTOS COMERCIAIS (BRANCHES)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    address_detail TEXT,
    city VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_branch_code UNIQUE (tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON kudiba_core.branches(tenant_id);

-- -----------------------------------------------------------------------------
-- 3. ASSOCIAÇÃO MULTI-TENANT (UTILIZADOR <-> EMPRESA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES kudiba_core.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE,
    default_branch_id UUID REFERENCES kudiba_core.branches(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, INVITED
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_tenant UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON kudiba_core.user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON kudiba_core.user_tenants(tenant_id);

-- -----------------------------------------------------------------------------
-- 4. PAPÉIS E PERMISSÕES (RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.roles (
    id VARCHAR(32) PRIMARY KEY, -- 'ADMIN', 'CONTABILISTA', 'OPERADOR_CAIXA', 'GESTOR_STOCK', 'AUDITOR'
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kudiba_core.permissions (
    id VARCHAR(64) PRIMARY KEY, -- 'invoices:issue', 'invoices:cancel', 'saft:export', etc.
    module VARCHAR(32) NOT NULL, -- 'fiscal', 'pos', 'stock', 'auth', 'core'
    name VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kudiba_core.role_permissions (
    role_id VARCHAR(32) NOT NULL REFERENCES kudiba_core.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) NOT NULL REFERENCES kudiba_core.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS kudiba_core.user_roles (
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    role_id VARCHAR(32) NOT NULL REFERENCES kudiba_core.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tenant_id, role_id),
    FOREIGN KEY (user_id, tenant_id) REFERENCES kudiba_core.user_tenants(user_id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON kudiba_core.user_roles(user_id, tenant_id);

-- -----------------------------------------------------------------------------
-- 5. SESSÕES & REFRESH TOKENS COM ROTAÇÃO AUTOMÁTICA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_core.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES kudiba_core.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    family_id UUID NOT NULL DEFAULT gen_random_uuid(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON kudiba_core.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_family ON kudiba_core.refresh_tokens(user_id, family_id);

-- -----------------------------------------------------------------------------
-- 6. AUDITORIA DE AUTENTICAÇÃO E ACESSOS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kudiba_audit.auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    tenant_id UUID,
    action VARCHAR(32) NOT NULL, -- LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, REFRESH, SWITCH_TENANT, USER_LOCKED
    email_attempted VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON kudiba_audit.auth_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_user ON kudiba_audit.auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_action ON kudiba_audit.auth_audit_log(action);

-- -----------------------------------------------------------------------------
-- SEED DATA: PAPÉIS E PERMISSÕES PADRÃO
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.roles (id, name, description, is_system) VALUES
    ('ADMIN', 'Administrador Geral', 'Acesso total à administração da empresa, utilizadores e configurações fiscais', TRUE),
    ('CONTABILISTA', 'Contabilista Certificado', 'Acesso à faturação, fechos de contas, exportação SAF-T e mapas fiscais', TRUE),
    ('OPERADOR_CAIXA', 'Operador de Caixa (POS)', 'Emissão de faturas no ponto de venda, leitura X e operações diárias', TRUE),
    ('GESTOR_STOCK', 'Gestor de Stocks', 'Controle de inventário, transferências de armazém e guias de transporte', TRUE),
    ('AUDITOR', 'Auditor Fiscal / Revisor', 'Acesso de leitura para auditoria e conferência de trilha fiscal', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO kudiba_core.permissions (id, module, name, description) VALUES
    -- Permissões Fiscais (KudibaInvoicing)
    ('invoices:issue', 'fiscal', 'Emitir Facturas', 'Permissão para emitir facturas, facturas-recibo e outros documentos fiscais'),
    ('invoices:read', 'fiscal', 'Consultar Facturas', 'Permissão para consultar documentos e imprimir vias'),
    ('invoices:cancel', 'fiscal', 'Anular Facturas', 'Permissão para emitir Notas de Crédito de rectificação/anulação'),
    ('fiscal:series:manage', 'fiscal', 'Gerir Séries Fiscais', 'Abertura e configuração de séries de facturação'),
    ('fiscal:saft:export', 'fiscal', 'Exportar SAF-T (AO)', 'Geração e exportação do ficheiro oficial SAF-T'),
    ('fiscal:reports:read', 'fiscal', 'Consultar Mapas Fiscais', 'Acesso aos relatórios de IVA, retenções e imposto de selo'),
    
    -- Permissões POS
    ('pos:sale', 'pos', 'Operar Ponto de Venda', 'Registo de vendas directas no caixa'),
    ('pos:reading_x', 'pos', 'Efectuar Leitura X', 'Conferência intradiária de valores em caixa'),
    ('pos:closing_z', 'pos', 'Efectuar Fecho Z', 'Fecho diário oficial e geração de memória fiscal'),

    -- Permissões de Administração / Auth
    ('users:read', 'auth', 'Listar Utilizadores', 'Visualização de utilizadores da organização'),
    ('users:invite', 'auth', 'Convidar Utilizadores', 'Envio de convites e associação de utilizadores à empresa'),
    ('users:manage_roles', 'auth', 'Gerir Papéis de Utilizadores', 'Atribuição e revogação de funções de utilizadores'),
    ('tenant:settings:manage', 'core', 'Gerir Dados da Empresa', 'Actualização de dados fiscais e cadastrais da empresa')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Associação Papel -> Permissões
-- ADMIN: Todas as permissões
INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

-- CONTABILISTA: Permissões Fiscais + Relatórios + Leitura
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('CONTABILISTA', 'invoices:issue'),
    ('CONTABILISTA', 'invoices:read'),
    ('CONTABILISTA', 'invoices:cancel'),
    ('CONTABILISTA', 'fiscal:series:manage'),
    ('CONTABILISTA', 'fiscal:saft:export'),
    ('CONTABILISTA', 'fiscal:reports:read'),
    ('CONTABILISTA', 'pos:reading_x'),
    ('CONTABILISTA', 'pos:closing_z'),
    ('CONTABILISTA', 'users:read')
ON CONFLICT DO NOTHING;

-- OPERADOR_CAIXA: Vendas no POS, Leitura X e Emissão
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('OPERADOR_CAIXA', 'invoices:issue'),
    ('OPERADOR_CAIXA', 'invoices:read'),
    ('OPERADOR_CAIXA', 'pos:sale'),
    ('OPERADOR_CAIXA', 'pos:reading_x')
ON CONFLICT DO NOTHING;

-- AUDITOR: Leitura
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('AUDITOR', 'invoices:read'),
    ('AUDITOR', 'fiscal:reports:read'),
    ('AUDITOR', 'fiscal:saft:export'),
    ('AUDITOR', 'users:read')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- SEED DATA: FILIAL PRINCIPAL E UTILIZADOR DEMO
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.branches (id, tenant_id, code, name, city) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'SEDE',
    'Sede Principal - Luanda',
    'Luanda'
) ON CONFLICT (tenant_id, code) DO NOTHING;

-- No privileged demo account is seeded. Provision the first administrator
-- through a controlled, one-time bootstrap process outside this schema.
