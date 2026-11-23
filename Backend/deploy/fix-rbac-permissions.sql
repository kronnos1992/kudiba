-- =============================================================================
-- KUDIBA ERP — REPOSIÇÃO E SEEDING COMPLETO DO CATÁLOGO RBAC
-- Executar no banco de dados 'kudiba_auth'
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS kudiba_core;

-- 1. Garante existência das tabelas
CREATE TABLE IF NOT EXISTS kudiba_core.roles (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    tenant_id UUID NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kudiba_core.permissions (
    id VARCHAR(64) PRIMARY KEY,
    module VARCHAR(32) NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kudiba_core.role_permissions (
    role_id VARCHAR(32) NOT NULL REFERENCES kudiba_core.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) NOT NULL REFERENCES kudiba_core.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS kudiba_core.role_permission_overrides (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NULL REFERENCES kudiba_core.tenants(id) ON DELETE CASCADE,
    role_id VARCHAR(32) NOT NULL REFERENCES kudiba_core.roles(id) ON DELETE CASCADE,
    permissions VARCHAR(64)[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Perfis de Sistema Globais
INSERT INTO kudiba_core.roles (id, name, description, is_system) VALUES
    ('ADMIN', 'Administrador Geral', 'Acesso total à administração da empresa, utilizadores e configurações fiscais', TRUE),
    ('SYSADMIN', 'Administrador do Sistema', 'Gestão integral do sistema ERP: empresas, licenças, configurações globais e suporte técnico', TRUE),
    ('CONTABILISTA', 'Contabilista Certificado', 'Acesso à faturação, fechos de contas, exportação SAF-T e mapas fiscais', TRUE),
    ('OPERADOR_CAIXA', 'Operador de Caixa (POS)', 'Emissão de faturas no ponto de venda, leitura X e operações diárias', TRUE),
    ('GESTOR_STOCK', 'Gestor de Stocks', 'Controle de inventário, transferências de armazém e guias de transporte', TRUE),
    ('AUDITOR', 'Auditor Fiscal / Revisor', 'Acesso de leitura para auditoria e conferência de trilha fiscal', TRUE),
    ('GESTOR_RH', 'Gestor de Recursos Humanos', 'Gestão de colaboradores, contratos, folha salarial, férias e assiduidade', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 3. Catálogo Canónico das 42 Permissões do Sistema
INSERT INTO kudiba_core.permissions (id, module, name, description) VALUES
    -- Facturação & Fiscal (Invoicing)
    ('invoices:issue', 'fiscal', 'Emitir Facturas', 'Permissão para emitir facturas, facturas-recibo e outros documentos fiscais'),
    ('invoices:read', 'fiscal', 'Consultar Facturas', 'Permissão para consultar documentos e imprimir vias'),
    ('invoices:cancel', 'fiscal', 'Anular Facturas', 'Permissão para emitir Notas de Crédito de rectificação/anulação'),
    ('fiscal:series:manage', 'fiscal', 'Gerir Séries Fiscais', 'Abertura e configuração de séries de facturação'),
    ('fiscal:saft:export', 'fiscal', 'Exportar SAF-T (AO)', 'Geração e exportação do ficheiro oficial SAF-T'),
    ('fiscal:reports:read', 'fiscal', 'Consultar Mapas Fiscais', 'Acesso aos relatórios de IVA, retenções e imposto de selo'),
    ('customers:read', 'fiscal', 'Consultar Clientes', 'Consulta da lista de clientes, fichas comerciais e histórico de compras'),
    ('customers:manage', 'fiscal', 'Gerir Clientes & NIF', 'Criação, actualização de dados cadastrais e validação do NIF de clientes'),
    ('invoices:proforma', 'fiscal', 'Orçamentos & Facturas Proforma', 'Emissão, actualização e conversão de orçamentos e facturas proforma'),
    ('invoices:transport', 'fiscal', 'Guias de Transporte & Remessa', 'Emissão de guias de transporte rodoviário e movimentação física de bens'),
    ('invoices:receipts', 'fiscal', 'Recibos Autónomos de Quitação (RG)', 'Emissão de recibos de liquidação total ou parcial de facturas a crédito'),
    ('invoices:debit_note', 'fiscal', 'Emitir Notas de Débito', 'Emissão de notas de débito para cobrança de acertos e despesas a clientes'),

    -- Ponto de Venda (POS)
    ('pos:sale', 'pos', 'Operar Ponto de Venda', 'Registo de vendas directas no caixa'),
    ('pos:reading_x', 'pos', 'Efectuar Leitura X', 'Conferência intradiária de valores em caixa'),
    ('pos:closing_z', 'pos', 'Efectuar Fecho Z', 'Fecho diário oficial e geração de memória fiscal'),
    ('pos:cash_movements', 'pos', 'Sangrias & Suprimentos de Caixa', 'Registo de reforços e retiradas de valores na gaveta do operador de caixa'),
    ('pos:discounts', 'pos', 'Aplicar Descontos Manuais', 'Aplicação de descontos comerciais em linha ou no total da venda no POS'),

    -- Utilizadores, RBAC & Empresa (Auth & Core)
    ('users:read', 'auth', 'Listar Utilizadores', 'Visualização de utilizadores da organização'),
    ('users:invite', 'auth', 'Convidar Utilizadores', 'Envio de convites e associação de utilizadores à empresa'),
    ('users:manage_roles', 'auth', 'Gerir Papéis de Utilizadores', 'Atribuição e revogação de funções de utilizadores'),
    ('audit:read', 'auth', 'Consultar Registos de Auditoria', 'Visualização da trilha de auditoria fiscal, eventos de autenticação e logs de segurança'),
    ('tenant:settings:manage', 'core', 'Gerir Dados da Empresa', 'Actualização de dados fiscais e cadastrais da empresa'),

    -- Inventário & Armazéns (Inventory)
    ('inventory:read', 'inventory', 'Consultar Inventário', 'Consulta de produtos, existências por armazém e histórico de movimentos'),
    ('inventory:manage', 'inventory', 'Gerir Produtos e Existências', 'Criação e actualização de produtos, unidades de medida e níveis mínimos de stock'),
    ('inventory:transfer', 'inventory', 'Transferir Stock entre Armazéns', 'Criação e processamento de transferências de mercadorias entre armazéns'),
    ('inventory:warehouses', 'inventory', 'Gerir Armazéns & Lojas', 'Parametrização de armazéns físicos, locais de guarda e centros de distribuição'),
    ('inventory:adjust', 'inventory', 'Ajustes & Contagem de Stock', 'Registo de quebras, sobras, perdas e acertos pontuais de existências'),
    ('inventory:suppliers', 'inventory', 'Fornecedores & Compras', 'Gestão do cadastro de fornecedores, encomendas de compra e preços acordados'),

    -- Tesouraria & Caixa (Treasury)
    ('treasury:read', 'treasury', 'Consultar Tesouraria & Caixas', 'Consulta de saldos de caixas, extractos de contas bancárias e posições financeiras'),
    ('treasury:manage', 'treasury', 'Gerir Caixas & Contas Bancárias', 'Configuração de caixas físicos, contas bancárias da empresa e métodos de pagamento'),
    ('treasury:movements', 'treasury', 'Movimentos de Caixa & Despesas', 'Lançamento de despesas correntes, entradas e saídas de caixa da tesouraria'),
    ('treasury:transfers', 'treasury', 'Transferências entre Contas', 'Realização de transferências entre caixas e contas bancárias da empresa'),
    ('treasury:reconcile', 'treasury', 'Reconciliação Bancária', 'Conferência de extractos bancários, cruzamento de saldos e reconciliação financeira'),

    -- Recursos Humanos & Salários (Payroll)
    ('payroll:manage', 'payroll', 'Gerir Colaboradores e Contratos', 'Registo, actualização e cessação de colaboradores, departamentos e contratos'),
    ('payroll:view', 'payroll', 'Consultar Folha Salarial', 'Consulta de recibos, períodos e resumos de processamento salarial'),
    ('payroll:calculate', 'payroll', 'Processar Salários', 'Cálculo da folha salarial do período (IRT e INSS)'),
    ('payroll:approve', 'payroll', 'Aprovar e Encerrar Períodos', 'Aprovação e encerramento oficial do período salarial'),
    ('payroll:export', 'payroll', 'Exportar Remessa Bancária', 'Geração do ficheiro PS2 de transferências em lote'),
    ('payroll:hr', 'payroll', 'Gerir Férias e Assiduidade', 'Pedidos de férias, aprovações e registos de assiduidade'),

    -- Contabilidade & PGC (Accounting)
    ('accounting:read', 'accounting', 'Consultar Contabilidade & Razão', 'Consulta do plano de contas, diários, extractos de conta e balancetes'),
    ('accounting:journal', 'accounting', 'Lançamentos Contabilísticos Manuais', 'Registo e estorno de lançamentos em partidas dobradas nos diários oficiais'),
    ('accounting:chart', 'accounting', 'Gerir Plano Geral de Contas (PGC)', 'Criação e manutenção de contas e subcontas das classes 1 a 8 do PGC Angolano'),
    ('accounting:vat_settlement', 'accounting', 'Apuramento Periódico de IVA', 'Cálculo, fecho e apuramento do IVA a pagar ou a recuperar perante a administração fiscal'),
    ('accounting:reports', 'accounting', 'Balanço & Demonstração de Resultados', 'Geração do Balanço analítico, Balancete de Verificação e Demonstração de Resultados'),

    -- Integrações Biométricas & Dispositivos (Integrations)
    ('integrations:read', 'integrations', 'Consultar Dispositivos & Presenças', 'Visualização de terminais biométricos conectados, webhooks e marcações de ponto'),
    ('integrations:manage', 'integrations', 'Gerir Terminais & Mapeamentos', 'Parametrização de terminais biométricos (Hikvision, ZKTeco, Anviz) e regras de sincronização')
ON CONFLICT (id) DO UPDATE SET
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- 4. Associação de Permissões ao ADMIN e SYSADMIN (Acesso Integral)
INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'SYSADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

-- 5. CONTABILISTA
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('CONTABILISTA', 'customers:read'),
    ('CONTABILISTA', 'customers:manage'),
    ('CONTABILISTA', 'invoices:proforma'),
    ('CONTABILISTA', 'invoices:receipts'),
    ('CONTABILISTA', 'invoices:debit_note'),
    ('CONTABILISTA', 'invoices:issue'),
    ('CONTABILISTA', 'invoices:read'),
    ('CONTABILISTA', 'invoices:cancel'),
    ('CONTABILISTA', 'fiscal:series:manage'),
    ('CONTABILISTA', 'fiscal:saft:export'),
    ('CONTABILISTA', 'fiscal:reports:read'),
    ('CONTABILISTA', 'treasury:read'),
    ('CONTABILISTA', 'treasury:movements'),
    ('CONTABILISTA', 'treasury:reconcile'),
    ('CONTABILISTA', 'accounting:read'),
    ('CONTABILISTA', 'accounting:journal'),
    ('CONTABILISTA', 'accounting:chart'),
    ('CONTABILISTA', 'accounting:vat_settlement'),
    ('CONTABILISTA', 'accounting:reports'),
    ('CONTABILISTA', 'audit:read')
ON CONFLICT DO NOTHING;

-- 6. OPERADOR_CAIXA
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('OPERADOR_CAIXA', 'pos:sale'),
    ('OPERADOR_CAIXA', 'pos:reading_x'),
    ('OPERADOR_CAIXA', 'pos:closing_z'),
    ('OPERADOR_CAIXA', 'pos:cash_movements'),
    ('OPERADOR_CAIXA', 'pos:discounts'),
    ('OPERADOR_CAIXA', 'invoices:read'),
    ('OPERADOR_CAIXA', 'invoices:receipts'),
    ('OPERADOR_CAIXA', 'treasury:read')
ON CONFLICT DO NOTHING;

-- 7. GESTOR_STOCK
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('GESTOR_STOCK', 'inventory:read'),
    ('GESTOR_STOCK', 'inventory:manage'),
    ('GESTOR_STOCK', 'inventory:transfer'),
    ('GESTOR_STOCK', 'inventory:warehouses'),
    ('GESTOR_STOCK', 'inventory:adjust'),
    ('GESTOR_STOCK', 'inventory:suppliers'),
    ('GESTOR_STOCK', 'invoices:transport'),
    ('GESTOR_STOCK', 'invoices:read')
ON CONFLICT DO NOTHING;

-- 8. AUDITOR
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('AUDITOR', 'invoices:read'),
    ('AUDITOR', 'fiscal:reports:read'),
    ('AUDITOR', 'fiscal:saft:export'),
    ('AUDITOR', 'treasury:read'),
    ('AUDITOR', 'accounting:read'),
    ('AUDITOR', 'audit:read'),
    ('AUDITOR', 'inventory:read'),
    ('AUDITOR', 'payroll:view')
ON CONFLICT DO NOTHING;

-- 9. GESTOR_RH
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('GESTOR_RH', 'payroll:manage'),
    ('GESTOR_RH', 'payroll:view'),
    ('GESTOR_RH', 'payroll:calculate'),
    ('GESTOR_RH', 'payroll:approve'),
    ('GESTOR_RH', 'payroll:export'),
    ('GESTOR_RH', 'payroll:hr'),
    ('GESTOR_RH', 'integrations:read'),
    ('GESTOR_RH', 'audit:read')
ON CONFLICT DO NOTHING;
