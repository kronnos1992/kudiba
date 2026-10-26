import { CashFlowData } from './CashFlowStatement';
import { FinancialNotesData } from './FinancialNotesStatement';

export interface CorporateEntityMeta {
  companyName: string;
  nif: string;
  address?: string;
  fiscalYear: number;
  currency?: string;
}

export interface BalanceSheetExportData {
  imobCorporeas: number;
  imobIncorporeas: number;
  investFinanceiros?: number;
  amortAcumuladas: number;
  totalAtivoNaoCorrente: number;
  existencias: number;
  clientes: number;
  estadoDevedor: number;
  outrosDevedores: number;
  meiosFinanceiros: number;
  totalAtivoCorrente: number;
  totalAtivo: number;
  capitalSocial: number;
  reservas: number;
  resultadosTransitados: number;
  resultadoPeriodo: number;
  totalCapitalProprio: number;
  emprestimos?: number;
  fornecedores: number;
  estadoCredor: number;
  remuneracoesPagar: number;
  outrosCredores: number;
  totalPassivo: number;
  totalPassivoCapitalProprio: number;
  balancoDiff: number;
  isBalanced: boolean;
}

export interface IncomeStatementExportData {
  vendas: number;
  servicos: number;
  outrosProveitos: number;
  totalProveitosOperacionais: number;
  cmvmc: number;
  margemBruta: number;
  fse: number;
  pessoal: number;
  amortizacoes: number;
  outrosCustosOperacionais: number;
  totalCustosOperacionais: number;
  resultadoOperacional: number;
  proveitosFinanceiros: number;
  custosFinanceiros: number;
  resultadoFinanceiro: number;
  rai: number;
  impostoEstimado: number;
  resultadoLiquido: number;
}

export type StatementExportTarget =
  | 'balance_sheet'
  | 'income_statement'
  | 'cash_flow'
  | 'notes'
  | 'both'
  | 'all';

const fmtKz = (val: number): string =>
  new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val || 0) + ' Kz';

const fmtNum = (val: number): string => (val || 0).toFixed(2).replace('.', ',');

const fmtPct = (num: number, base: number): string => {
  if (!base || Math.abs(base) < 0.001) return '0,00%';
  return ((num / base) * 100).toFixed(2).replace('.', ',') + '%';
};

interface StatementRow {
  code: string;
  label: string;
  note: string;
  amount: number;
  pct: string;
  isSection?: boolean;
  isSubtotal?: boolean;
  isTotal?: boolean;
  isNegative?: boolean;
}

export const buildBalanceSheetRows = (b: BalanceSheetExportData): StatementRow[] => {
  const totalA = b.totalAtivo || 1;
  const totalCP = b.totalPassivoCapitalProprio || 1;
  return [
    { code: '', label: 'ACTIVO', note: '', amount: 0, pct: '', isSection: true },
    { code: 'Classe 1', label: 'ACTIVOS NÃO CORRENTES', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '11',
      label: 'Imobilizações corpóreas',
      note: 'Nota 4',
      amount: b.imobCorporeas,
      pct: fmtPct(b.imobCorporeas, totalA),
    },
    {
      code: '12',
      label: 'Imobilizações incorpóreas',
      note: 'Nota 5',
      amount: b.imobIncorporeas,
      pct: fmtPct(b.imobIncorporeas, totalA),
    },
    ...(b.investFinanceiros && b.investFinanceiros > 0
      ? [
          {
            code: '13/14',
            label: 'Investimentos em subsidiárias, associadas e outros activos financeiros',
            note: 'Nota 6',
            amount: b.investFinanceiros,
            pct: fmtPct(b.investFinanceiros, totalA),
          },
        ]
      : []),
    {
      code: '18',
      label: '(-) Amortizações acumuladas',
      note: 'Nota 4/5',
      amount: -Math.abs(b.amortAcumuladas),
      pct: fmtPct(-Math.abs(b.amortAcumuladas), totalA),
      isNegative: true,
    },
    {
      code: 'ANC',
      label: 'SUBTOTAL DO ACTIVO NÃO CORRENTE',
      note: '',
      amount: b.totalAtivoNaoCorrente,
      pct: fmtPct(b.totalAtivoNaoCorrente, totalA),
      isSubtotal: true,
    },
    { code: 'Classes 2-4', label: 'ACTIVOS CORRENTES', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '21-26',
      label: 'Existências (Inventários / Mercadorias)',
      note: 'Nota 8',
      amount: b.existencias,
      pct: fmtPct(b.existencias, totalA),
    },
    {
      code: '31',
      label: 'Clientes (Contas correntes e títulos a receber)',
      note: 'Nota 9',
      amount: b.clientes,
      pct: fmtPct(b.clientes, totalA),
    },
    {
      code: '34.1',
      label: 'Estado e outros entes públicos (Saldo devedor)',
      note: 'Nota 9',
      amount: b.estadoDevedor,
      pct: fmtPct(b.estadoDevedor, totalA),
    },
    {
      code: '37',
      label: 'Outros devedores e custos diferidos',
      note: 'Nota 9',
      amount: b.outrosDevedores,
      pct: fmtPct(b.outrosDevedores, totalA),
    },
    {
      code: '41-45',
      label: 'Meios financeiros líquidos (Caixa e depósitos bancários)',
      note: 'Nota 10',
      amount: b.meiosFinanceiros,
      pct: fmtPct(b.meiosFinanceiros, totalA),
    },
    {
      code: 'AC',
      label: 'SUBTOTAL DO ACTIVO CORRENTE',
      note: '',
      amount: b.totalAtivoCorrente,
      pct: fmtPct(b.totalAtivoCorrente, totalA),
      isSubtotal: true,
    },
    {
      code: 'TA',
      label: 'TOTAL DO ACTIVO',
      note: '',
      amount: b.totalAtivo,
      pct: '100,00%',
      isTotal: true,
    },
    { code: '', label: 'CAPITAL PRÓPRIO E PASSIVO', note: '', amount: 0, pct: '', isSection: true },
    { code: 'Classe 5', label: 'CAPITAL PRÓPRIO', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '51',
      label: 'Capital social realizado',
      note: 'Nota 12',
      amount: b.capitalSocial,
      pct: fmtPct(b.capitalSocial, totalCP),
    },
    {
      code: '52-55',
      label: 'Reservas legais e estatutárias',
      note: 'Nota 13',
      amount: b.reservas,
      pct: fmtPct(b.reservas, totalCP),
    },
    {
      code: '56',
      label: 'Resultados transitados de exercícios anteriores',
      note: 'Nota 14',
      amount: b.resultadosTransitados,
      pct: fmtPct(b.resultadosTransitados, totalCP),
    },
    {
      code: '88',
      label: 'Resultado líquido do exercício',
      note: 'Nota 14',
      amount: b.resultadoPeriodo,
      pct: fmtPct(b.resultadoPeriodo, totalCP),
    },
    {
      code: 'TCP',
      label: 'SUBTOTAL DO CAPITAL PRÓPRIO',
      note: '',
      amount: b.totalCapitalProprio,
      pct: fmtPct(b.totalCapitalProprio, totalCP),
      isSubtotal: true,
    },
    { code: 'Classes 3-4', label: 'PASSIVO (CORRENTE E NÃO CORRENTE)', note: '', amount: 0, pct: '', isSection: true },
    ...(b.emprestimos && b.emprestimos > 0
      ? [
          {
            code: '33',
            label: 'Empréstimos obtidos de instituições financeiras',
            note: 'Nota 17',
            amount: b.emprestimos,
            pct: fmtPct(b.emprestimos, totalCP),
          },
        ]
      : []),
    {
      code: '32',
      label: 'Fornecedores (Contas correntes e títulos a pagar)',
      note: 'Nota 19',
      amount: b.fornecedores,
      pct: fmtPct(b.fornecedores, totalCP),
    },
    {
      code: '34.2',
      label: 'Estado e outros entes públicos (Saldo credor / Impostos a pagar)',
      note: 'Nota 19',
      amount: b.estadoCredor,
      pct: fmtPct(b.estadoCredor, totalCP),
    },
    {
      code: '36',
      label: 'Pessoal — Remunerações e encargos a pagar',
      note: 'Nota 20',
      amount: b.remuneracoesPagar,
      pct: fmtPct(b.remuneracoesPagar, totalCP),
    },
    {
      code: '37',
      label: 'Outros credores e acréscimos de custos',
      note: 'Nota 20',
      amount: b.outrosCredores,
      pct: fmtPct(b.outrosCredores, totalCP),
    },
    {
      code: 'TP',
      label: 'SUBTOTAL DO PASSIVO',
      note: '',
      amount: b.totalPassivo,
      pct: fmtPct(b.totalPassivo, totalCP),
      isSubtotal: true,
    },
    {
      code: 'TCPP',
      label: 'TOTAL DO CAPITAL PRÓPRIO E DO PASSIVO',
      note: '',
      amount: b.totalPassivoCapitalProprio,
      pct: '100,00%',
      isTotal: true,
    },
  ];
};

