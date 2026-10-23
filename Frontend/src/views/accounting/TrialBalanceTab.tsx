import React from 'react';
import { Search, FileSpreadsheet, BookOpen } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { SortableHeader } from '../../components/common/SortableHeader';

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
  onExportCsv,
  isLoading,
  sortedRows,
  trialBalanceSortConfig,
  requestTrialBalanceSort,
  trialBalance,
  onOpenLedger,
}) => {
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

              <button
                onClick={onExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                title="Exportar balancete em CSV compatível com Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar CSV
              </button>
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
                    <th className="p-3 text-center w-20 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={trialBalanceColumns === 6 ? 9 : 7}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        A carregar balancete de verificação...
                      </td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={trialBalanceColumns === 6 ? 9 : 7}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        Nenhuma conta encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((r) => {
                      const isSynthetic = !r.is_analytical;
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
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </GlassCard>
        </div>

  );
};
