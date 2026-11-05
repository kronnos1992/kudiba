-- =============================================================================
-- Kudiba ERP — Templates de Plano de Contas (F0)
-- Base de dados: kudiba_accounting
-- =============================================================================

CREATE TABLE IF NOT EXISTS kudiba_accounting.chart_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    sector_code VARCHAR(32) NOT NULL,
    regulator VARCHAR(64),
    legal_reference VARCHAR(255),
    version VARCHAR(32) NOT NULL DEFAULT '1.0',
    effective_from DATE,
    effective_to DATE,
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','RETIRED')),
    description TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kudiba_accounting.chart_template_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES kudiba_accounting.chart_templates(id) ON DELETE CASCADE,
    account_code VARCHAR(30) NOT NULL,
    parent_account_code VARCHAR(30),
    account_name VARCHAR(255) NOT NULL,
    account_class VARCHAR(64) NOT NULL,
    class_code VARCHAR(8) NOT NULL,
    account_nature VARCHAR(8) NOT NULL CHECK (account_nature IN ('DEBIT','CREDIT')),
    is_analytical BOOLEAN NOT NULL DEFAULT TRUE,
    is_system_reserved BOOLEAN NOT NULL DEFAULT TRUE,
    saft_grouping_code VARCHAR(30),
    base_account_code VARCHAR(30),
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT uq_chart_template_account UNIQUE (template_id, account_code)
);

CREATE INDEX IF NOT EXISTS idx_chart_template_accounts_template
    ON kudiba_accounting.chart_template_accounts(template_id);
CREATE INDEX IF NOT EXISTS idx_chart_template_accounts_parent
    ON kudiba_accounting.chart_template_accounts(template_id, parent_account_code);