export const buildIncomeStatementRows = (d: IncomeStatementExportData): StatementRow[] => {
  const vn = d.vendas + d.servicos || d.totalProveitosOperacionais || 1;
  return [
    { code: 'Classe 6', label: 'PROVEITOS E GANHOS OPERACIONAIS', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '61',
      label: 'Vendas de mercadorias e produtos acabados',
      note: 'Nota 22',
      amount: d.vendas,
      pct: fmtPct(d.vendas, vn),
    },
    {
      code: '62',
      label: 'Prestações de serviços',
      note: 'Nota 22',
      amount: d.servicos,
      pct: fmtPct(d.servicos, vn),
    },
    {
      code: '63-65',
      label: 'Outros proveitos e ganhos operacionais',
      note: 'Nota 23',
      amount: d.outrosProveitos,
      pct: fmtPct(d.outrosProveitos, vn),
    },
    {
      code: 'A',
      label: 'TOTAL DOS PROVEITOS E GANHOS OPERACIONAIS (A)',
      note: '',
      amount: d.totalProveitosOperacionais,
      pct: fmtPct(d.totalProveitosOperacionais, vn),
      isSubtotal: true,
    },
    { code: 'Classe 7', label: 'CUSTOS E PERDAS OPERACIONAIS', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '71',
      label: '(-) Custo das mercadorias vendidas e das matérias consumidas (CMVMC)',
      note: 'Nota 26',
      amount: -Math.abs(d.cmvmc),
      pct: fmtPct(-Math.abs(d.cmvmc), vn),
      isNegative: true,
    },
    {
      code: 'MB',
      label: 'MARGEM BRUTA COMERCIAL / INDUSTRIAL',
      note: '',
      amount: d.margemBruta,
      pct: fmtPct(d.margemBruta, vn),
      isSubtotal: true,
    },
    {
      code: '75.2',
      label: '(-) Fornecimentos e serviços de terceiros (FSE)',
      note: 'Nota 29',
      amount: -Math.abs(d.fse),
      pct: fmtPct(-Math.abs(d.fse), vn),
      isNegative: true,
    },
    {
      code: '72',
      label: '(-) Custos com o pessoal (Remunerações e encargos sociais INSS 8%)',
      note: 'Nota 27',
      amount: -Math.abs(d.pessoal),
      pct: fmtPct(-Math.abs(d.pessoal), vn),
      isNegative: true,
    },
    {
      code: '73',
      label: '(-) Amortizações do exercício',
      note: 'Nota 28',
      amount: -Math.abs(d.amortizacoes),
      pct: fmtPct(-Math.abs(d.amortizacoes), vn),
      isNegative: true,
    },
    {
      code: '75.3/78',
      label: '(-) Outros custos e perdas operacionais e impostos suportados',
      note: 'Nota 30',
      amount: -Math.abs(d.outrosCustosOperacionais),
      pct: fmtPct(-Math.abs(d.outrosCustosOperacionais), vn),
      isNegative: true,
    },
    {
      code: 'B',
      label: 'TOTAL DOS CUSTOS E PERDAS OPERACIONAIS (B)',
      note: '',
      amount: -Math.abs(d.totalCustosOperacionais),
      pct: fmtPct(-Math.abs(d.totalCustosOperacionais), vn),
      isSubtotal: true,
      isNegative: true,
    },
    {
      code: '82',
      label: 'RESULTADOS OPERACIONAIS — EBIT (A - B)',
      note: '',
      amount: d.resultadoOperacional,
      pct: fmtPct(d.resultadoOperacional, vn),
      isSubtotal: true,
    },
    { code: 'Contas 66/76', label: 'RESULTADOS FINANCEIROS', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '66',
      label: '(+) Proveitos e ganhos financeiros gerais (Juros e ganhos cambiais 66.2)',
      note: 'Nota 31',
      amount: d.proveitosFinanceiros,
      pct: fmtPct(d.proveitosFinanceiros, vn),
    },
    {
      code: '76',
      label: '(-) Custos e perdas financeiros gerais (Juros, perdas cambiais 76.2 e comissões)',
      note: 'Nota 31',
      amount: -Math.abs(d.custosFinanceiros),
      pct: fmtPct(-Math.abs(d.custosFinanceiros), vn),
      isNegative: true,
    },
    {
      code: '83',
      label: 'RESULTADOS FINANCEIROS (Conta 66 - Conta 76)',
      note: '',
      amount: d.resultadoFinanceiro,
      pct: fmtPct(d.resultadoFinanceiro, vn),
      isSubtotal: true,
    },
    {
      code: 'RAI',
      label: 'RESULTADOS ANTES DE IMPOSTOS — RAI / EBT (82 + 83)',
      note: '',
      amount: d.rai,
      pct: fmtPct(d.rai, vn),
      isSubtotal: true,
    },
    {
      code: '87',
      label: '(-) Imposto sobre os lucros (Imposto Industrial — Regime Geral 25%)',
      note: 'Nota 35',
      amount: -Math.abs(d.impostoEstimado),
      pct: fmtPct(-Math.abs(d.impostoEstimado), vn),
      isNegative: true,
    },
    {
      code: '88',
      label: 'RESULTADO LÍQUIDO DO EXERCÍCIO',
      note: 'Nota 36',
      amount: d.resultadoLiquido,
      pct: fmtPct(d.resultadoLiquido, vn),
      isTotal: true,
    },
  ];
};

