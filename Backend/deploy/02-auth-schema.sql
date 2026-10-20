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
    trade_name VARCHAR(255),
    nif VARCHAR(20) UNIQUE NOT NULL,
    address_detail TEXT,
    city VARCHAR(128),
    province VARCHAR(128),
    postal_code VARCHAR(32),
    country VARCHAR(2) DEFAULT 'AO',
    phone VARCHAR(64),
    email VARCHAR(255),
    website VARCHAR(255),
    logo_data_url TEXT,
    commercial_registry VARCHAR(64),
    share_capital VARCHAR(64),
    currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    tax_regime_code VARCHAR(32) NOT NULL DEFAULT 'REGIME_GERAL',
    tax_office_code VARCHAR(128),
    agt_cert_number VARCHAR(64),
    default_withholding_rate NUMERIC(5, 2) NOT NULL DEFAULT 6.50,
    invoice_footer_notes TEXT,
    bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    contingency_started_at TIMESTAMPTZ,
    license_valid_until TIMESTAMPTZ,
    subscribed_modules TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE kudiba_core.tenants
    ADD COLUMN IF NOT EXISTS trade_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS address_detail TEXT,
    ADD COLUMN IF NOT EXISTS city VARCHAR(128),
    ADD COLUMN IF NOT EXISTS province VARCHAR(128),
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'AO',
    ADD COLUMN IF NOT EXISTS phone VARCHAR(64),
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS website VARCHAR(255),
    ADD COLUMN IF NOT EXISTS logo_data_url TEXT,
    ADD COLUMN IF NOT EXISTS commercial_registry VARCHAR(64),
    ADD COLUMN IF NOT EXISTS share_capital VARCHAR(64),
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'AOA',
    ADD COLUMN IF NOT EXISTS tax_regime_code VARCHAR(32) NOT NULL DEFAULT 'REGIME_GERAL',
    ADD COLUMN IF NOT EXISTS tax_office_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS agt_cert_number VARCHAR(64),
    ADD COLUMN IF NOT EXISTS default_withholding_rate NUMERIC(5, 2) NOT NULL DEFAULT 6.50,
    ADD COLUMN IF NOT EXISTS invoice_footer_notes TEXT,
    ADD COLUMN IF NOT EXISTS bank_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS contingency_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS license_valid_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS subscribed_modules TEXT[];

INSERT INTO kudiba_core.tenants (
    id, slug, company_name, trade_name, nif, address_detail, city, province,
    country, phone, email, website, commercial_registry, share_capital,
    currency, tax_regime_code, tax_office_code, agt_cert_number,
    default_withholding_rate, invoice_footer_notes, bank_accounts,
    onboarding_completed, status, license_valid_until, subscribed_modules
)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'demo',
    'Kudiba Comercial & Serviços Lda',
    'Kudiba Comercial',
    '5001234567',
    'Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7.º Andar',
    'Luanda',
    'Luanda',
    'AO',
    '+244 923 000 000',
    'geral@kudiba.ao',
    'https://kudiba.ao',
    'CRC Luanda n.º 2026-00412',
    '2.000.000,00 Kz',
    'AOA',
    'REGIME_GERAL',
    '1.ª Repartição Fiscal de Luanda',
    '42/AGT/2026',
    6.50,
    'Os bens e serviços foram colocados à disposição do adquirente na data e local do documento.',
    '[{"bank_name": "Banco Angolano de Investimentos (BAI)", "iban": "AO06.0040.0000.1234.5678.9012.3", "account_number": "123456789.10.001", "swift": "BAIPAOPL", "currency": "AOA", "is_primary": true}]'::jsonb,
    TRUE,
    'ACTIVE',
    NOW() + INTERVAL '1 year',
    ARRAY['invoicing', 'inventory', 'treasury', 'payroll', 'accounting', 'integrations']
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
    tenant_id UUID NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE, -- NULL = perfil de sistema (global)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roles_tenant ON kudiba_core.roles(tenant_id);

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
    ('AUDITOR', 'Auditor Fiscal / Revisor', 'Acesso de leitura para auditoria e conferência de trilha fiscal', TRUE),
    ('GESTOR_RH', 'Gestor de Recursos Humanos', 'Gestão de colaboradores, contratos, folha salarial, férias e assiduidade', TRUE)
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
    ('tenant:settings:manage', 'core', 'Gerir Dados da Empresa', 'Actualização de dados fiscais e cadastrais da empresa'),

    -- Permissões de Recursos Humanos & Payroll (KudibaPayroll)
    ('payroll:manage', 'payroll', 'Gerir Colaboradores e Contratos', 'Registo, actualização e cessação de colaboradores, departamentos e contratos'),
    ('payroll:view', 'payroll', 'Consultar Folha Salarial', 'Consulta de recibos, períodos e resumos de processamento salarial'),
    ('payroll:calculate', 'payroll', 'Processar Salários', 'Cálculo da folha salarial do período (IRT e INSS)'),
    ('payroll:approve', 'payroll', 'Aprovar e Encerrar Períodos', 'Aprovação e encerramento oficial do período salarial'),
    ('payroll:export', 'payroll', 'Exportar Remessa Bancária', 'Geração do ficheiro PS2 de transferências em lote'),
    ('payroll:hr', 'payroll', 'Gerir Férias e Assiduidade', 'Pedidos de férias, aprovações e registos de assiduidade')
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

-- GESTOR_RH: Permissões de Recursos Humanos & Payroll
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('GESTOR_RH', 'payroll:manage'),
    ('GESTOR_RH', 'payroll:view'),
    ('GESTOR_RH', 'payroll:calculate'),
    ('GESTOR_RH', 'payroll:approve'),
    ('GESTOR_RH', 'payroll:export'),
    ('GESTOR_RH', 'payroll:hr'),
    ('GESTOR_RH', 'users:read')
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
