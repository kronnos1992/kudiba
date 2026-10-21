-- =============================================================================
-- 13. EXPANSÃO COMPLETA DA MATRIZ DE PERMISSÕES RBAC DO KUDIBA ERP
--
-- Regista o catálogo exaustivo de funcionalidades em todos os microsserviços:
--   * Fiscal, Facturação & Clientes (Invoicing)
--   * Ponto de Venda (POS)
--   * Inventário, Armazéns & Compras (Inventory)
--   * Tesouraria, Caixa & Bancos (Treasury)
--   * Contabilidade Geral & PGC Angolano (Accounting)
--   * Recursos Humanos & Salários (Payroll)
--   * Integrações & Biometria (Integrations)
--   * Auditoria & Segurança (Auth)
-- =============================================================================

INSERT INTO kudiba_core.permissions (id, module, name, description) VALUES
    -- 1. Facturação, Documentos Comerciais & Clientes
    ('customers:read', 'fiscal', 'Consultar Clientes',
     'Consulta da lista de clientes, fichas comerciais e histórico de compras'),
    ('customers:manage', 'fiscal', 'Gerir Clientes & NIF',
     'Criação, actualização de dados cadastrais e validação do NIF de clientes'),
    ('invoices:proforma', 'fiscal', 'Orçamentos & Facturas Proforma',
     'Emissão, actualização e conversão de orçamentos e facturas proforma'),
    ('invoices:transport', 'fiscal', 'Guias de Transporte & Remessa',
     'Emissão de guias de transporte rodoviário e movimentação física de bens'),
    ('invoices:receipts', 'fiscal', 'Recibos Autónomos de Quitação (RG)',
     'Emissão de recibos de liquidação total ou parcial de facturas a crédito'),
    ('invoices:debit_note', 'fiscal', 'Emitir Notas de Débito',
     'Emissão de notas de débito para cobrança de acertos e despesas a clientes'),

    -- 2. Ponto de Venda (POS)
    ('pos:cash_movements', 'pos', 'Sangrias & Suprimentos de Caixa',
     'Registo de reforços e retiradas de valores na gaveta do operador de caixa'),
    ('pos:discounts', 'pos', 'Aplicar Descontos Manuais',
     'Aplicação de descontos comerciais em linha ou no total da venda no POS'),

    -- 3. Inventário, Armazéns & Compras
    ('inventory:warehouses', 'inventory', 'Gerir Armazéns & Lojas',
     'Parametrização de armazéns físicos, locais de guarda e centros de distribuição'),
    ('inventory:adjust', 'inventory', 'Ajustes & Contagem de Stock',
     'Registo de quebras, sobras, perdas e acertos pontuais de existências'),
    ('inventory:suppliers', 'inventory', 'Fornecedores & Compras',
     'Gestão do cadastro de fornecedores, encomendas de compra e preços acordados'),

    -- 4. Tesouraria & Bancos
    ('treasury:read', 'treasury', 'Consultar Tesouraria & Caixas',
     'Consulta de saldos de caixas, extractos de contas bancárias e posições financeiras'),
    ('treasury:manage', 'treasury', 'Gerir Caixas & Contas Bancárias',
     'Configuração de caixas físicos, contas bancárias da empresa e métodos de pagamento'),
    ('treasury:movements', 'treasury', 'Movimentos de Caixa & Despesas',
     'Lançamento de despesas correntes, entradas e saídas de caixa da tesouraria'),
    ('treasury:transfers', 'treasury', 'Transferências entre Contas',
     'Realização de transferências entre caixas e contas bancárias da empresa'),
    ('treasury:reconcile', 'treasury', 'Reconciliação Bancária',
     'Conferência de extractos bancários, cruzamento de saldos e reconciliação financeira'),

    -- 5. Contabilidade Geral & PGC Angolano
    ('accounting:read', 'accounting', 'Consultar Contabilidade & Razão',
     'Consulta do plano de contas, diários, extractos de conta e balancetes'),
    ('accounting:journal', 'accounting', 'Lançamentos Contabilísticos Manuais',
     'Registo e estorno de lançamentos em partidas dobradas nos diários oficiais'),
    ('accounting:chart', 'accounting', 'Gerir Plano Geral de Contas (PGC)',
     'Criação e manutenção de contas e subcontas das classes 1 a 8 do PGC Angolano'),
    ('accounting:vat_settlement', 'accounting', 'Apuramento Periódico de IVA',
     'Cálculo, fecho e apuramento do IVA a pagar ou a recuperar perante a administração fiscal'),
    ('accounting:reports', 'accounting', 'Balanço & Demonstração de Resultados',
     'Geração do Balanço analítico, Balancete de Verificação e Demonstração de Resultados'),

    -- 6. Integrações Biométricas & Dispositivos
    ('integrations:read', 'integrations', 'Consultar Dispositivos & Presenças',
     'Visualização de terminais biométricos conectados, webhooks e marcações de ponto'),
    ('integrations:manage', 'integrations', 'Gerir Terminais & Mapeamentos',
     'Parametrização de terminais biométricos (Hikvision, ZKTeco, Anviz) e regras de sincronização'),

    -- 7. Auditoria & Segurança
    ('audit:read', 'auth', 'Consultar Registos de Auditoria',
     'Visualização da trilha de auditoria fiscal, eventos de autenticação e logs de segurança')