export const buildCashFlowRows = (cf: CashFlowData): StatementRow[] => {
  const base = Math.abs(cf.fluxoOperacional) || 1;
  return [
    { code: '', label: '1. ACTIVIDADES OPERACIONAIS (MÉTODO DIRECTO)', note: '', amount: 0, pct: '', isSection: true },
    {
      code: 'OP.1',
      label: 'Recebimentos de clientes',
      note: 'Nota 43',
      amount: cf.recebimentosClientes,
      pct: fmtPct(cf.recebimentosClientes, base),
    },
    {
      code: 'OP.2',
      label: '(-) Pagamentos a fornecedores',
      note: 'Nota 43',
      amount: -Math.abs(cf.pagamentosFornecedores),
      pct: fmtPct(-Math.abs(cf.pagamentosFornecedores), base),
      isNegative: true,
    },
    {
      code: 'OP.3',
      label: '(-) Pagamentos ao pessoal',
      note: 'Nota 43',
      amount: -Math.abs(cf.pagamentosPessoal),
      pct: fmtPct(-Math.abs(cf.pagamentosPessoal), base),
      isNegative: true,
    },
    {
      code: 'OP.4',
      label: '(-) Pagamentos de impostos e tributos (Estado)',
      note: 'Nota 43',
      amount: -Math.abs(cf.pagamentosImpostos),
      pct: fmtPct(-Math.abs(cf.pagamentosImpostos), base),
      isNegative: true,
    },
    {
      code: 'OP.5',
      label: '(+/-) Outros recebimentos / pagamentos operacionais',
      note: '',
      amount: cf.outrosOperacionais,
      pct: fmtPct(cf.outrosOperacionais, base),
    },
    {
      code: 'FLUXO.OP',
      label: 'FLUXO DE CAIXA LÍQUIDO DAS ACTIVIDADES OPERACIONAIS (A)',
      note: '',
      amount: cf.fluxoOperacional,
      pct: '100,00%',
      isSubtotal: true,
    },
    { code: '', label: '2. ACTIVIDADES DE INVESTIMENTO', note: '', amount: 0, pct: '', isSection: true },
    {
      code: 'INV.1',
      label: '(-) Pagamentos por aquisição de imobilizado corpóreo',
      note: 'Nota 4',
      amount: -Math.abs(cf.aquisicoesImobilizadoCorporeo),
      pct: '',
      isNegative: true,
    },
    {
      code: 'INV.2',
      label: '(-) Pagamentos por aquisição de imobilizado incorpóreo',
      note: 'Nota 5',
      amount: -Math.abs(cf.aquisicoesImobilizadoIncorporeo),
      pct: '',
      isNegative: true,
    },
    {
      code: 'INV.3',
      label: '(+) Recebimentos por alienação de imobilizado',
      note: '',
      amount: cf.alienacoesImobilizado,
      pct: '',
    },
    {
      code: 'FLUXO.INV',
      label: 'FLUXO DE CAIXA LÍQUIDO DAS ACTIVIDADES DE INVESTIMENTO (B)',
      note: '',
      amount: cf.fluxoInvestimento,
      pct: '',
      isSubtotal: true,
    },
    { code: '', label: '3. ACTIVIDADES DE FINANCIAMENTO', note: '', amount: 0, pct: '', isSection: true },
    {
      code: 'FIN.1',
      label: '(+) Aumento de capital social e entradas de sócios',
      note: 'Nota 12',
      amount: cf.aumentoCapital,
      pct: '',
    },
    {
      code: 'FIN.2',
      label: '(+) Financiamentos e empréstimos obtidos',
      note: 'Nota 17',
      amount: cf.financiamentosObtidos,
      pct: '',
    },
    {
      code: 'FIN.3',
      label: '(-) Amortizações de financiamentos bancários',
      note: 'Nota 17',
      amount: -Math.abs(cf.amortizacaoFinanciamentos),
      pct: '',
      isNegative: true,
    },
    {
      code: 'FIN.4',
      label: '(-) Juros e encargos financeiros suportados',
      note: 'Nota 31',
      amount: -Math.abs(cf.jurosPagos),
      pct: '',
      isNegative: true,
    },
    {
      code: 'FLUXO.FIN',
      label: 'FLUXO DE CAIXA LÍQUIDO DAS ACTIVIDADES DE FINANCIAMENTO (C)',
      note: '',
      amount: cf.fluxoFinanciamento,
      pct: '',
      isSubtotal: true,
    },
    { code: '', label: 'RESUMO E VARIAÇÃO LÍQUIDA DE MEIOS FINANCEIROS', note: '', amount: 0, pct: '', isSection: true },
    {
      code: 'VAR.CX',
      label: 'VARIAÇÃO LÍQUIDA DE CAIXA E EQUIVALENTES (A + B + C)',
      note: '',
      amount: cf.variacaoLiquidaCaixa,
      pct: '',
      isSubtotal: true,
    },
    {
      code: 'CX.INI',
      label: '(+) Saldo inicial de caixa e depósitos bancários',
      note: 'Nota 10',
      amount: cf.saldoInicialCaixa,
      pct: '',
    },
    {
      code: 'CX.FIM',
      label: '(=) SALDO FINAL DE CAIXA E EQUIVALENTES DE CAIXA',
      note: 'Nota 10',
      amount: cf.saldoFinalCaixa,
      pct: '',
      isTotal: true,
    },
  ];
};

