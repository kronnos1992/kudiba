import React, { useMemo, useState } from 'react';
import { Search, FileSpreadsheet, BookOpen, Percent, Printer, Download } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useAuthStore } from '../../stores/authStore';
import {
  buildCompanyReportMeta,
  CorporateReportDocument,
  exportCorporateReportCsv,
  exportCorporateReportExcel,
  exportCorporateReportPdf,
  fmtPctReport,
  fmtReportKz,
} from '../../utils/corporateReportExporter';

export interface TrialBalanceRowView {
  account_code: string;
  account_name: string;
  is_analytical?: boolean;
  opening_debit?: string | number;
  opening_credit?: string | number;
  period_debit?: string | number;
  period_credit?: string | number;
  closing_debit?: string | number;
  closing_credit?: string | number;
}

export interface TrialBalanceTotals {
  total_opening_debit?: string | number;
  total_opening_credit?: string | number;
  total_period_debit?: string | number;
  total_period_credit?: string | number;
  total_closing_debit?: string | number;
  total_closing_credit?: string | number;
}

interface PgcClassOption {
  id: string;
  name: string;
  prefix: string;
}

interface TrialBalanceTabProps {
  pgcClasses: PgcClassOption[];
  trialBalanceSearch: string;
  onTrialBalanceSearchChange: (value: string) => void;
  trialBalanceFilterClass: string;
  onTrialBalanceFilterClassChange: (value: string) => void;
  onlyMovedAccounts: boolean;
  onOnlyMovedAccountsChange: (value: boolean) => void;
  trialBalanceColumns: 4 | 6;
  onTrialBalanceColumnsChange: (value: 4 | 6) => void;
  onExportCsv: () => void;
  isLoading: boolean;
  sortedRows: TrialBalanceRowView[];
  trialBalanceSortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  requestTrialBalanceSort: (field: string) => void;
  trialBalance: TrialBalanceTotals | undefined;
  onOpenLedger: (accountCode: string) => void;
  showVerticalAnalysis?: boolean;
  onShowVerticalAnalysisChange?: (value: boolean) => void;
  verticalAnalysisBase?: 'class' | 'global';
  onVerticalAnalysisBaseChange?: (value: 'class' | 'global') => void;
}