CREATE TABLE IF NOT EXISTS kudiba_accounting.tenant_chart_settings (
    tenant_id UUID PRIMARY KEY,
    template_code VARCHAR(64) NOT NULL,
    template_version VARCHAR(32) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(255),
    mode VARCHAR(16) NOT NULL DEFAULT 'SEED',
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE kudiba_accounting.chart_of_accounts
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS class_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS base_account_code VARCHAR(30),
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO kudiba_accounting.chart_templates
    (code, name, sector_code, regulator, legal_reference, version, effective_from, status, description, metadata)
VALUES
    ('PGC_GENERIC', 'Plano Geral de Contabilidade de Angola (PGC Geral)', 'GERAL', 'MINFIN/AGT', 'Decreto n.º 82/01, de 16 de Novembro', '1.0', DATE '2001-11-16', 'PUBLISHED', 'Plano Geral de Contabilidade aplicável ao comércio, distribuição, indústria geral e serviços.', '{"portal_url": "https://portaldocontribuinte.minfin.gov.ao", "sector_name": "Geral (Comércio, Indústria e Serviços)"}'::jsonb),
    ('PCESR_01_26', 'Plano de Contas das Empresas de Seguros e Resseguros (PCESR)', 'SEGUROS', 'ARSEG', 'Norma Regulamentar n.º 01/26 e NR n.º 05/23 da ARSEG', '1.0', DATE '2026-01-01', 'PUBLISHED', 'PCESR regulado pela Agência Angolana de Regulação e Supervisão de Seguros (ARSEG) com provisões técnicas e prémios de seguro.', '{"portal_url": "https://www.arseg.ao", "sector_name": "Segurador e Fundos de Pensões"}'::jsonb),
    ('PCIFB_14_2019', 'Plano de Contas das Instituições Financeiras Bancárias (CONTIF / PCIFB)', 'BANCA', 'BNA', 'Aviso n.º 05/2019 e Instrutivo n.º 14/2019 do BNA', '1.0', DATE '2019-01-01', 'PUBLISHED', 'PCIFB regulado pelo Banco Nacional de Angola (BNA) com contabilidade alinhada a normas IFRS/IAS para bancos e instituições de crédito.', '{"portal_url": "https://www.bna.ao", "sector_name": "Bancário e Financeiro"}'::jsonb),
    ('PGC_PETROLEO', 'Plano Geral de Contabilidade Petrolífera (PGCP)', 'PETROLEO', 'MIREMPET/ANPG', 'Lei n.º 13/04 de 24 de Dezembro e Contratos de Partilha de Produção (PSA)', '1.0', DATE '2004-12-24', 'PUBLISHED', 'Contabilidade para concessionárias, operadoras e prestadoras de serviços petrolíferos com segregação por blocos (Ring Fencing) e Cost Oil.', '{"portal_url": "https://www.mirempet.gov.ao", "sector_name": "Petrolífero, Gás e Recursos Minerais"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sector_code = EXCLUDED.sector_code,
    regulator = EXCLUDED.regulator,
    legal_reference = EXCLUDED.legal_reference,
    version = EXCLUDED.version,
    effective_from = EXCLUDED.effective_from,
    status = EXCLUDED.status,
    description = EXCLUDED.description,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- Contas do template genérico (PGC). Fonte: SeedStandardPgcHandler.
INSERT INTO kudiba_accounting.chart_template_accounts
    (template_id, account_code, parent_account_code, account_name, account_class, class_code,
     account_nature, is_analytical, is_system_reserved, saft_grouping_code, sort_order)
SELECT t.id, v.account_code, v.parent_account_code, v.account_name, v.account_class, v.class_code,
       v.account_nature, v.is_analytical, TRUE, v.account_code, v.sort_order
FROM kudiba_accounting.chart_templates t
CROSS JOIN (VALUES
    ('01', NULL, 'Garantias e Cauções Prestadas', 'CLASS_0_CONTAS_DE_ORDEM', '0', 'DEBIT', TRUE, 0),
    ('02', NULL, 'Garantias e Cauções Recebidas', 'CLASS_0_CONTAS_DE_ORDEM', '0', 'CREDIT', TRUE, 1),
    ('03', NULL, 'Títulos e Valores sob Custódia', 'CLASS_0_CONTAS_DE_ORDEM', '0', 'DEBIT', TRUE, 2),
    ('04', NULL, 'Compromissos e Responsabilidades Assumidas', 'CLASS_0_CONTAS_DE_ORDEM', '0', 'CREDIT', TRUE, 3),
    ('11', NULL, 'Imobilizações Corpóreas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', FALSE, 4),
    ('11.1', '11', 'Terrenos e Recursos Naturais', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 5),
    ('11.2', '11', 'Edifícios e Outras Construções', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 6),
    ('11.3', '11', 'Equipamento Básico', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 7),
    ('11.4', '11', 'Equipamento de Carga e Transporte', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 8),
    ('11.5', '11', 'Equipamento Administrativo e Informático', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 9),
    ('11.9', '11', 'Outras Imobilizações Corpóreas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 10),
    ('12', NULL, 'Imobilizações Incorpóreas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', FALSE, 11),
    ('12.1', '12', 'Trespasses', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 12),
    ('12.2', '12', 'Despesas de Investigação e Desenvolvimento', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 13),
    ('12.3', '12', 'Propriedade Industrial, Softwares e Licenças', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 14),
    ('13', NULL, 'Investimentos Financeiros', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', FALSE, 15),
    ('13.1', '13', 'Empresas Subsidiárias', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 16),
    ('13.2', '13', 'Empresas Associadas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 17),
    ('13.3', '13', 'Outras Empresas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 18),
    ('14', NULL, 'Imobilizações em Curso', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 19),
    ('18', NULL, 'Amortizações Acumuladas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'CREDIT', FALSE, 20),
    ('18.1', '18', 'Amortizações Acumuladas - Imobilizações Corpóreas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'CREDIT', TRUE, 21),
    ('18.2', '18', 'Amortizações Acumuladas - Imobilizações Incorpóreas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'CREDIT', TRUE, 22),
    ('19', NULL, 'Provisões para Investimentos Financeiros', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'CREDIT', TRUE, 23),
    ('21', NULL, 'Compras', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', FALSE, 24),
    ('21.1', '21', 'Matérias-Primas, Subsidiárias e de Consumo', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 25),
    ('21.2', '21', 'Compras de Mercadorias', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 26),
    ('22', NULL, 'Matérias-Primas, Subsidiárias e de Consumo', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 27),
    ('23', NULL, 'Produtos e Trabalhos em Curso', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 28),
    ('24', NULL, 'Produtos Acabados e Intermédios', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 29),
    ('25', NULL, 'Sub-produtos, Desperdícios, Resíduos e Refugos', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 30),
    ('26', NULL, 'Mercadorias', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', FALSE, 31),
    ('26.1', '26', 'Mercadorias em Armazém', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 32),
    ('27', NULL, 'Matérias-Primas, Mercadorias e Outros Materiais em Trânsito', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 33),
    ('28', NULL, 'Adiantamentos por Conta de Compras', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 34),
    ('29', NULL, 'Provisão para Depreciação de Existências', 'CLASS_2_EXISTENCIAS', '2', 'CREDIT', TRUE, 35),
    ('31', NULL, 'Clientes', 'CLASS_3_TERCEIROS', '3', 'DEBIT', FALSE, 36),
    ('31.1', '31', 'Clientes - Correntes', 'CLASS_3_TERCEIROS', '3', 'DEBIT', FALSE, 37),
    ('31.1.1', '31.1', 'Clientes Nacionais (Geral)', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 38),
    ('31.1.2.1', '31.1', 'Clientes Não Grupo Nacionais', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 39),
    ('31.1.2.2', '31.1', 'Clientes Não Grupo Estrangeiros', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 40),
    ('31.2', '31', 'Clientes - Títulos a Receber', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 41),
    ('31.8', '31', 'Clientes de Cobrança Duvidosa', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 42),
    ('32', NULL, 'Fornecedores', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 43),
    ('32.1', '32', 'Fornecedores - Correntes', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 44),
    ('32.1.1', '32.1', 'Fornecedores Nacionais (Geral)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 45),
    ('32.1.2.1', '32.1', 'Fornecedores Não Grupo Nacionais', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 46),
    ('32.1.2.2', '32.1', 'Fornecedores Não Grupo Estrangeiros', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 47),
    ('32.2', '32', 'Fornecedores - Títulos a Pagar', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 48),
    ('33', NULL, 'Empréstimos Obtidos', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 49),
    ('33.1', '33', 'Empréstimos Bancários', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 50),
    ('34', NULL, 'Estado e Outros Entes Públicos', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 51),
    ('34.1', '34', 'Imposto sobre os Lucros / Imposto Industrial', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 52),
    ('34.2', '34', 'Retenções na Fonte de Impostos', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 53),
    ('34.2.1', '34.2', 'Retenção na Fonte 6,5% Suportada (Ativo)', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 54),
    ('34.2.2', '34.2', 'Retenção na Fonte Efetuada a Terceiros 6,5% (Passivo)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 55),
    ('34.3', '34', 'Imposto de Rendimento do Trabalho (IRT) e Segurança Social', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 56),
    ('34.3.1', '34.3', 'IRT Retido ao Pessoal', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 57),
    ('34.3.2', '34.3', 'Segurança Social / INSS a Entregar (11%)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 58),
    ('34.5', '34', 'Imposto sobre o Valor Acrescentado (IVA)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 59),
    ('34.5.1', '34.5', 'IVA Suportado', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 60),
    ('34.5.2', '34.5', 'IVA Dedutível', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 61),
    ('34.5.3', '34.5', 'IVA Liquidado', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 62),
    ('34.5.3.1', '34.5.3', 'IVA Liquidado - Taxa Geral 14%', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 63),
    ('34.5.3.2', '34.5.3', 'IVA Liquidado - Taxa Reduzida 5%', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 64),
    ('34.5.5', '34.5', 'IVA a Regularizar', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 65),
    ('34.5.6', '34.5', 'IVA - Apuramento', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 66),
    ('34.5.7', '34.5', 'IVA a Pagar', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 67),
    ('34.6', '34', 'Imposto de Selo', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 68),
    ('36', NULL, 'Pessoal', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 69),
    ('36.1', '36', 'Pessoal - Remunerações a Pagar', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 70),
    ('36.1.1', '36.1', 'Vencimentos a Pagar ao Pessoal', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 71),
    ('36.2', '36', 'Pessoal - Participação nos Resultados', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 72),
    ('36.3', '36', 'Pessoal - Adiantamentos', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 73),
    ('37', NULL, 'Outros Valores a Receber e a Pagar', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 74),
    ('38', NULL, 'Provisões para Cobranças Duvidosas', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 75),
    ('39', NULL, 'Provisões para Outros Riscos e Encargos', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 76),
    ('41', NULL, 'Títulos Negociáveis', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 77),
    ('42', NULL, 'Depósitos a Prazo', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', FALSE, 78),
    ('42.1', '42', 'Depósitos a Prazo - Moeda Nacional', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 79),
    ('42.2', '42', 'Depósitos a Prazo - Moeda Estrangeira', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 80),
    ('43', NULL, 'Depósitos à Ordem', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', FALSE, 81),
    ('43.1', '43', 'Bancos D.O. - Moeda Nacional', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 82),
    ('43.2', '43', 'Bancos D.O. - Moeda Estrangeira', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 83),
    ('44', NULL, 'Outros Depósitos', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 84),
    ('45', NULL, 'Caixa', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', FALSE, 85),
    ('45.1', '45', 'Caixa Geral / Fundo Fixo', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 86),
    ('45.2', '45', 'Caixas de Balcão / Valores para Depositar', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 87),
    ('48', NULL, 'Conta Transitória', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 88),
    ('49', NULL, 'Provisões para Aplicações de Tesouraria', 'CLASS_4_MEIOS_MONETARIOS', '4', 'CREDIT', TRUE, 89),
    ('51', NULL, 'Capital', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', FALSE, 90),
    ('51.1', '51', 'Capital Social Subscrito e Realizado', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 91),
    ('52', NULL, 'Acções/Quotas Próprias', 'CLASS_5_CAPITAL_RESERVAS', '5', 'DEBIT', TRUE, 92),
    ('54', NULL, 'Prestações Suplementares', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 93),
    ('55', NULL, 'Reservas Legais', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 94),
    ('56', NULL, 'Reservas de Reavaliação', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 95),
    ('57', NULL, 'Reservas com Fins Especiais', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 96),
    ('58', NULL, 'Reservas Livres', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 97),
    ('59', NULL, 'Resultados Transitados', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 98),
    ('61', NULL, 'Vendas', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', FALSE, 99),
    ('61.1', '61', 'Vendas de Produtos Acabados e Intermédios', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 100),
    ('61.3', '61', 'Vendas de Mercadorias', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', FALSE, 101),
    ('61.3.1', '61.3', 'Vendas de Mercadorias - Mercado Nacional', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 102),
    ('61.3.2', '61.3', 'Vendas de Mercadorias - Mercado Estrangeiro', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 103),
    ('62', NULL, 'Prestações de Serviço', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', FALSE, 104),
    ('62.1', '62', 'Serviços Prestados no Mercado Nacional', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 105),
    ('62.2', '62', 'Serviços Prestados no Mercado Estrangeiro', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 106),
    ('63', NULL, 'Outros Proveitos Operacionais', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', FALSE, 107),
    ('63.1', '63', 'Serviços Suplementares', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 108),
    ('63.3', '63', 'Subsídios à Exploração', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 109),
    ('63.8', '63', 'Outros Proveitos e Ganhos Operacionais', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 110),
    ('64', NULL, 'Variação nos Inventários de Produção', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 111),
    ('65', NULL, 'Trabalhos para a Própria Empresa', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 112),
    ('66', NULL, 'Proveitos e Ganhos Financeiros Gerais', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', FALSE, 113),
    ('66.1', '66', 'Juros Obtidos', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 114),
    ('66.2', '66', 'Diferenças de Câmbio Favoráveis', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 115),
    ('66.3', '66', 'Descontos de Pronto Pagamento Obtidos', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 116),
    ('68', NULL, 'Outros Proveitos Não Operacionais', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 117),
    ('69', NULL, 'Proveitos e Ganhos Extraordinários', 'CLASS_6_PROVEITOS_POR_NATUREZA', '6', 'CREDIT', TRUE, 118),
    ('71', NULL, 'Custo das Mercadorias Vendidas e Matérias Consumidas (CMVMC)', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 119),
    ('71.1', '71', 'CMVMC - Matérias-Primas e Subsidiárias', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 120),
    ('71.2', '71', 'CMVMC - Mercadorias', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 121),
    ('72', NULL, 'Custos com o Pessoal', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 122),
    ('72.1', '72', 'Remunerações dos Órgãos Sociais', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 123),
    ('72.2', '72', 'Remunerações do Pessoal', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 124),
    ('72.5', '72', 'Encargos sobre Remunerações (INSS Patronal 8%)', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 125),
    ('72.8', '72', 'Outras Despesas com o Pessoal', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 126),
    ('73', NULL, 'Amortizações do Exercício', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 127),
    ('73.1', '73', 'Amortizações - Imobilizações Corpóreas', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 128),
    ('73.2', '73', 'Amortizações - Imobilizações Incorpóreas', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 129),
    ('75', NULL, 'Outros Custos e Perdas Operacionais (FSE e Tributos)', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 130),
    ('75.1', '75', 'Subcontratos', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 131),
    ('75.2', '75', 'Fornecimentos e Serviços de Terceiros (FSE)', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 132),
    ('75.2.11', '75.2', 'Água e Electricidade', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 133),
    ('75.2.20', '75.2', 'Comunicações e Internet', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 134),
    ('75.2.21', '75.2', 'Rendas e Alugueres', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 135),
    ('75.2.26', '75.2', 'Conservação e Reparação', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 136),
    ('75.3', '75', 'Impostos e Tributos', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 137),
    ('75.3.1.1', '75.3', 'Imposto de Selo Suportado', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 138),
    ('76', NULL, 'Custos e Perdas Financeiros Gerais', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', FALSE, 139),
    ('76.1', '76', 'Juros Suportados', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 140),
    ('76.2', '76', 'Diferenças de Câmbio Desfavoráveis', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 141),
    ('76.3', '76', 'Descontos de Pronto Pagamento Concedidos', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 142),
    ('76.4', '76', 'Comissões e Despesas Bancárias', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 143),
    ('78', NULL, 'Outros Custos e Perdas Não Operacionais', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 144),
    ('79', NULL, 'Custos e Perdas Extraordinárias', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 145),
    ('82', NULL, 'Resultados Operacionais', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 146),
    ('83', NULL, 'Resultados Financeiros Gerais', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 147),
    ('85', NULL, 'Resultados Não Operacionais', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 148),
    ('86', NULL, 'Resultados Extraordinários', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 149),
    ('87', NULL, 'Impostos sobre os Lucros', 'CLASS_8_RESULTADOS', '8', 'DEBIT', FALSE, 150),
    ('87.1', '87', 'Imposto Industrial sobre Resultados Correntes', 'CLASS_8_RESULTADOS', '8', 'DEBIT', TRUE, 151),
    ('88', NULL, 'Resultado Líquido do Exercício', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 152)
) AS v(account_code, parent_account_code, account_name, account_class, class_code, account_nature, is_analytical, sort_order)
WHERE t.code = 'PGC_GENERIC'
ON CONFLICT (template_id, account_code) DO UPDATE SET
    parent_account_code = EXCLUDED.parent_account_code,
    account_name = EXCLUDED.account_name,
    account_class = EXCLUDED.account_class,
    class_code = EXCLUDED.class_code,
    account_nature = EXCLUDED.account_nature,
    is_analytical = EXCLUDED.is_analytical,
    is_system_reserved = EXCLUDED.is_system_reserved,
    saft_grouping_code = EXCLUDED.saft_grouping_code,
    sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- Contas do Plano de Contas das Empresas de Seguros e Resseguros (PCESR - ARSEG)
-- =============================================================================
INSERT INTO kudiba_accounting.chart_template_accounts
    (template_id, account_code, parent_account_code, account_name, account_class, class_code,
     account_nature, is_analytical, is_system_reserved, saft_grouping_code, sort_order)
SELECT t.id, v.account_code, v.parent_account_code, v.account_name, v.account_class, v.class_code,
       v.account_nature, v.is_analytical, TRUE, v.account_code, v.sort_order
FROM kudiba_accounting.chart_templates t
CROSS JOIN (VALUES
    ('11', NULL, 'Imobilizações Corpóreas e Activos de Uso', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', FALSE, 0),
    ('11.1', '11', 'Edifícios e Instalações Administrativas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 1),
    ('11.5', '11', 'Equipamento Informático e Tecnologias Actuariais', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 2),
    ('13', NULL, 'Investimentos Financeiros da Carteira de Seguros', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', FALSE, 3),
    ('13.1', '13', 'Títulos da Dívida Pública Angolana (Obrigações e Bilhetes do Tesouro)', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 4),
    ('13.2', '13', 'Depósitos a Prazo Afetos a Garantias Técnicas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 5),
    ('21', NULL, 'Créditos sobre Operações de Seguro Directo', 'CLASS_3_TERCEIROS', '2', 'DEBIT', FALSE, 6),
    ('21.1', '21', 'Tomadores de Seguros - Recibos de Prémios a Cobrar', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 7),
    ('21.2', '21', 'Mediadores e Corretores de Seguros', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 8),
    ('22', NULL, 'Operações de Resseguro e Co-seguro', 'CLASS_3_TERCEIROS', '2', 'DEBIT', FALSE, 9),
    ('22.1', '22', 'Resseguradores - Contas Correntes', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 10),
    ('22.2', '22', 'Participação dos Resseguradores nas Provisões Técnicas', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 11),
    ('31', NULL, 'Provisões Técnicas de Ramos Reais / Não Vida', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 12),
    ('31.1', '31', 'Provisão para Prémios Não Adquiridos (PPNA)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 13),
    ('31.2', '31', 'Provisão para Sinistros Pendentes de Liquidação', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 14),
    ('31.3', '31', 'Provisão para Desvios de Sinistralidade e Riscos Crescentes', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 15),
    ('32', NULL, 'Provisões Técnicas do Ramo Vida', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 16),
    ('32.1', '32', 'Provisão Matemática do Ramo Vida', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 17),
    ('34', NULL, 'Estado e Entes Públicos (Fiscalidade Seguradora)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 18),
    ('34.1', '34', 'Imposto Industrial sobre Resultados de Seguros', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 19),
    ('34.6', '34', 'Imposto de Selo sobre Apólices e Prémios de Seguro', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 20),
    ('43', NULL, 'Depósitos Bancários à Ordem', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 21),
    ('45', NULL, 'Caixa e Valores em Trânsito', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 22),
    ('51', NULL, 'Capital Social e Fundo de Estabelecimento Regulamentar', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 23),
    ('55', NULL, 'Reserva da Margem de Solvência Regulamentar (ARSEG)', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 24),
    ('61', NULL, 'Custos com Sinistros de Seguros Directo', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', FALSE, 25),
    ('61.1', '61', 'Indemnizações Pagas por Sinistros (Automóvel, Saúde, Acidentes)', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 26),
    ('61.2', '61', 'Variação da Provisão para Sinistros do Exercício', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 27),
    ('62', NULL, 'Custos de Aquisição e Comissões de Mediação', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 28),
    ('63', NULL, 'Gastos Administrativos e de Gestão de Apólices', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 29),
    ('71', NULL, 'Prémios Emitidos Brutos (Produção do Exercício)', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', FALSE, 30),
    ('71.1', '71', 'Prémios Emitidos - Seguros Ramos Reais (Não Vida)', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 31),
    ('71.2', '71', 'Prémios Emitidos - Seguros Ramo Vida', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 32),
    ('72', NULL, 'Prémios Cedidos a Resseguradores Internacionais', 'CLASS_7_CUSTOS_POR_NATUREZA', '7', 'DEBIT', TRUE, 33),
    ('81', NULL, 'Resultado Técnico da Actividade Seguradora', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 34),
    ('88', NULL, 'Resultado Líquido do Exercício', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 35)
) AS v(account_code, parent_account_code, account_name, account_class, class_code, account_nature, is_analytical, sort_order)
WHERE t.code = 'PCESR_01_26'
ON CONFLICT (template_id, account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    account_class = EXCLUDED.account_class,
    account_nature = EXCLUDED.account_nature,
    sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- Contas do Plano de Contas das Instituições Financeiras Bancárias (PCIFB / CONTIF - BNA)
-- =============================================================================
INSERT INTO kudiba_accounting.chart_template_accounts
    (template_id, account_code, parent_account_code, account_name, account_class, class_code,
     account_nature, is_analytical, is_system_reserved, saft_grouping_code, sort_order)
SELECT t.id, v.account_code, v.parent_account_code, v.account_name, v.account_class, v.class_code,
       v.account_nature, v.is_analytical, TRUE, v.account_code, v.sort_order
FROM kudiba_accounting.chart_templates t
CROSS JOIN (VALUES
    ('11', NULL, 'Caixa e Disponibilidades no Banco Central (BNA)', 'CLASS_4_MEIOS_MONETARIOS', '1', 'DEBIT', FALSE, 0),
    ('11.1', '11', 'Caixa em Notas e Moedas (Balcões e Tesouraria Central)', 'CLASS_4_MEIOS_MONETARIOS', '1', 'DEBIT', TRUE, 1),
    ('11.2', '11', 'Reservas Obrigatórias Depositadas no BNA', 'CLASS_4_MEIOS_MONETARIOS', '1', 'DEBIT', TRUE, 2),
    ('12', NULL, 'Disponibilidades em Outras Instituições de Crédito (Correspondentes)', 'CLASS_4_MEIOS_MONETARIOS', '1', 'DEBIT', TRUE, 3),
    ('21', NULL, 'Aplicações no Mercado Interbancário (MMI / LUIBOR)', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '2', 'DEBIT', TRUE, 4),
    ('22', NULL, 'Títulos e Activos Financeiros ao Custo Amortizado (Obrigações do Tesouro)', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '2', 'DEBIT', TRUE, 5),
    ('23', NULL, 'Crédito Concedido a Clientes', 'CLASS_3_TERCEIROS', '2', 'DEBIT', FALSE, 6),
    ('23.1', '23', 'Crédito a Empresas e Particulares a Curto Prazo', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 7),
    ('23.2', '23', 'Crédito Imobiliário e Habitação a Longo Prazo', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 8),
    ('23.8', '23', 'Crédito Vencido e em Incumprimento (Non-Performing Loans)', 'CLASS_3_TERCEIROS', '2', 'DEBIT', TRUE, 9),
    ('29', NULL, 'Perdas por Imparidade Acumuladas em Crédito (IFRS 9 / BNA)', 'CLASS_3_TERCEIROS', '2', 'CREDIT', TRUE, 10),
    ('31', NULL, 'Recursos de Outras Instituições de Crédito (Captação Interbancária)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 11),
    ('32', NULL, 'Recursos de Clientes (Depósitos)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 12),
    ('32.1', '32', 'Depósitos à Ordem em Moeda Nacional (AOA)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 13),
    ('32.2', '32', 'Depósitos a Prazo em Moeda Nacional (AOA)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 14),
    ('32.3', '32', 'Depósitos em Moeda Estrangeira (USD / EUR)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 15),
    ('41', NULL, 'Imobilizações Corpóreas, Edifícios de Agências e Sistemas TI', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '4', 'DEBIT', TRUE, 16),
    ('51', NULL, 'Capital Social e Fundos Próprios Regulamentares BNA', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 17),
    ('55', NULL, 'Reserva Legal e Reservas Prudenciais do BNA', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 18),
    ('61', NULL, 'Juros e Custos Equiparados Suportados sobre Depósitos', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 19),
    ('62', NULL, 'Comissões Pagas por Serviços de Pagamento e Rede EMIS / Multicaixa', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 20),
    ('63', NULL, 'Gastos com Pessoal Bancário e Estrutura Operacional', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 21),
    ('68', NULL, 'Perdas por Imparidade do Exercício para Risco de Crédito', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 22),
    ('71', NULL, 'Juros e Rendimentos de Crédito e Títulos Públicos Angolanos', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 23),
    ('72', NULL, 'Rendimentos de Comissões por Serviços e Transações Bancárias', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 24),
    ('81', NULL, 'Margem Financeira e Produto Bancário', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 25),
    ('88', NULL, 'Resultado Líquido do Exercício Bancário', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 26)
) AS v(account_code, parent_account_code, account_name, account_class, class_code, account_nature, is_analytical, sort_order)
WHERE t.code = 'PCIFB_14_2019'
ON CONFLICT (template_id, account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    account_class = EXCLUDED.account_class,
    account_nature = EXCLUDED.account_nature,
    sort_order = EXCLUDED.sort_order;

-- =============================================================================
-- Contas do Plano Geral de Contabilidade Petrolífera (PGCP - MIREMPET & ANPG)
-- =============================================================================
INSERT INTO kudiba_accounting.chart_template_accounts
    (template_id, account_code, parent_account_code, account_name, account_class, class_code,
     account_nature, is_analytical, is_system_reserved, saft_grouping_code, sort_order)
SELECT t.id, v.account_code, v.parent_account_code, v.account_name, v.account_class, v.class_code,
       v.account_nature, v.is_analytical, TRUE, v.account_code, v.sort_order
FROM kudiba_accounting.chart_templates t
CROSS JOIN (VALUES
    ('11', NULL, 'Instalações Petrolíferas, Plataformas e Concessões em Exploração', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', FALSE, 0),
    ('11.1', '11', 'Plataformas Offshore, Unidades Flutuantes FPSO e Sondas', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 1),
    ('11.2', '11', 'Poços Produtores de Hidrocarbonetos e Linhas de Escoamento Subsea', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 2),
    ('11.3', '11', 'Oleodutos, Gasodutos e Terminais Marítimos de Carga de Crude', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 3),
    ('12', NULL, 'Activos de Pesquisa e Avaliação Sísmica (Geológica e Geofísica 3D/4D)', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 4),
    ('14', NULL, 'Trabalhos Petrolíferos e Perfuração em Curso (Drilling in Progress)', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'DEBIT', TRUE, 5),
    ('18', NULL, 'Amortizações Acumuladas pelo Método da Unidade de Produção (UOP)', 'CLASS_1_MEIOS_FIXOS_INVESTIMENTOS', '1', 'CREDIT', TRUE, 6),
    ('21', NULL, 'Materiais de Perfuração, Reagentes Químicos e Tubulares (Casing)', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 7),
    ('22', NULL, 'Inventários de Petróleo Bruto Armazenado em Tanques / FPSO (Crude Oil)', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 8),
    ('23', NULL, 'Peças Sobressalentes e Equipamentos de Cabeça de Poço (Christmas Tree)', 'CLASS_2_EXISTENCIAS', '2', 'DEBIT', TRUE, 9),
    ('31', NULL, 'Clientes de Petróleo Bruto e Traders Internacionais (Offtakers)', 'CLASS_3_TERCEIROS', '3', 'DEBIT', TRUE, 10),
    ('32', NULL, 'Fornecedores e Contratistas de Engenharia e Serviços Petrolíferos', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 11),
    ('33', NULL, 'Contas de Operações Conjuntas / Cash Calls com Parceiros de Bloco', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 12),
    ('34', NULL, 'Estado Petrolífero — Tributação Específica da Lei n.º 13/04', 'CLASS_3_TERCEIROS', '3', 'CREDIT', FALSE, 13),
    ('34.1', '34', 'Imposto sobre o Rendimento do Petróleo (IRP)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 14),
    ('34.2', '34', 'Imposto sobre a Produção de Petróleo (IPP)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 15),
    ('34.3', '34', 'Imposto de Transacção sobre o Petróleo (ITP)', 'CLASS_3_TERCEIROS', '3', 'CREDIT', TRUE, 16),
    ('43', NULL, 'Contas Bancárias Operacionais em Dólares dos EUA (USD) e Kwanzas (AOA)', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 17),
    ('44', NULL, 'Fundo Fiduciário Bloqueado para Abandono de Jazigos (Decommissioning Fund)', 'CLASS_4_MEIOS_MONETARIOS', '4', 'DEBIT', TRUE, 18),
    ('51', NULL, 'Fundo Social da Associação Petrolífera / Capital Investido no Bloco', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 19),
    ('59', NULL, 'Provisão para Abandono e Restauração Ambiental de Poços (ARO / IAS 37)', 'CLASS_5_CAPITAL_RESERVAS', '5', 'CREDIT', TRUE, 20),
    ('61', NULL, 'Custos Operacionais de Campo e Elevação (Lifting Costs / OPEX Petrolífero)', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 21),
    ('62', NULL, 'Logística Offshore, Suporte de Barcos de Apoio e Helicópteros', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 22),
    ('63', NULL, 'Amortização do Exercício por Unidade de Produção (UOP Depletion)', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 23),
    ('65', NULL, 'Custos Petrolíferos Recuperáveis Elegíveis (Cost Oil Pool)', 'CLASS_7_CUSTOS_POR_NATUREZA', '6', 'DEBIT', TRUE, 24),
    ('71', NULL, 'Receitas de Venda de Petróleo Bruto (Crude Oil Liftings)', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', FALSE, 25),
    ('71.1', '71', 'Vendas de Petróleo de Custo (Cost Oil Recovery)', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 26),
    ('71.2', '71', 'Vendas de Petróleo de Lucro da Associação (Profit Oil)', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 27),
    ('72', NULL, 'Receitas de Venda de Gás Natural e Gás Liquefeito (LNG)', 'CLASS_6_PROVEITOS_POR_NATUREZA', '7', 'CREDIT', TRUE, 28),
    ('81', NULL, 'Resultado da Actividade Petrolífera por Bloco (Ring Fencing)', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 29),
    ('88', NULL, 'Resultado Líquido do Exercício Petrolífero', 'CLASS_8_RESULTADOS', '8', 'CREDIT', TRUE, 30)
) AS v(account_code, parent_account_code, account_name, account_class, class_code, account_nature, is_analytical, sort_order)
WHERE t.code = 'PGC_PETROLEO'
ON CONFLICT (template_id, account_code) DO UPDATE SET
    account_name = EXCLUDED.account_name,
    account_class = EXCLUDED.account_class,
    account_nature = EXCLUDED.account_nature,
    sort_order = EXCLUDED.sort_order;