export const buildFinancialNotesRows = (n: FinancialNotesData): StatementRow[] => {
  return [
    { code: '', label: 'NOTA 4 & 10 — MEIOS FINANCEIROS LÍQUIDOS (DISPONIBILIDADES)', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '41', label: 'Caixa Geral (Numerário em moeda nacional)', note: 'Nota 10', amount: n.caixaGeral, pct: '' },
    { code: '43', label: 'Depósitos à Ordem em Instituições Bancárias', note: 'Nota 10', amount: n.depositosOrdem, pct: '' },
    { code: '44', label: 'Outros depósitos bancários e aplicações de tesouraria', note: 'Nota 10', amount: n.outrosDepositos, pct: '' },
    { code: 'MFL.TOTAL', label: 'Total dos Meios Financeiros Líquidos', note: '', amount: n.totalMeiosFinanceiros, pct: '', isSubtotal: true },

    { code: '', label: 'NOTA 8 — EXISTÊNCIAS E INVENTÁRIOS', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '21', label: 'Mercadorias para revenda', note: 'Nota 8', amount: n.mercadorias, pct: '' },
    { code: '22', label: 'Matérias-primas, subsidiárias e de consumo', note: 'Nota 8', amount: n.materiasPrimas, pct: '' },
    { code: 'INV.TOTAL', label: 'Total de Existências', note: '', amount: n.totalExistencias, pct: '', isSubtotal: true },

    { code: '', label: 'NOTA 9 — CLIENTES E OUTRAS CONTAS A RECEBER', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '31.1', label: 'Clientes — Contas correntes correntes', note: 'Nota 9', amount: n.clientesContaCorrente, pct: '' },
    { code: '37.1', label: 'Outros devedores e adiantamentos', note: 'Nota 9', amount: n.outrosDevedores, pct: '' },
    { code: 'REC.TOTAL', label: 'Total de Contas a Receber', note: '', amount: n.totalClientesOutrosDevedores, pct: '', isSubtotal: true },

    { code: '', label: 'NOTAS 4 & 5 — IMOBILIZAÇÕES CORPÓREAS E INCORPÓREAS', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '11', label: 'Imobilizações corpóreas (Custo de aquisição)', note: 'Nota 4', amount: n.imobilizacoesCorporeas, pct: '' },
    { code: '12', label: 'Imobilizações incorpóreas (Software / Licenças)', note: 'Nota 5', amount: n.imobilizacoesIncorporeas, pct: '' },
    { code: '18', label: '(-) Amortizações acumuladas', note: 'Nota 4/5', amount: -Math.abs(n.amortizacoesAcumuladas), pct: '', isNegative: true },
    { code: 'ANC.LIQ', label: 'Activo Líquido Não Corrente', note: '', amount: n.ativoLiquidoNaoCorrente, pct: '', isSubtotal: true },

    { code: '', label: 'NOTAS 19 & 20 — FORNECEDORES E OUTRAS CONTAS A PAGAR', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '32.1', label: 'Fornecedores — Contas correntes', note: 'Nota 19', amount: n.fornecedoresCorrentes, pct: '' },
    { code: '36.1', label: 'Pessoal — Remunerações a pagar', note: 'Nota 20', amount: n.remuneracoesPagar, pct: '' },
    { code: '37.2', label: 'Outros credores', note: 'Nota 20', amount: n.outrosCredores, pct: '' },
    { code: 'PASS.CORR', label: 'Total Passivo Corrente Comercial', note: '', amount: n.totalPassivoCorrente, pct: '', isSubtotal: true },

    { code: '', label: 'NOTA 9 & 35 — ESTADO E TRIBUTOS PENDENTES', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '34.5.3', label: 'IVA Apurado no Período (Saldo a Pagar)', note: 'Nota 35', amount: n.ivaApurado, pct: '' },
    { code: '34.2.1', label: 'IRT Retido aos Trabalhadores (a entregar)', note: 'Nota 35', amount: n.irtRetido, pct: '' },
    { code: '34.2.3', label: 'Retenção na Fonte de Serviços (6,5%)', note: 'Nota 35', amount: n.retencaoServicos, pct: '' },
    { code: '34.1.1', label: 'Estimativa de Imposto Industrial (25%)', note: 'Nota 35', amount: n.impostoIndustrialEstimado, pct: '' },

    { code: '', label: 'NOTAS 12, 13 & 14 — CAPITAL PRÓPRIO E RESERVAS', note: 'Art. 5.º PGC', amount: 0, pct: '', isSection: true },
    { code: '51', label: 'Capital Social Registado', note: 'Nota 12', amount: n.capitalSocial, pct: '' },
    { code: '52', label: 'Reservas Legais', note: 'Nota 13', amount: n.reservasLegais, pct: '' },
    { code: '56', label: 'Resultados Transitados', note: 'Nota 14', amount: n.resultadosTransitados, pct: '' },
    { code: '88', label: 'Resultado Líquido do Exercício', note: 'Nota 14', amount: n.resultadoLiquido, pct: '' },
    { code: 'CP.TOTAL', label: 'Total do Capital Próprio', note: '', amount: n.totalCapitalProprio, pct: '', isTotal: true },
  ];
};

/**
 * 1. EXPORTAÇÃO CSV CORPORATIVO (UTF-8 com BOM, compatível com Excel PT/AO)
 */