export const TrialBalanceTab: React.FC<TrialBalanceTabProps> = ({
  pgcClasses,
  trialBalanceSearch,
  onTrialBalanceSearchChange,
  trialBalanceFilterClass,
  onTrialBalanceFilterClassChange,
  onlyMovedAccounts,
  onOnlyMovedAccountsChange,
  trialBalanceColumns,
  onTrialBalanceColumnsChange,
  onExportCsv: _onExportCsv,
  isLoading,
  sortedRows,
  trialBalanceSortConfig,
  requestTrialBalanceSort,
  trialBalance,
  onOpenLedger,
  showVerticalAnalysis,
  onShowVerticalAnalysisChange,
  verticalAnalysisBase,
  onVerticalAnalysisBaseChange,
}) => {
  const { activeTenant, activeBranch } = useAuthStore();
  const [internalShowAV, setInternalShowAV] = useState(false);
  const [internalBaseAV, setInternalBaseAV] = useState<'class' | 'global'>('class');

  const showAV = showVerticalAnalysis ?? internalShowAV;
  const setShowAV = onShowVerticalAnalysisChange ?? setInternalShowAV;
  const baseAV = verticalAnalysisBase ?? internalBaseAV;
  const setBaseAV = onVerticalAnalysisBaseChange ?? setInternalBaseAV;

  // Totais por Classe PGC e Total Global para cálculo da Análise Vertical (AV %)
  const { classTotals, globalTotal } = useMemo(() => {
    const analyticalRows = sortedRows.filter((r) => r.is_analytical);
    const rowsToUse = analyticalRows.length > 0 ? analyticalRows : sortedRows;
    const totals: Record<string, number> = {};
    let gTotal = 0;

    for (const r of rowsToUse) {
      const prefix = r.account_code.charAt(0);
      const deb = parseFloat(String(r.closing_debit || 0));
      const cred = parseFloat(String(r.closing_credit || 0));
      const bal = Math.max(deb, cred);
      totals[prefix] = (totals[prefix] || 0) + bal;
      gTotal += bal;
    }
    return { classTotals: totals, globalTotal: gTotal };
  }, [sortedRows]);

  const buildTrialBalanceReportDocument = (): CorporateReportDocument => {
    const totOpenDeb = parseFloat(String(trialBalance?.total_opening_debit || 0));
    const totOpenCred = parseFloat(String(trialBalance?.total_opening_credit || 0));
    const totPerDeb = parseFloat(String(trialBalance?.total_period_debit || 0));
    const totPerCred = parseFloat(String(trialBalance?.total_period_credit || 0));
    const totCloseDeb = parseFloat(String(trialBalance?.total_closing_debit || 0));
    const totCloseCred = parseFloat(String(trialBalance?.total_closing_credit || 0));
    const isBalanced = Math.abs(totCloseDeb - totCloseCred) < 0.01;

    const classBreakdown = pgcClasses
      .filter((c) => c.prefix)
      .map((c) => {
        const classRows = sortedRows.filter(
          (r) => r.account_code.startsWith(c.prefix) && (r.is_analytical ?? true)
        );
        const rowsForSum =
          classRows.length > 0
            ? classRows
            : sortedRows.filter((r) => r.account_code.startsWith(c.prefix));
        const pDeb = rowsForSum.reduce((s, r) => s + parseFloat(String(r.period_debit || 0)), 0);
        const pCred = rowsForSum.reduce((s, r) => s + parseFloat(String(r.period_credit || 0)), 0);
        const cDeb = rowsForSum.reduce((s, r) => s + parseFloat(String(r.closing_debit || 0)), 0);
        const cCred = rowsForSum.reduce((s, r) => s + parseFloat(String(r.closing_credit || 0)), 0);
        return {
          code: `Classe ${c.prefix}`,
          name: c.name,
          count: rowsForSum.length,
          pDeb,
          pCred,
          cDeb,
          cCred,
          weight: fmtPctReport(Math.max(cDeb, cCred), globalTotal || 1),
        };
      })
      .filter((cb) => cb.count > 0 || cb.pDeb > 0 || cb.pCred > 0 || cb.cDeb > 0 || cb.cCred > 0);

    return {
      title: `Balancete Geral de Verificação do Razão (${trialBalanceColumns} Colunas — PGC Angola)`,
      subtitle:
        'Controlo das Partidas Dobradas, Movimentos Acumulados, Saldos Devedores/Credores e Análise Vertical por Conta PGC',
      filenameBase: `Balancete_Verificacao_PGC_${trialBalanceColumns}Col_${new Date().toISOString().split('T')[0]}`,
      orientation: trialBalanceColumns === 6 ? 'landscape' : 'portrait',
      meta: buildCompanyReportMeta(
        activeTenant,
        activeBranch,
        `Posição em ${new Date().toLocaleDateString('pt-AO')}`,
        'Plano Geral de Contabilidade de Angola (Decreto n.º 82/01)'
      ),
      kpis: [
        {
          label: 'Total Movimentos a Débito',
          value: fmtReportKz(totPerDeb),
          sublabel: `${sortedRows.length} contas apresentadas no mapa`,
          tone: 'blue',
        },
        {
          label: 'Total Movimentos a Crédito',
          value: fmtReportKz(totPerCred),
          sublabel: 'Acumulado de lançamentos do período',
          tone: 'blue',
        },
        {
          label: 'Saldos Finais Devedores / Credores',
          value: fmtReportKz(totCloseDeb),
          sublabel: `Crédito Final: ${fmtReportKz(totCloseCred)}`,
          tone: 'emerald',
        },
        {
          label: 'Equilíbrio de Partidas Dobradas',
          value: isBalanced ? 'EQUILIBRADO (Δ 0,00 Kz)' : fmtReportKz(Math.abs(totCloseDeb - totCloseCred)),
          sublabel: isBalanced
            ? 'Conformidade integral Débito = Crédito'
            : 'Diferença transitória em apuramento',
          tone: isBalanced ? 'emerald' : 'amber',
        },
      ],
      summaryNotes: [
        `Enquadramento Técnico: Balancete emitido no modelo de ${trialBalanceColumns} colunas nos termos do Decreto n.º 82/01 (Plano Geral de Contabilidade de Angola).`,
        `Integridade Contabilística: Soma dos movimentos do período a Débito (${fmtReportKz(totPerDeb)}) e a Crédito (${fmtReportKz(totPerCred)}), com saldos finais ${isBalanced ? 'rigorosamente equilibrados' : 'em revisão'}.`,
        `Análise Vertical (AV %): Calculada com base ${baseAV === 'class' ? 'no peso de cada rubrica dentro da respetiva Classe PGC' : 'no volume global de saldos do Balancete'}.`,
      ],
      sections: [
        ...(classBreakdown.length > 0
          ? [
              {
                title: 'I. SínteseAgregada por Classes do Plano Geral de Contabilidade (Classes 1 a 8)',
                subtitle: 'Visão Executiva das Massas Patrimoniais e de Exploração',
                theme: 'blue' as const,
                columns: [
                  { header: 'Classe', width: '12%', align: 'center' as const, mono: true },
                  { header: 'Designação da Classe PGC', width: '30%', align: 'left' as const },
                  { header: 'N.º Contas', width: '10%', align: 'center' as const, mono: true },
                  { header: 'Mov. Débito (Kz)', width: '13%', align: 'right' as const, isCurrency: true, mono: true },
                  { header: 'Mov. Crédito (Kz)', width: '13%', align: 'right' as const, isCurrency: true, mono: true },
                  { header: 'Saldo Devedor (Kz)', width: '11%', align: 'right' as const, isCurrency: true, mono: true },
                  { header: 'Saldo Credor (Kz)', width: '11%', align: 'right' as const, isCurrency: true, mono: true },
                ],
                rows: classBreakdown.map((cb) => ({
                  cells: [cb.code, cb.name, cb.count, cb.pDeb, cb.pCred, cb.cDeb, cb.cCred],
                })),
              },
            ]
          : []),
        {
          title: `${classBreakdown.length > 0 ? 'II' : 'I'}. Balancete Analítico e Sintético do Razão Geral (${trialBalanceColumns} Colunas)`,
          subtitle: `Filtro de Classe: ${trialBalanceFilterClass === 'all' ? 'Todas as Classes PGC' : trialBalanceFilterClass} | Contas Listadas: ${sortedRows.length}`,
          theme: 'slate',
          columns:
            trialBalanceColumns === 6
              ? [
                  { header: 'Conta PGC', width: '9%', align: 'left', mono: true },
                  { header: 'Designação da Conta', width: '23%', align: 'left' },
                  { header: 'Natureza', width: '8%', align: 'center' },
                  { header: 'Abert. Débito', width: '10%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Abert. Crédito', width: '10%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Mov. Débito', width: '10%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Mov. Crédito', width: '10%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Saldo Devedor', width: '10%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Saldo Credor', width: '10%', align: 'right', isCurrency: true, mono: true },
                ]
              : [
                  { header: 'Conta PGC', width: '11%', align: 'left', mono: true },
                  { header: 'Designação da Conta', width: '31%', align: 'left' },
                  { header: 'Grau', width: '8%', align: 'center' },
                  { header: 'Movimento Débito', width: '11%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Movimento Crédito', width: '11%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Saldo Devedor', width: '11%', align: 'right', isCurrency: true, mono: true },
                  { header: 'Saldo Credor', width: '11%', align: 'right', isCurrency: true, mono: true },
                  { header: 'AV (%)', width: '6%', align: 'right', mono: true },
                ],
          rows: [
            ...sortedRows.map((r) => {
              const prefix = r.account_code.charAt(0);
              const deb = parseFloat(String(r.closing_debit || 0));
              const cred = parseFloat(String(r.closing_credit || 0));
              const bal = Math.max(deb, cred);
              const base = baseAV === 'class' ? classTotals[prefix] || 1 : globalTotal || 1;
              const avStr = fmtPctReport(bal, base);
              const tipoStr = r.is_analytical ? 'Analítica' : 'Sintética';

              return {
                cells:
                  trialBalanceColumns === 6
                    ? [
                        r.account_code,
                        r.account_name,
                        tipoStr,
                        parseFloat(String(r.opening_debit || 0)),
                        parseFloat(String(r.opening_credit || 0)),
                        parseFloat(String(r.period_debit || 0)),
                        parseFloat(String(r.period_credit || 0)),
                        deb,
                        cred,
                      ]
                    : [
                        r.account_code,
                        r.account_name,
                        tipoStr,
                        parseFloat(String(r.period_debit || 0)),
                        parseFloat(String(r.period_credit || 0)),
                        deb,
                        cred,
                        avStr,
                      ],
                isSubtotal: !r.is_analytical,
              };
            }),
            {
              cells:
                trialBalanceColumns === 6
                  ? [
                      'TOTAL',
                      'TOTAIS GERAIS DE CONTROLO DO BALANCETE',
                      '',
                      totOpenDeb,
                      totOpenCred,
                      totPerDeb,
                      totPerCred,
                      totCloseDeb,
                      totCloseCred,
                    ]
                  : [
                      'TOTAL',
                      'TOTAIS GERAIS DE CONTROLO DO BALANCETE',
                      '',
                      totPerDeb,
                      totPerCred,
                      totCloseDeb,
                      totCloseCred,
                      '100,00%',
                    ],
              isTotal: true,
            },
          ],
        },
      ],
    };
  };

  const totalColumnsCount = (trialBalanceColumns === 6 ? 9 : 7) + (showAV ? 1 : 0);
  return (
        <div className="space-y-4">
          {/* Controls Bar */}
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por código ou conta..."
                  value={trialBalanceSearch}
                  onChange={(e) => onTrialBalanceSearchChange(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={trialBalanceFilterClass}
                onChange={(e) => onTrialBalanceFilterClassChange(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pgcClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.prefix ? `(${c.prefix})` : ''}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMovedAccounts}
                  onChange={(e) => onOnlyMovedAccountsChange(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Apenas com movimento
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Toggle Análise Vertical (AV %) */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAV(!showAV)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition ${
                    showAV
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Ativar/Desativar Análise Vertical das Contas (Peso percentual nas massas patrimoniais)"
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>Análise Vertical</span>
                </button>

                {showAV && (
                  <select
                    value={baseAV}
                    onChange={(e) => setBaseAV(e.target.value as 'class' | 'global')}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    title="Defina a base da Análise Vertical: Na Classe PGC ou no Total do Balancete"
                  >
                    <option value="class">Base: Na Classe PGC</option>
                    <option value="global">Base: No Total Global</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Modelo:</span>
                <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => onTrialBalanceColumnsChange(4)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      trialBalanceColumns === 4
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    4 Colunas
                  </button>
                  <button
                    type="button"
                    onClick={() => onTrialBalanceColumnsChange(6)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                      trialBalanceColumns === 6
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    6 Colunas (Completo)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportCorporateReportPdf(buildTrialBalanceReportDocument())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-bold shadow-xs transition cursor-pointer"
                  title="Imprimir / Guardar PDF Oficial A4 do Balancete"
                >
                  <Printer className="w-3.5 h-3.5" />
                  PDF Oficial
                </button>
                <button
                  type="button"
                  onClick={() => exportCorporateReportExcel(buildTrialBalanceReportDocument())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  title="Exportar Balancete em Excel (.xls) formatado"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel (.xls)
                </button>
                <button
                  type="button"
                  onClick={() => exportCorporateReportCsv(buildTrialBalanceReportDocument())}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer"
                  title="Exportar balancete em CSV corporativo compatível com Excel"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Table */}
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="text-xs uppercase font-semibold">
                  <tr>
                    <SortableHeader
                      columnKey="account_code"
                      label="Código"
                      currentSort={trialBalanceSortConfig}
                      onSort={requestTrialBalanceSort}
                      className="p-3 w-28"
                    />
                    <SortableHeader
                      columnKey="account_name"
                      label="Designação da Conta"
                      currentSort={trialBalanceSortConfig}
                      onSort={requestTrialBalanceSort}
                      className="p-3"
                    />
                    {trialBalanceColumns === 6 && (
                      <>
                        <SortableHeader
                          columnKey="opening_debit"
                          label="S. Inicial Déb."
                          align="right"
                          currentSort={trialBalanceSortConfig}
                          onSort={requestTrialBalanceSort}
                          className="p-3"
                        />
                        <SortableHeader
                          columnKey="opening_credit"
                          label="S. Inicial Créd."
                          align="right"
                          currentSort={trialBalanceSortConfig}
                          onSort={requestTrialBalanceSort}
                          className="p-3"
                        />
                      </>
                    )}
                    <SortableHeader
                      columnKey="period_debit"
                      label="Mov. Débito"
                      align="right"
                      currentSort={trialBalanceSortConfig}
                      onSort={requestTrialBalanceSort}
                      className="p-3 text-blue-700 dark:text-blue-400"
                    />
                    <SortableHeader
                      columnKey="period_credit"
                      label="Mov. Crédito"
                      align="right"
                      currentSort={trialBalanceSortConfig}
                      onSort={requestTrialBalanceSort}
                      className="p-3 text-indigo-700 dark:text-indigo-400"
                    />
                    <SortableHeader
                      columnKey="closing_debit"
                      label="Saldo Devedor"
                      align="right"
                      currentSort={trialBalanceSortConfig}
                      onSort={requestTrialBalanceSort}
                      className="p-3 text-emerald-800 dark:text-emerald-300 font-extrabold"
                    />
                    <SortableHeader
                      columnKey="closing_credit"
                      label="Saldo Credor"
                      align="right"
                      currentSort={trialBalanceSortConfig}
                      onSort={requestTrialBalanceSort}
                      className="p-3 text-amber-800 dark:text-amber-300 font-extrabold"
                    />
                    {showAV && (
                      <th
                        className="p-3 text-right w-44 text-slate-700 dark:text-slate-300 font-extrabold sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10"
                        title={
                          baseAV === 'class'
                            ? 'Análise Vertical: Peso percentual da rubrica face ao total da sua Classe / Massa Patrimonial PGC'
                            : 'Análise Vertical: Peso percentual da rubrica face ao Total Geral do Balancete'
                        }
                      >
                        AV % ({baseAV === 'class' ? 'Massa PGC' : 'Global'})
                      </th>
                    )}
                    <th className="p-3 text-center w-20 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={totalColumnsCount}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        A carregar balancete de verificação...
                      </td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={totalColumnsCount}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        Nenhuma conta encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((r) => {
                      const isSynthetic = !r.is_analytical;
                      const prefix = r.account_code.charAt(0);
                      const deb = parseFloat(String(r.closing_debit || 0));
                      const cred = parseFloat(String(r.closing_credit || 0));
                      const bal = Math.max(deb, cred);
                      const base = baseAV === 'class' ? (classTotals[prefix] || 0) : globalTotal;
                      const avPct = base > 0 ? (bal / base) * 100 : 0;

                      return (
                        <tr
                          key={r.account_code}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                            isSynthetic
                              ? 'bg-slate-50/40 dark:bg-slate-800/20 font-bold text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <td className="p-2.5 font-bold">
                            <button
                              type="button"
                              onClick={() => onOpenLedger(r.account_code)}
                              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-mono"
                              title="Ver movimentos no Livro Razão"
                            >
                              {r.account_code}
                            </button>
                          </td>
                          <td className="p-2.5 font-sans font-medium">
                            <div className="flex items-center gap-2">
                              <span>{r.account_name}</span>
                              {!r.is_analytical && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  Mãe
                                </span>
                              )}
                            </div>
                          </td>
                          {trialBalanceColumns === 6 && (
                            <>
                              <td className="p-2.5 text-right text-slate-500">
                                {parseFloat(String(r.opening_debit)) > 0 ? (
                                  <KzAmount value={parseFloat(String(r.opening_debit))} />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="p-2.5 text-right text-slate-500">
                                {parseFloat(String(r.opening_credit)) > 0 ? (
                                  <KzAmount value={parseFloat(String(r.opening_credit))} />
                                ) : (
                                  '-'
                                )}
                              </td>
                            </>
                          )}
                          <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                            {parseFloat(String(r.period_debit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.period_debit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                            {parseFloat(String(r.period_credit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.period_credit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                            {parseFloat(String(r.closing_debit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.closing_debit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10">
                            {parseFloat(String(r.closing_credit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.closing_credit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          {showAV && (
                            <td className="p-2.5 text-right font-sans">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden shrink-0">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      avPct > 50
                                        ? 'bg-indigo-600 dark:bg-indigo-400'
                                        : avPct > 20
                                        ? 'bg-blue-600 dark:bg-blue-400'
                                        : 'bg-emerald-500 dark:bg-emerald-400'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, avPct))}%` }}
                                  />
                                </div>
                                <span
                                  className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 w-12 text-right"
                                  title={`Peso de ${avPct.toFixed(2)}% ${
                                    baseAV === 'class' ? `na Classe ${prefix}` : 'no Balancete Geral'
                                  }`}
                                >
                                  {avPct.toFixed(1)}%
                                </span>
                              </div>
                            </td>
                          )}
                          <td className="p-2.5 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => onOpenLedger(r.account_code)}
                              className="px-2 py-1 rounded-md text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition inline-flex items-center gap-1"
                              title="Consultar Livro Razão desta conta"
                            >
                              <BookOpen className="w-3 h-3" />
                              Razão
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 font-mono font-black text-xs text-slate-900 dark:text-white">
                    <td colSpan={2} className="p-3 font-sans uppercase">
                      Totais de Verificação (Balancete)
                    </td>
                    {trialBalanceColumns === 6 && (
                      <>
                        <td className="p-3 text-right">
                          <KzAmount
                            value={parseFloat(String(trialBalance?.total_opening_debit || 0))}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <KzAmount
                            value={parseFloat(String(trialBalance?.total_opening_credit || 0))}
                          />
                        </td>
                      </>
                    )}
                    <td className="p-3 text-right text-blue-600 dark:text-blue-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_period_debit || 0))}
                      />
                    </td>
                    <td className="p-3 text-right text-indigo-600 dark:text-indigo-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_period_credit || 0))}
                      />
                    </td>
                    <td className="p-3 text-right text-emerald-700 dark:text-emerald-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_closing_debit || 0))}
                      />
                    </td>
                    <td className="p-3 text-right text-amber-700 dark:text-amber-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_closing_credit || 0))}
                      />
                    </td>
                    {showAV && (
                      <td className="p-3 text-right text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        100.0%
                      </td>
                    )}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </GlassCard>
        </div>

  );
};