ON CONFLICT (id) DO UPDATE SET
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- -----------------------------------------------------------------------------
-- Atribuição aos Administradores (ADMIN e SYSADMIN): catálogo integral
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'ADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

INSERT INTO kudiba_core.role_permissions (role_id, permission_id)
SELECT 'SYSADMIN', id FROM kudiba_core.permissions
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- CONTABILISTA: Fiscal, Contabilidade, Tesouraria, SAF-T, Mapas e Auditoria
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('CONTABILISTA', 'customers:read'),
    ('CONTABILISTA', 'customers:manage'),
    ('CONTABILISTA', 'invoices:proforma'),
    ('CONTABILISTA', 'invoices:receipts'),
    ('CONTABILISTA', 'invoices:debit_note'),
    ('CONTABILISTA', 'treasury:read'),
    ('CONTABILISTA', 'treasury:movements'),
    ('CONTABILISTA', 'treasury:transfers'),
    ('CONTABILISTA', 'treasury:reconcile'),
    ('CONTABILISTA', 'accounting:read'),
    ('CONTABILISTA', 'accounting:journal'),
    ('CONTABILISTA', 'accounting:chart'),
    ('CONTABILISTA', 'accounting:vat_settlement'),
    ('CONTABILISTA', 'accounting:reports'),
    ('CONTABILISTA', 'inventory:read'),
    ('CONTABILISTA', 'audit:read')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- GESTOR_STOCK: Inventário Integral, Armazéns, Fornecedores e Guias
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('GESTOR_STOCK', 'inventory:warehouses'),
    ('GESTOR_STOCK', 'inventory:adjust'),
    ('GESTOR_STOCK', 'inventory:suppliers'),
    ('GESTOR_STOCK', 'invoices:transport'),
    ('GESTOR_STOCK', 'customers:read')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- OPERADOR_CAIXA: Vendas, Recibos, Clientes e Consulta de Artigos
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('OPERADOR_CAIXA', 'invoices:read'),
    ('OPERADOR_CAIXA', 'invoices:issue'),
    ('OPERADOR_CAIXA', 'invoices:receipts'),
    ('OPERADOR_CAIXA', 'pos:cash_movements'),
    ('OPERADOR_CAIXA', 'pos:discounts'),
    ('OPERADOR_CAIXA', 'customers:read'),
    ('OPERADOR_CAIXA', 'customers:manage'),
    ('OPERADOR_CAIXA', 'inventory:read')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- GESTOR_RH: Payroll completo + Integrações Biométricas de Assiduidade
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('GESTOR_RH', 'integrations:read'),
    ('GESTOR_RH', 'integrations:manage'),
    ('GESTOR_RH', 'audit:read')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- AUDITOR: Consultas de Contabilidade, Tesouraria, Fiscal, Stock e Logs
-- -----------------------------------------------------------------------------
INSERT INTO kudiba_core.role_permissions (role_id, permission_id) VALUES
    ('AUDITOR', 'customers:read'),
    ('AUDITOR', 'invoices:proforma'),
    ('AUDITOR', 'invoices:receipts'),
    ('AUDITOR', 'treasury:read'),
    ('AUDITOR', 'treasury:reconcile'),
    ('AUDITOR', 'accounting:read'),
    ('AUDITOR', 'accounting:reports'),
    ('AUDITOR', 'inventory:read'),
    ('AUDITOR', 'integrations:read'),
    ('AUDITOR', 'audit:read')
ON CONFLICT DO NOTHING;