export const exportFinancialStatementCsv = (
  target: StatementExportTarget,
  meta: CorporateEntityMeta,
  balanco: BalanceSheetExportData,
  dre: IncomeStatementExportData,
  cashFlow?: CashFlowData,
  notesData?: FinancialNotesData
) => {
  const nowStr = new Date().toLocaleString('pt-AO');
  const lines: string[] = [
    `RELATÓRIO E CONTAS CORPORATIVO — DEMONSTRAÇÕES FINANCEIRAS OFICIAIS`,
    `Normativo Contabilístico: Decreto n.º 82/01 de 16 de Novembro — Plano Geral de Contabilidade de Angola (PGC)`,
    `Entidade:;${meta.companyName};NIF:;${meta.nif}`,
    `Exercício Económico:;${meta.fiscalYear};Período de Relato:;01/01/${meta.fiscalYear} a 31/12/${meta.fiscalYear}`,
    `Moeda de Apresentação:;Kwanzas (AOA);Data de Emissão:;${nowStr}`,
    '',
  ];

  if (target === 'balance_sheet' || target === 'both' || target === 'all') {
    lines.push(
      `=== I. BALANÇO PATRIMONIAL EM 31 DE DEZEMBRO DE ${meta.fiscalYear} ===`,
      'Código PGC;Rubricas / Designação da Conta;Nota do Anexo;Montante Exercício N (Kz); Estrutura (%)',
      ...buildBalanceSheetRows(balanco).map((r) =>
        r.isSection
          ? `${r.code};"${r.label}";;;`
          : `${r.code};"${r.label}";${r.note};${fmtNum(r.amount)};${r.pct}`
      ),
      `EQUILÍBRIO PATRIMONIAL;${balanco.isBalanced ? 'Ativo = Capital Próprio + Passivo (Equilibrado)' : 'Diferença Transitória de Fecho'};;${fmtNum(balanco.balancoDiff)};`,
      ''
    );
  }

  if (target === 'income_statement' || target === 'both' || target === 'all') {
    const ebitda = dre.resultadoOperacional + dre.amortizacoes;
    lines.push(
      `=== II. DEMONSTRAÇÃO DE RESULTADOS POR NATUREZA — EXERCÍCIO DE ${meta.fiscalYear} ===`,
      'Conta PGC;Rubricas / Designação por Natureza;Nota do Anexo;Montante Exercício N (Kz);Análise Vertical (% VN)',
      ...buildIncomeStatementRows(dre).map((r) =>
        r.isSection
          ? `${r.code};"${r.label}";;;`
          : `${r.code};"${r.label}";${r.note};${fmtNum(r.amount)};${r.pct}`
      ),
      '',
      'INDICADORES ECONÓMICOS E DE RENDIBILIDADE;;Valor (Kz);Margem s/ Volume de Negócios',
      `Volume de Negócios (61 + 62);;${fmtNum(dre.vendas + dre.servicos)};100,00%`,
      `EBITDA (Resultado Operacional + Amortizações);;${fmtNum(ebitda)};${fmtPct(ebitda, dre.vendas + dre.servicos || 1)}`,
      `EBIT (Resultado Operacional - Conta 82);;${fmtNum(dre.resultadoOperacional)};${fmtPct(dre.resultadoOperacional, dre.vendas + dre.servicos || 1)}`,
      `Resultado Líquido do Exercício (Conta 88);;${fmtNum(dre.resultadoLiquido)};${fmtPct(dre.resultadoLiquido, dre.vendas + dre.servicos || 1)}`,
      ''
    );
  }

  if ((target === 'cash_flow' || target === 'all') && cashFlow) {
    lines.push(
      `=== III. DEMONSTRAÇÃO DOS FLUXOS DE CAIXA (DFC) — EXERCÍCIO DE ${meta.fiscalYear} ===`,
      'Código;Rubricas dos Fluxos de Caixa;Nota;Montante Exercício N (Kz);Proporção (%)',
      ...buildCashFlowRows(cashFlow).map((r) =>
        r.isSection
          ? `${r.code};"${r.label}";;;`
          : `${r.code};"${r.label}";${r.note};${fmtNum(r.amount)};${r.pct}`
      ),
      `CONCILIAÇÃO DE CAIXA;${cashFlow.isReconciled ? 'Reconciliado com Balanço' : 'Verificar Saldo'};;${fmtNum(cashFlow.saldoFinalCaixa)};`,
      ''
    );
  }

  if ((target === 'notes' || target === 'all') && notesData) {
    lines.push(
      `=== IV. NOTAS ÀS CONTAS / ANEXO AO BALANÇO E DRE (PGC ANGOLA) — EXERCÍCIO DE ${meta.fiscalYear} ===`,
      'Nota / Conta;Descrição da Divulgação Financeira;Referência Legal;Montante (Kz);',
      ...buildFinancialNotesRows(notesData).map((r) =>
        r.isSection
          ? `${r.code};"${r.label}";;;`
          : `${r.code};"${r.label}";${r.note};${fmtNum(r.amount)};`
      ),
      ''
    );
  }

  lines.push(
    'TERMO DE RESPONSABILIDADE E ASSINATURAS OFICIAIS;;;;',
    'A Administração / Gerência:;_______________________________;O Contabilista Certificado (OCPCA):;_______________________________'
  );

  const filename =
    target === 'balance_sheet'
      ? `Balanco_Patrimonial_PGC_${meta.fiscalYear}.csv`
      : target === 'income_statement'
      ? `Demonstracao_Resultados_PGC_${meta.fiscalYear}.csv`
      : target === 'cash_flow'
      ? `Demonstracao_Fluxos_Caixa_PGC_${meta.fiscalYear}.csv`
      : target === 'notes'
      ? `Notas_as_Contas_Anexo_PGC_${meta.fiscalYear}.csv`
      : target === 'both'
      ? `Relatorio_Contas_Balanco_DR_PGC_${meta.fiscalYear}.csv`
      : `Dossier_Contabilistico_Completo_PGC_${meta.fiscalYear}.csv`;

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

/**
 * 2. EXPORTAÇÃO EXCEL CORPORATIVO (.xls com formatação visual completa)
 */
export const exportFinancialStatementExcel = (
  target: StatementExportTarget,
  meta: CorporateEntityMeta,
  balanco: BalanceSheetExportData,
  dre: IncomeStatementExportData,
  cashFlow?: CashFlowData,
  notesData?: FinancialNotesData
) => {
  const nowStr = new Date().toLocaleString('pt-AO');
  const vn = dre.vendas + dre.servicos || 1;
  const ebitda = dre.resultadoOperacional + dre.amortizacoes;

  const renderRowsHtml = (rows: StatementRow[]) =>
    rows
      .map((r) => {
        if (r.isSection) {
          return `
            <tr>
              <td colspan="5" style="background-color:#e2e8f0; color:#0f172a; font-weight:bold; font-size:10pt; padding:6px 10px; border:1px solid #cbd5e1;">
                ${r.code ? `[${r.code}] ` : ''}${r.label}
              </td>
            </tr>`;
        }
        if (r.isTotal) {
          return `
            <tr>
              <td style="background-color:#0f172a; color:#ffffff; font-weight:bold; text-align:center; padding:8px; border:1px solid #0f172a;">${r.code}</td>
              <td style="background-color:#0f172a; color:#ffffff; font-weight:bold; padding:8px; border:1px solid #0f172a;">${r.label}</td>
              <td style="background-color:#0f172a; color:#ffffff; text-align:center; padding:8px; border:1px solid #0f172a;">${r.note}</td>
              <td style="background-color:#0f172a; color:#ffffff; font-weight:bold; text-align:right; padding:8px; border:1px solid #0f172a; mso-number-format:'\\#\\,\\#\\#0\\.00';">${fmtKz(r.amount)}</td>
              <td style="background-color:#0f172a; color:#ffffff; font-weight:bold; text-align:right; padding:8px; border:1px solid #0f172a;">${r.pct}</td>
            </tr>`;
        }
        if (r.isSubtotal) {
          return `
            <tr>
              <td style="background-color:#f1f5f9; color:#1e293b; font-weight:bold; text-align:center; padding:6px 8px; border:1px solid #cbd5e1;">${r.code}</td>
              <td style="background-color:#f1f5f9; color:#1e293b; font-weight:bold; padding:6px 8px; border:1px solid #cbd5e1;">${r.label}</td>
              <td style="background-color:#f1f5f9; color:#475569; text-align:center; padding:6px 8px; border:1px solid #cbd5e1;">${r.note}</td>
              <td style="background-color:#f1f5f9; color:${r.amount < 0 ? '#b91c1c' : '#0f172a'}; font-weight:bold; text-align:right; padding:6px 8px; border:1px solid #cbd5e1;">${fmtKz(r.amount)}</td>
              <td style="background-color:#f1f5f9; color:#334155; font-weight:bold; text-align:right; padding:6px 8px; border:1px solid #cbd5e1;">${r.pct}</td>
            </tr>`;
        }
        return `
          <tr>
            <td style="text-align:center; padding:5px 8px; border:1px solid #e2e8f0; font-family:Consolas, monospace;">${r.code}</td>
            <td style="padding:5px 8px; border:1px solid #e2e8f0;">${r.label}</td>
            <td style="text-align:center; padding:5px 8px; border:1px solid #e2e8f0; color:#64748b;">${r.note}</td>
            <td style="text-align:right; padding:5px 8px; border:1px solid #e2e8f0; font-family:Consolas, monospace; ${r.isNegative ? 'color:#b91c1c;' : ''}">${fmtKz(r.amount)}</td>
            <td style="text-align:right; padding:5px 8px; border:1px solid #e2e8f0; color:#64748b;">${r.pct}</td>
          </tr>`;
      })
      .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Demonstracoes Financeiras PGC</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <meta http-equiv="content-type" content="text/html; charset=UTF-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9.5pt; color: #1e293b; }
        table { border-collapse: collapse; width: 100%; }
        th { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; }
        td { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; }
      </style>
    </head>
    <body>
      <table>
        <tr>
          <td colspan="5" style="font-size:14pt; font-weight:bold; color:#0f172a; text-align:center; padding:10px;">
            ${meta.companyName.toUpperCase()}
          </td>
        </tr>
        <tr>
          <td colspan="5" style="font-size:10pt; color:#475569; text-align:center;">
            NIF: <b>${meta.nif}</b> &nbsp;|&nbsp; Exercício Fiscal de <b>${meta.fiscalYear}</b> &nbsp;|&nbsp; PGC Angola (Decreto n.º 82/01)
          </td>
        </tr>
        <tr><td colspan="5" style="height:12px;"></td></tr>

        ${
          target === 'balance_sheet' || target === 'both' || target === 'all'
            ? `
        <tr>
          <td colspan="5" style="background-color:#1e3a8a; color:#ffffff; font-size:11pt; font-weight:bold; padding:8px 12px;">
            I. BALANÇO PATRIMONIAL EM 31 DE DEZEMBRO DE ${meta.fiscalYear} (Decreto n.º 82/01)
          </td>
        </tr>
        <tr>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px;">Código PGC</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:440px; text-align:left;">Rubricas / Designação</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:100px;">Nota</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:180px; text-align:right;">Exercício ${meta.fiscalYear} (Kz)</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px; text-align:right;">Peso (%)</th>
        </tr>
        ${renderRowsHtml(buildBalanceSheetRows(balanco))}
        <tr>
          <td colspan="3" style="background-color:${balanco.isBalanced ? '#ecfdf5' : '#fffbeb'}; color:${balanco.isBalanced ? '#065f46' : '#92400e'}; font-weight:bold; padding:6px 10px; border:1px solid #cbd5e1;">
            Verificação da Equação Fundamental (Activo = Capital Próprio + Passivo)
          </td>
          <td colspan="2" style="background-color:${balanco.isBalanced ? '#ecfdf5' : '#fffbeb'}; color:${balanco.isBalanced ? '#065f46' : '#92400e'}; font-weight:bold; text-align:right; padding:6px 10px; border:1px solid #cbd5e1;">
            ${balanco.isBalanced ? 'EQUILIBRADO (Δ = 0,00 Kz)' : `Diferença: ${fmtKz(balanco.balancoDiff)}`}
          </td>
        </tr>
        <tr><td colspan="5" style="height:18px;"></td></tr>
        `
            : ''
        }

        ${
          target === 'income_statement' || target === 'both' || target === 'all'
            ? `
        <tr>
          <td colspan="5" style="background-color:#065f46; color:#ffffff; font-size:11pt; font-weight:bold; padding:8px 12px;">
            ${target === 'all' || target === 'both' ? 'II. ' : ''}DEMONSTRAÇÃO DE RESULTADOS POR NATUREZA — EXERCÍCIO DE ${meta.fiscalYear}
          </td>
        </tr>
        <tr>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px;">Conta PGC</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:440px; text-align:left;">Rubricas por Natureza</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:100px;">Nota</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:180px; text-align:right;">Exercício ${meta.fiscalYear} (Kz)</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px; text-align:right;">% Vol. Negócios</th>
        </tr>
        ${renderRowsHtml(buildIncomeStatementRows(dre))}
        <tr><td colspan="5" style="height:10px;"></td></tr>
        <tr>
          <td colspan="5" style="background-color:#e2e8f0; color:#0f172a; font-weight:bold; padding:6px 10px; border:1px solid #cbd5e1;">
            SÍNTESE DE INDICADORES ECONÓMICOS E DE RENDIBILIDADE
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding:5px 8px; border:1px solid #e2e8f0;">Volume de Negócios Total (Vendas 61 + Prestações de Serviços 62)</td>
          <td style="text-align:right; font-weight:bold; padding:5px 8px; border:1px solid #e2e8f0;">${fmtKz(dre.vendas + dre.servicos)}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #e2e8f0;">100,00%</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:5px 8px; border:1px solid #e2e8f0;">EBITDA (Resultado Operacional antes de Amortizações e Impostos)</td>
          <td style="text-align:right; font-weight:bold; padding:5px 8px; border:1px solid #e2e8f0;">${fmtKz(ebitda)}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #e2e8f0;">${fmtPct(ebitda, vn)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:5px 8px; border:1px solid #e2e8f0;">Margem Operacional (EBIT / Conta 82)</td>
          <td style="text-align:right; font-weight:bold; padding:5px 8px; border:1px solid #e2e8f0;">${fmtKz(dre.resultadoOperacional)}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #e2e8f0;">${fmtPct(dre.resultadoOperacional, vn)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:5px 8px; border:1px solid #e2e8f0;">Margem Líquida do Exercício (Conta 88)</td>
          <td style="text-align:right; font-weight:bold; padding:5px 8px; border:1px solid #e2e8f0;">${fmtKz(dre.resultadoLiquido)}</td>
          <td style="text-align:right; padding:5px 8px; border:1px solid #e2e8f0;">${fmtPct(dre.resultadoLiquido, vn)}</td>
        </tr>
        <tr><td colspan="5" style="height:18px;"></td></tr>
        `
            : ''
        }

        ${
          (target === 'cash_flow' || target === 'all') && cashFlow
            ? `
        <tr>
          <td colspan="5" style="background-color:#0284c7; color:#ffffff; font-size:11pt; font-weight:bold; padding:8px 12px;">
            ${target === 'all' ? 'III. ' : ''}DEMONSTRAÇÃO DOS FLUXOS DE CAIXA (DFC) — EXERCÍCIO DE ${meta.fiscalYear} (Decreto n.º 82/01)
          </td>
        </tr>
        <tr>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px;">Código</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:440px; text-align:left;">Fluxos de Caixa por Actividade</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:100px;">Nota</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:180px; text-align:right;">Exercício ${meta.fiscalYear} (Kz)</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px; text-align:right;">Proporção (%)</th>
        </tr>
        ${renderRowsHtml(buildCashFlowRows(cashFlow))}
        <tr><td colspan="5" style="height:18px;"></td></tr>
        `
            : ''
        }

        ${
          (target === 'notes' || target === 'all') && notesData
            ? `
        <tr>
          <td colspan="5" style="background-color:#7c3aed; color:#ffffff; font-size:11pt; font-weight:bold; padding:8px 12px;">
            ${target === 'all' ? 'IV. ' : ''}NOTAS ÀS CONTAS / ANEXO AO BALANÇO E DRE (PGC ANGOLA) — EXERCÍCIO DE ${meta.fiscalYear}
          </td>
        </tr>
        <tr>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px;">Nota / Conta</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:440px; text-align:left;">Descrição da Divulgação e Políticas Contabilísticas</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:100px;">Enquadramento</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:180px; text-align:right;">Montante (Kz)</th>
          <th style="background-color:#334155; color:#ffffff; padding:7px; border:1px solid #1e293b; width:110px; text-align:right;">Observação</th>
        </tr>
        ${renderRowsHtml(buildFinancialNotesRows(notesData))}
        <tr><td colspan="5" style="height:18px;"></td></tr>
        `
            : ''
        }

        <tr>
          <td colspan="2" style="padding:18px 10px 6px 10px; border-top:1px solid #94a3b8; text-align:center; font-weight:bold;">
            __________________________________________________<br/>
            A Administração / Gerência
          </td>
          <td></td>
          <td colspan="2" style="padding:18px 10px 6px 10px; border-top:1px solid #94a3b8; text-align:center; font-weight:bold;">
            __________________________________________________<br/>
            O Contabilista Certificado (Inscrição OCPCA n.º __________)
          </td>
        </tr>
        <tr>
          <td colspan="5" style="padding-top:10px; font-size:8.5pt; color:#64748b; text-align:right;">
            Documento processado por computador · Kudiba ERP · Emitido em ${nowStr}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const filename =
    target === 'balance_sheet'
      ? `Balanco_Patrimonial_PGC_${meta.fiscalYear}.xls`
      : target === 'income_statement'
      ? `Demonstracao_Resultados_PGC_${meta.fiscalYear}.xls`
      : target === 'cash_flow'
      ? `Demonstracao_Fluxos_Caixa_PGC_${meta.fiscalYear}.xls`
      : target === 'notes'
      ? `Notas_as_Contas_Anexo_PGC_${meta.fiscalYear}.xls`
      : target === 'both'
      ? `Relatorio_Contas_Balanco_DR_PGC_${meta.fiscalYear}.xls`
      : `Dossier_Contabilistico_Completo_PGC_${meta.fiscalYear}.xls`;

  const blob = new Blob(['\uFEFF' + html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

/**
 * 3. EXPORTAÇÃO PDF CORPORATIVO (Modelo Oficial A4 Pronto para Impressão / Guardar como PDF)
 */
export const exportFinancialStatementPdf = (
  target: StatementExportTarget,
  meta: CorporateEntityMeta,
  balanco: BalanceSheetExportData,
  dre: IncomeStatementExportData,
  cashFlow?: CashFlowData,
  notesData?: FinancialNotesData
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  const nowStr = new Date().toLocaleString('pt-AO');
  const vn = dre.vendas + dre.servicos || 1;
  const ebitda = dre.resultadoOperacional + dre.amortizacoes;

  const renderTableRows = (rows: StatementRow[]) =>
    rows
      .map((r) => {
        if (r.isSection) {
          return `
            <tr class="section-row">
              <td colspan="5">${r.code ? `<span class="code-badge">${r.code}</span> ` : ''}${r.label}</td>
            </tr>`;
        }
        if (r.isTotal) {
          return `
            <tr class="total-row">
              <td class="font-mono text-center">${r.code}</td>
              <td>${r.label}</td>
              <td class="text-center">${r.note}</td>
              <td class="text-right font-mono">${fmtKz(r.amount)}</td>
              <td class="text-right font-mono">${r.pct}</td>
            </tr>`;
        }
        if (r.isSubtotal) {
          return `
            <tr class="subtotal-row">
              <td class="font-mono text-center">${r.code}</td>
              <td>${r.label}</td>
              <td class="text-center text-muted">${r.note}</td>
              <td class="text-right font-mono ${r.amount < 0 ? 'text-danger' : ''}">${fmtKz(r.amount)}</td>
              <td class="text-right font-mono">${r.pct}</td>
            </tr>`;
        }
        return `
          <tr class="item-row">
            <td class="font-mono text-center text-muted">${r.code}</td>
            <td>${r.label}</td>
            <td class="text-center text-muted">${r.note}</td>
            <td class="text-right font-mono ${r.isNegative ? 'text-danger' : ''}">${fmtKz(r.amount)}</td>
            <td class="text-right font-mono text-muted">${r.pct}</td>
          </tr>`;
      })
      .join('');

  const docTitle =
    target === 'balance_sheet'
      ? `Balanço Patrimonial PGC — Exercício de ${meta.fiscalYear}`
      : target === 'income_statement'
      ? `Demonstração de Resultados por Natureza — Exercício de ${meta.fiscalYear}`
      : target === 'cash_flow'
      ? `Demonstração dos Fluxos de Caixa (DFC) — Exercício de ${meta.fiscalYear}`
      : target === 'notes'
      ? `Notas às Contas / Anexo PGC — Exercício de ${meta.fiscalYear}`
      : target === 'both'
      ? `Relatório e Contas (Balanço + DR) — Exercício de ${meta.fiscalYear}`
      : `Dossier Contabilístico Completo (4 Demonstrações PGC) — Exercício de ${meta.fiscalYear}`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="utf-8">
      <title>${docTitle} - ${meta.companyName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 14mm 16mm 14mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          font-size: 8.5pt;
          line-height: 1.35;
          color: #1e293b;
          background: #ffffff;
          padding: 16px;
        }
        .header-box {
          border-bottom: 2px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 14px;
        }
        .company-name {
          font-size: 15pt;
          font-weight: 800;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: -0.3px;
        }
        .header-meta {
          display: flex;
          justify-content: space-between;
          font-size: 8.5pt;
          color: #475569;
          margin-top: 4px;
        }
        .section-header {
          background: #0f172a;
          color: #ffffff;
          font-size: 10.5pt;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 4px;
          margin-top: 14px;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .section-header.blue { background: #1e3a8a; }
        .section-header.emerald { background: #065f46; }
        .section-header.sky { background: #0369a1; }
        .section-header.purple { background: #6b21a8; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 7.5pt;
          letter-spacing: 0.5px;
          padding: 5px 6px;
          border-bottom: 1.5px solid #cbd5e1;
        }
        td {
          padding: 4px 6px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 8.2pt;
        }
        .font-mono {
          font-family: 'Consolas', 'Menlo', monospace;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-muted { color: #64748b; }
        .text-danger { color: #b91c1c; font-weight: 600; }
        .section-row td {
          background: #f8fafc;
          font-weight: 700;
          color: #0f172a;
          font-size: 8.2pt;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
          padding: 5px 6px;
        }
        .code-badge {
          display: inline-block;
          background: #e2e8f0;
          color: #334155;
          border-radius: 3px;
          padding: 1px 4px;
          font-size: 7pt;
          font-weight: 600;
          font-family: Consolas, monospace;
        }
        .subtotal-row td {
          background: #f8fafc;
          font-weight: 700;
          color: #0f172a;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
        }
        .total-row td {
          background: #0f172a;
          color: #ffffff !important;
          font-weight: 800;
          font-size: 9pt;
          border-top: 1.5px solid #0f172a;
          border-bottom: 1.5px solid #0f172a;
        }
        .page-break {
          page-break-before: always;
          break-before: page;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 10px 0 14px 0;
        }
        .kpi-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 8px;
          background: #f8fafc;
        }
        .kpi-title {
          font-size: 7pt;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
        }
        .kpi-value {
          font-size: 10pt;
          font-weight: 800;
          color: #0f172a;
          font-family: Consolas, monospace;
          margin-top: 2px;
        }
        .kpi-sub {
          font-size: 7pt;
          color: #047857;
          font-weight: 600;
        }
        .signatures-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-top: 24px;
          padding-top: 12px;
          page-break-inside: avoid;
        }
        .sig-line {
          border-top: 1px solid #94a3b8;
          text-align: center;
          font-size: 8pt;
          padding-top: 4px;
          color: #334155;
          font-weight: 600;
        }
        .footer-note {
          margin-top: 14px;
          font-size: 7pt;
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #e2e8f0;
          padding-top: 6px;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header-box">
        <div class="company-name">${meta.companyName}</div>
        <div class="header-meta">
          <div>NIF: <strong>${meta.nif}</strong> &nbsp;·&nbsp; PGC Angola (Decreto n.º 82/01)</div>
          <div>Exercício Económico de <strong>${meta.fiscalYear}</strong> &nbsp;·&nbsp; Moeda: <strong>Kwanzas (AOA)</strong></div>
        </div>
      </div>

      ${
        target === 'balance_sheet' || target === 'both' || target === 'all'
          ? `
      <div class="section-header blue">
        <span>I. BALANÇO PATRIMONIAL EM 31 DE DEZEMBRO DE ${meta.fiscalYear}</span>
        <span style="font-size:8pt; font-weight:normal;">Decreto Presidencial n.º 82/01</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 12%;" class="text-center">Código PGC</th>
            <th style="width: 50%; text-align: left;">Rubricas / Designação Patrimonial</th>
            <th style="width: 10%;" class="text-center">Nota</th>
            <th style="width: 16%;" class="text-right">Exercício ${meta.fiscalYear}</th>
            <th style="width: 12%;" class="text-right">Peso (%)</th>
          </tr>
        </thead>
        <tbody>
          ${renderTableRows(buildBalanceSheetRows(balanco))}
        </tbody>
      </table>
      `
          : ''
      }

      ${
        target === 'income_statement' || target === 'both' || target === 'all'
          ? `
      <div class="${target === 'both' || target === 'all' ? 'page-break' : ''}">
        <div class="section-header emerald">
          <span>${target === 'all' || target === 'both' ? 'II. ' : ''}DEMONSTRAÇÃO DE RESULTADOS POR NATUREZA — EXERCÍCIO DE ${meta.fiscalYear}</span>
          <span style="font-size:8pt; font-weight:normal;">Contas 6, 7 e 8 PGC</span>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Volume de Negócios</div>
            <div class="kpi-value">${fmtKz(dre.vendas + dre.servicos)}</div>
            <div class="kpi-sub">Vendas + Serviços</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Margem Bruta</div>
            <div class="kpi-value">${fmtKz(dre.margemBruta)}</div>
            <div class="kpi-sub">${fmtPct(dre.margemBruta, vn)} do VN</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">EBITDA Operacional</div>
            <div class="kpi-value">${fmtKz(ebitda)}</div>
            <div class="kpi-sub">${fmtPct(ebitda, vn)} do VN</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Resultado Líquido</div>
            <div class="kpi-value" style="color:${dre.resultadoLiquido >= 0 ? '#047857' : '#b91c1c'};">${fmtKz(dre.resultadoLiquido)}</div>
            <div class="kpi-sub">${fmtPct(dre.resultadoLiquido, vn)} Margem Líq.</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%;" class="text-center">Conta PGC</th>
              <th style="width: 50%; text-align: left;">Rubricas por Natureza Económica</th>
              <th style="width: 10%;" class="text-center">Nota</th>
              <th style="width: 16%;" class="text-right">Exercício ${meta.fiscalYear}</th>
              <th style="width: 12%;" class="text-right">% VN</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(buildIncomeStatementRows(dre))}
          </tbody>
        </table>
      </div>
      `
          : ''
      }

      ${
        (target === 'cash_flow' || target === 'all') && cashFlow
          ? `
      <div class="${target === 'all' ? 'page-break' : ''}">
        <div class="section-header sky">
          <span>${target === 'all' ? 'III. ' : ''}DEMONSTRAÇÃO DOS FLUXOS DE CAIXA (DFC) — EXERCÍCIO DE ${meta.fiscalYear}</span>
          <span style="font-size:8pt; font-weight:normal;">Método Directo / PGC</span>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">Fluxo Operacional</div>
            <div class="kpi-value">${fmtKz(cashFlow.fluxoOperacional)}</div>
            <div class="kpi-sub">Actividades Correntes</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Fluxo Investimento</div>
            <div class="kpi-value">${fmtKz(cashFlow.fluxoInvestimento)}</div>
            <div class="kpi-sub">Imobilizado / Capex</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Fluxo Financiamento</div>
            <div class="kpi-value">${fmtKz(cashFlow.fluxoFinanciamento)}</div>
            <div class="kpi-sub">Capital & Financiamentos</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">Saldo Final de Caixa</div>
            <div class="kpi-value" style="color:#0284c7;">${fmtKz(cashFlow.saldoFinalCaixa)}</div>
            <div class="kpi-sub">${cashFlow.isReconciled ? 'Reconciliado' : 'A Reconciliar'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%;" class="text-center">Código</th>
              <th style="width: 50%; text-align: left;">Fluxos de Caixa por Actividade</th>
              <th style="width: 10%;" class="text-center">Nota</th>
              <th style="width: 16%;" class="text-right">Exercício ${meta.fiscalYear}</th>
              <th style="width: 12%;" class="text-right">Proporção (%)</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(buildCashFlowRows(cashFlow))}
          </tbody>
        </table>
      </div>
      `
          : ''
      }

      ${
        (target === 'notes' || target === 'all') && notesData
          ? `
      <div class="${target === 'all' ? 'page-break' : ''}">
        <div class="section-header purple">
          <span>${target === 'all' ? 'IV. ' : ''}NOTAS ÀS CONTAS / ANEXO AO BALANÇO E DRE — EXERCÍCIO DE ${meta.fiscalYear}</span>
          <span style="font-size:8pt; font-weight:normal;">Art. 5.º Decreto n.º 82/01 PGC</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 14%;" class="text-center">Nota / Rubrica</th>
              <th style="width: 52%; text-align: left;">Descrição da Divulgação e Enquadramento PGC</th>
              <th style="width: 14%;" class="text-center">Referência</th>
              <th style="width: 20%;" class="text-right">Montante (Kz)</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(buildFinancialNotesRows(notesData))}
          </tbody>
        </table>
      </div>
      `
          : ''
      }

      <div class="signatures-grid">
        <div class="sig-line">
          A Administração / Gerência Executiva<br/>
          ${meta.companyName}
        </div>
        <div class="sig-line">
          O Contabilista Certificado<br/>
          (Ordem dos Contabilistas e Peritos Contabilistas de Angola — OCPCA)
        </div>
      </div>

      <div class="footer-note">
        <span>Kudiba ERP — Módulo de Contabilidade PGC & Relatório de Gestão</span>
        <span>Emitido em ${nowStr} por utilizador autorizado</span>
        <span>Página Oficial de Relato Financeiro</span>
      </div>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
};
