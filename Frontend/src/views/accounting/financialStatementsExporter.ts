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

export type StatementExportTarget = 'balance_sheet' | 'income_statement' | 'both';

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

const buildBalanceSheetRows = (b: BalanceSheetExportData): StatementRow[] => {
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
      code: '2',
      label: 'Existências (Mercadorias, matérias-primas e produtos)',
      note: 'Nota 8',
      amount: b.existencias,
      pct: fmtPct(b.existencias, totalA),
    },
    {
      code: '31',
      label: 'Contas a receber — Clientes correntes (nacionais e estrangeiros)',
      note: 'Nota 9',
      amount: b.clientes,
      pct: fmtPct(b.clientes, totalA),
    },
    {
      code: '34',
      label: 'Estado e outros entes públicos — Devedor (IVA dedutível e retenções)',
      note: 'Nota 9',
      amount: b.estadoDevedor,
      pct: fmtPct(b.estadoDevedor, totalA),
    },
    {
      code: '37',
      label: 'Outros valores a receber e devedores diversos',
      note: 'Nota 9',
      amount: b.outrosDevedores,
      pct: fmtPct(b.outrosDevedores, totalA),
    },
    {
      code: '41-45',
      label: 'Disponibilidades (Caixa, depósitos à ordem e depósitos a prazo)',
      note: 'Nota 10/47',
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
    { code: 'Classes 5/8', label: 'CAPITAL PRÓPRIO (FUNDOS PRÓPRIOS)', note: '', amount: 0, pct: '', isSection: true },
    {
      code: '51',
      label: 'Capital social subscrito e realizado',
      note: 'Nota 12',
      amount: b.capitalSocial,
      pct: fmtPct(b.capitalSocial, totalCP),
    },
    {
      code: '55-58',
      label: 'Reservas legais, de reavaliação e reservas livres',
      note: 'Nota 13',
      amount: b.reservas,
      pct: fmtPct(b.reservas, totalCP),
    },
    {
      code: '59',
      label: 'Resultados transitados de exercícios anteriores',
      note: 'Nota 14',
      amount: b.resultadosTransitados,
      pct: fmtPct(b.resultadosTransitados, totalCP),
    },
    {
      code: '88',
      label: 'Resultado líquido do exercício',
      note: 'Nota 36',
      amount: b.resultadoPeriodo,
      pct: fmtPct(b.resultadoPeriodo, totalCP),
    },
    {
      code: 'CP',
      label: 'SUBTOTAL DO CAPITAL PRÓPRIO',
      note: '',
      amount: b.totalCapitalProprio,
      pct: fmtPct(b.totalCapitalProprio, totalCP),
      isSubtotal: true,
    },
    { code: 'Classe 3', label: 'PASSIVO (CORRENTE E NÃO CORRENTE)', note: '', amount: 0, pct: '', isSection: true },
    ...(b.emprestimos && b.emprestimos > 0
      ? [
          {
            code: '33',
            label: 'Empréstimos e financiamentos obtidos',
            note: 'Nota 15',
            amount: b.emprestimos,
            pct: fmtPct(b.emprestimos, totalCP),
          },
        ]
      : []),
    {
      code: '32',
      label: 'Contas a pagar — Fornecedores correntes (nacionais e estrangeiros)',
      note: 'Nota 20',
      amount: b.fornecedores,
      pct: fmtPct(b.fornecedores, totalCP),
    },
    {
      code: '34',
      label: 'Estado e outros entes públicos — Credor (IVA, IRT, INSS, Retenções II)',
      note: 'Nota 20',
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

const buildIncomeStatementRows = (d: IncomeStatementExportData): StatementRow[] => {
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

/**
 * 1. EXPORTAÇÃO CSV CORPORATIVO (UTF-8 com BOM, compatível com Excel PT/AO)
 */
export const exportFinancialStatementCsv = (
  target: StatementExportTarget,
  meta: CorporateEntityMeta,
  balanco: BalanceSheetExportData,
  dre: IncomeStatementExportData
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

  if (target === 'balance_sheet' || target === 'both') {
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

  if (target === 'income_statement' || target === 'both') {
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

  lines.push(
    'TERMO DE RESPONSABILIDADE E ASSINATURAS OFICIAIS;;;;',
    'A Administração / Gerência:;_______________________________;O Contabilista Certificado (OCPCA):;_______________________________'
  );

  const filename =
    target === 'balance_sheet'
      ? `Balanco_Patrimonial_PGC_${meta.fiscalYear}.csv`
      : target === 'income_statement'
      ? `Demonstracao_Resultados_PGC_${meta.fiscalYear}.csv`
      : `Relatorio_Contas_Balanco_DR_PGC_${meta.fiscalYear}.csv`;

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
  dre: IncomeStatementExportData
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
            <td style="text-align:center; color:#475569; font-family:Consolas, monospace; padding:5px 8px; border:1px solid #e2e8f0;">${r.code}</td>
            <td style="color:#1e293b; padding:5px 8px; border:1px solid #e2e8f0;">${r.label}</td>
            <td style="text-align:center; color:#64748b; padding:5px 8px; border:1px solid #e2e8f0;">${r.note}</td>
            <td style="text-align:right; color:${r.isNegative || r.amount < 0 ? '#dc2626' : '#0f172a'}; font-family:Consolas, monospace; padding:5px 8px; border:1px solid #e2e8f0;">${fmtKz(r.amount)}</td>
            <td style="text-align:right; color:#64748b; font-family:Consolas, monospace; padding:5px 8px; border:1px solid #e2e8f0;">${r.pct}</td>
          </tr>`;
      })
      .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Demonstracoes_PGC_${meta.fiscalYear}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
    </head>
    <body style="font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #0f172a;">
      <table border="0" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
        <tr>
          <td colspan="5" style="background-color:#0f172a; color:#ffffff; font-size:14pt; font-weight:bold; padding:12px 14px;">
            ${meta.companyName.toUpperCase()} — DEMONSTRAÇÕES FINANCEIRAS CORPORATIVAS
          </td>
        </tr>
        <tr>
          <td colspan="5" style="background-color:#1e293b; color:#cbd5e1; font-size:9.5pt; padding:6px 14px;">
            Plano Geral de Contabilidade de Angola (Decreto n.º 82/01 de 16 de Novembro) · Ordem dos Contabilistas e Peritos Contabilistas de Angola (OCPCA)
          </td>
        </tr>
        <tr>
          <td colspan="2" style="background-color:#f8fafc; padding:6px 10px; border:1px solid #cbd5e1;">
            <b>Entidade:</b> ${meta.companyName} &nbsp;|&nbsp; <b>NIF:</b> ${meta.nif}
          </td>
          <td colspan="2" style="background-color:#f8fafc; padding:6px 10px; border:1px solid #cbd5e1;">
            <b>Exercício Económico:</b> ${meta.fiscalYear} (01/01/${meta.fiscalYear} a 31/12/${meta.fiscalYear})
          </td>
          <td style="background-color:#f8fafc; padding:6px 10px; border:1px solid #cbd5e1; text-align:right;">
            <b>Moeda:</b> Kwanzas (AOA)
          </td>
        </tr>
        <tr><td colspan="5" style="height:12px;"></td></tr>

        ${
          target === 'balance_sheet' || target === 'both'
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
          target === 'income_statement' || target === 'both'
            ? `
        <tr>
          <td colspan="5" style="background-color:#065f46; color:#ffffff; font-size:11pt; font-weight:bold; padding:8px 12px;">
            ${target === 'both' ? 'II. ' : ''}DEMONSTRAÇÃO DE RESULTADOS POR NATUREZA — EXERCÍCIO DE ${meta.fiscalYear} (Decreto n.º 82/01)
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
      : `Relatorio_Contas_Balanco_DR_PGC_${meta.fiscalYear}.xls`;

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
  dre: IncomeStatementExportData
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
              <td class="center mono">${r.code}</td>
              <td>${r.label}</td>
              <td class="center">${r.note}</td>
              <td class="right mono">${fmtKz(r.amount)}</td>
              <td class="right mono">${r.pct}</td>
            </tr>`;
        }
        if (r.isSubtotal) {
          return `
            <tr class="subtotal-row">
              <td class="center mono">${r.code}</td>
              <td>${r.label}</td>
              <td class="center">${r.note}</td>
              <td class="right mono ${r.amount < 0 ? 'neg' : ''}">${fmtKz(r.amount)}</td>
              <td class="right mono">${r.pct}</td>
            </tr>`;
        }
        return `
          <tr>
            <td class="center mono muted">${r.code}</td>
            <td>${r.label}</td>
            <td class="center muted">${r.note}</td>
            <td class="right mono ${r.isNegative || r.amount < 0 ? 'neg' : ''}">${fmtKz(r.amount)}</td>
            <td class="right mono muted">${r.pct}</td>
          </tr>`;
      })
      .join('');

  const docTitle =
    target === 'balance_sheet'
      ? `Balanço Patrimonial PGC - ${meta.companyName} (${meta.fiscalYear})`
      : target === 'income_statement'
      ? `Demonstração de Resultados PGC - ${meta.companyName} (${meta.fiscalYear})`
      : `Balanço e Demonstração de Resultados PGC - ${meta.companyName} (${meta.fiscalYear})`;

  const html = `
    <!DOCTYPE html>
    <html lang="pt-AO">
    <head>
      <meta charset="UTF-8" />
      <title>${docTitle}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 12mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #f1f5f9;
          margin: 0;
          padding: 20px;
          font-size: 11px;
          line-height: 1.4;
        }
        .toolbar {
          max-width: 210mm;
          margin: 0 auto 14px auto;
          background: #0f172a;
          color: #fff;
          padding: 10px 16px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        }
        .toolbar-actions {
          display: flex;
          gap: 8px;
        }
        .btn {
          border: none;
          padding: 7px 14px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-primary {
          background: #2563eb;
          color: #fff;
        }
        .btn-secondary {
          background: #334155;
          color: #e2e8f0;
        }
        .page {
          max-width: 210mm;
          margin: 0 auto;
          background: #ffffff;
          padding: 16mm 14mm;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        .corp-header {
          border-bottom: 3px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 14px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .brand-title {
          font-size: 17px;
          font-weight: 900;
          letter-spacing: -0.3px;
          color: #0f172a;
          text-transform: uppercase;
        }
        .brand-sub {
          font-size: 10px;
          color: #475569;
          margin-top: 2px;
          font-weight: 600;
        }
        .meta-box {
          text-align: right;
          font-size: 10px;
          color: #334155;
        }
        .meta-box strong {
          color: #0f172a;
        }
        .entity-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 16px;
          font-size: 10px;
        }
        .entity-strip div span {
          display: block;
          font-size: 8.5px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
        }
        .entity-strip div strong {
          font-size: 10.5px;
          color: #0f172a;
        }
        .statement-block {
          margin-bottom: 20px;
        }
        .statement-title {
          background: #0f172a;
          color: #ffffff;
          padding: 7px 12px;
          font-size: 11.5px;
          font-weight: 800;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-radius: 4px 4px 0 0;
        }
        .statement-title.dre {
          background: #065f46;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        th {
          background: #1e293b;
          color: #ffffff;
          padding: 6px 8px;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 9px;
          border: 1px solid #1e293b;
        }
        td {
          padding: 5px 8px;
          border: 1px solid #e2e8f0;
          color: #1e293b;
        }
        .section-row td {
          background: #e2e8f0;
          color: #0f172a;
          font-weight: 800;
          font-size: 9.5px;
          text-transform: uppercase;
          padding: 5px 8px;
          border-color: #cbd5e1;
        }
        .code-badge {
          background: #cbd5e1;
          color: #0f172a;
          padding: 1px 5px;
          border-radius: 3px;
          font-family: Consolas, monospace;
          font-size: 8.5px;
        }
        .subtotal-row td {
          background: #f1f5f9;
          font-weight: 800;
          color: #0f172a;
          border-top: 1.5px solid #94a3b8;
          border-bottom: 1.5px solid #94a3b8;
        }
        .total-row td {
          background: #0f172a;
          color: #ffffff !important;
          font-weight: 900;
          font-size: 10.5px;
          padding: 7px 8px;
          border-color: #0f172a;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .mono { font-family: 'JetBrains Mono', Consolas, monospace; }
        .muted { color: #64748b; }
        .neg { color: #dc2626 !important; }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-top: 10px;
        }
        .kpi-card {
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          border-radius: 5px;
          padding: 7px 10px;
        }
        .kpi-card span {
          display: block;
          font-size: 8.5px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 700;
        }
        .kpi-card strong {
          font-size: 11px;
          font-family: Consolas, monospace;
          color: #0f172a;
        }
        .kpi-card small {
          display: block;
          font-size: 9px;
          color: #059669;
          font-weight: 700;
        }
        .balance-check {
          margin-top: 6px;
          padding: 6px 10px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 9.5px;
          display: flex;
          justify-content: space-between;
          background: ${balanco.isBalanced ? '#ecfdf5' : '#fffbeb'};
          color: ${balanco.isBalanced ? '#065f46' : '#92400e'};
          border: 1px solid ${balanco.isBalanced ? '#a7f3d0' : '#fde68a'};
        }
        .signatures {
          margin-top: 28px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          page-break-inside: avoid;
        }
        .sig-box {
          text-align: center;
          padding-top: 26px;
          border-top: 1.5px solid #334155;
          font-size: 10px;
        }
        .sig-box strong {
          display: block;
          color: #0f172a;
          text-transform: uppercase;
        }
        .sig-box span {
          font-size: 9px;
          color: #64748b;
        }
        .doc-footer {
          margin-top: 18px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 8.5px;
          color: #64748b;
        }
        .page-break {
          page-break-before: always;
          margin-top: 24px;
        }
        @media print {
          body {
            background: #ffffff;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          .page {
            box-shadow: none;
            padding: 0;
            max-width: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="toolbar no-print">
        <div>
          <strong>Pré-visualização Oficial de Impressão / Exportação PDF (A4)</strong>
          <div style="font-size:10px; color:#94a3b8;">Selecione "Guardar como PDF" na janela de impressão para gerar o ficheiro PDF corporativo.</div>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn-primary" onclick="window.print()">Guardar como PDF / Imprimir</button>
          <button class="btn btn-secondary" onclick="window.close()">Fechar</button>
        </div>
      </div>

      <div class="page">
        <div class="corp-header">
          <div>
            <div class="brand-title">${meta.companyName}</div>
            <div class="brand-sub">Demonstrações Financeiras Oficiais · Plano Geral de Contabilidade de Angola (Decreto n.º 82/01)</div>
          </div>
          <div class="meta-box">
            <div><strong>RELATÓRIO E CONTAS ANUAL</strong></div>
            <div>Exercício Fiscal: <strong>${meta.fiscalYear}</strong></div>
            <div>Emissão: ${nowStr}</div>
          </div>
        </div>

        <div class="entity-strip">
          <div>
            <span>Entidade / Firma</span>
            <strong>${meta.companyName}</strong>
          </div>
          <div>
            <span>NIF (AGT)</span>
            <strong class="mono">${meta.nif}</strong>
          </div>
          <div>
            <span>Período de Relato</span>
            <strong>01/01/${meta.fiscalYear} a 31/12/${meta.fiscalYear}</strong>
          </div>
          <div>
            <span>Unidade Monetária</span>
            <strong>Kwanzas (AOA)</strong>
          </div>
        </div>

        ${
          target === 'balance_sheet' || target === 'both'
            ? `
        <div class="statement-block">
          <div class="statement-title">
            <span>I. Balanço Patrimonial em 31 de Dezembro de ${meta.fiscalYear}</span>
            <span style="font-size:9.5px; font-weight:600; opacity:0.9;">Classes 1, 2, 3, 4, 5 e 8 do PGC</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:12%;">Código PGC</th>
                <th style="width:50%; text-align:left;">Rubricas / Designação</th>
                <th style="width:10%;">Nota</th>
                <th style="width:18%; text-align:right;">Exercício ${meta.fiscalYear} (Kz)</th>
                <th style="width:10%; text-align:right;">Peso (%)</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(buildBalanceSheetRows(balanco))}
            </tbody>
          </table>
          <div class="balance-check">
            <span>${
              balanco.isBalanced
                ? 'Equação Fundamental do Balanço Verificada: Activo = Capital Próprio + Passivo'
                : 'Ajuste Transitório de Fecho (Diferença pendente de apuramento final)'
            }</span>
            <span class="mono">Δ = ${fmtKz(balanco.balancoDiff)}</span>
          </div>
        </div>
        `
            : ''
        }

        ${
          target === 'income_statement' || target === 'both'
            ? `
        <div class="statement-block ${target === 'both' ? 'page-break' : ''}">
          <div class="statement-title dre">
            <span>${target === 'both' ? 'II. ' : ''}Demonstração de Resultados por Natureza — Exercício de ${meta.fiscalYear}</span>
            <span style="font-size:9.5px; font-weight:600; opacity:0.9;">Classes 6, 7 e 8 do PGC</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:12%;">Conta PGC</th>
                <th style="width:50%; text-align:left;">Rubricas por Natureza</th>
                <th style="width:10%;">Nota</th>
                <th style="width:18%; text-align:right;">Exercício ${meta.fiscalYear} (Kz)</th>
                <th style="width:10%; text-align:right;">% VN</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(buildIncomeStatementRows(dre))}
            </tbody>
          </table>

          <div class="kpi-grid">
            <div class="kpi-card">
              <span>Volume de Negócios (61+62)</span>
              <strong>${fmtKz(dre.vendas + dre.servicos)}</strong>
              <small>Base 100,00%</small>
            </div>
            <div class="kpi-card">
              <span>Margem Bruta</span>
              <strong>${fmtKz(dre.margemBruta)}</strong>
              <small>${fmtPct(dre.margemBruta, vn)} s/ VN</small>
            </div>
            <div class="kpi-card">
              <span>EBITDA Operacional</span>
              <strong>${fmtKz(ebitda)}</strong>
              <small>${fmtPct(ebitda, vn)} s/ VN</small>
            </div>
            <div class="kpi-card">
              <span>Margem Líquida (Conta 88)</span>
              <strong>${fmtKz(dre.resultadoLiquido)}</strong>
              <small>${fmtPct(dre.resultadoLiquido, vn)} s/ VN</small>
            </div>
          </div>
        </div>
        `
            : ''
        }

        <div class="signatures">
          <div class="sig-box">
            <strong>A Administração / Gerência</strong>
            <span>Assinatura e Carimbo Oficial da Sociedade</span>
          </div>
          <div class="sig-box">
            <strong>O Contabilista / Perito Contabilista</strong>
            <span>Inscrito na OCPCA sob o n.º _______________</span>
          </div>
        </div>

        <div class="doc-footer">
          <span>Elaborado em conformidade com o Decreto n.º 82/01 (PGC Angola) e Decreto Executivo n.º 385/20 (SAF-T AO)</span>
          <span>Kudiba ERP · Pág. 1</span>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};
