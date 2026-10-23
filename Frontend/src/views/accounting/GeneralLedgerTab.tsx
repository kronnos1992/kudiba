import React from 'react';
import { Search, FileSpreadsheet, FileText } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import type { AccountResponse, JournalEntryResponse } from '../../api/accounting';

export interface LedgerEntryItem {
  id: string;
  date: string;
  entry_number: number;
  journal: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  rawEntry: JournalEntryResponse;
}

export interface SelectedLedgerAccountSummary {
  code: string;
  name: string;
  nature: string;
  is_analytical: boolean;
  period_debit: number;
  period_credit: number;
  closing_debit: number;
  closing_credit: number;
}

interface GeneralLedgerTabProps {
  chart: AccountResponse[];
  selectedLedgerAccountCode: string;
  onSelectLedgerAccountCode: (code: string) => void;
  ledgerSearch: string;
  onLedgerSearchChange: (search: string) => void;
  selectedLedgerAccount: SelectedLedgerAccountSummary;
  ledgerEntries: LedgerEntryItem[];
  onExportLedgerCsv: () => void;
  onSelectEntry: (entry: JournalEntryResponse) => void;
}

export const GeneralLedgerTab: React.FC<GeneralLedgerTabProps> = ({
  chart,
  selectedLedgerAccountCode,
  onSelectLedgerAccountCode,
  ledgerSearch,
  onLedgerSearchChange,
  selectedLedgerAccount,
  ledgerEntries,
  onExportLedgerCsv,
  onSelectEntry,
}) => {
  return (
    <div className="space-y-4">
      <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="w-full sm:w-80">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Selecionar Conta:
            </label>
            <select
              value={selectedLedgerAccountCode}
              onChange={(e) => onSelectLedgerAccountCode(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {chart.map((a) => (
                <option key={a.id} value={a.account_code}>
                  {a.account_code} - {a.account_name} ({a.is_analytical ? 'Analítica' : 'Sintética'})
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 sm:max-w-xs mt-auto">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar neste extrato..."
              value={ledgerSearch}
              onChange={(e) => onLedgerSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportLedgerCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
            title="Exportar extrato da conta em CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Exportar Extrato (CSV)
          </button>
        </div>
      </GlassCard>

      {/* Account Header Summary Card */}
      <GlassCard className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-900 border-blue-200 dark:border-slate-800">
        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase">Conta Analítica</span>
          <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
            {selectedLedgerAccount.code}
          </div>
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
            {selectedLedgerAccount.name}
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase">Natureza / Tipo</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedLedgerAccount.nature === 'DEBIT'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
              }`}
            >
              {selectedLedgerAccount.nature === 'DEBIT' ? 'DEVEDORA' : 'CREDORA'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {selectedLedgerAccount.is_analytical ? 'Analítica' : 'Sintética'}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase">Débito do Período</span>
          <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
            <KzAmount value={selectedLedgerAccount.period_debit} />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase">Crédito do Período</span>
          <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            <KzAmount value={selectedLedgerAccount.period_credit} />
          </div>
        </div>

        <div>
          <span className="text-[11px] font-bold text-slate-500 uppercase">Saldo Final da Conta</span>
          <div className="text-sm font-mono font-black mt-1">
            {selectedLedgerAccount.closing_debit > 0 ? (
              <span className="text-emerald-700 dark:text-emerald-400">
                <KzAmount value={selectedLedgerAccount.closing_debit} /> (Devedor)
              </span>
            ) : selectedLedgerAccount.closing_credit > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">
                <KzAmount value={selectedLedgerAccount.closing_credit} /> (Credor)
              </span>
            ) : (
              <span className="text-slate-500">0,00 Kz (Saldo Nulo)</span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Table of Ledger Entries */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                <th className="p-3 w-28">Data</th>
                <th className="p-3 w-20">Lanç.</th>
                <th className="p-3 w-32">Diário</th>
                <th className="p-3">Histórico / Descrição</th>
                <th className="p-3 text-right text-blue-700 dark:text-blue-400 w-36">
                  Débito (Kz)
                </th>
                <th className="p-3 text-right text-indigo-700 dark:text-indigo-400 w-36">
                  Crédito (Kz)
                </th>
                <th className="p-3 text-right text-slate-900 dark:text-white font-extrabold w-44">
                  Saldo Progressivo
                </th>
                <th className="p-3 text-center w-16">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
              {ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                    Nenhum movimento contabilístico registado para a conta{' '}
                    <span className="font-bold">{selectedLedgerAccount.code}</span> no período selecionado.
                  </td>
                </tr>
              ) : (
                ledgerEntries.map((l) => (
                  <tr
                    key={l.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="p-3 text-slate-600 dark:text-slate-300 font-sans">
                      {l.date}
                    </td>
                    <td className="p-3 font-bold text-blue-600 dark:text-blue-400">
                      #{l.entry_number}
                    </td>
                    <td className="p-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {l.journal}
                      </span>
                    </td>
                    <td className="p-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                      {l.description}
                    </td>
                    <td className="p-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {l.debit > 0 ? <KzAmount value={l.debit} /> : '-'}
                    </td>
                    <td className="p-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                      {l.credit > 0 ? <KzAmount value={l.credit} /> : '-'}
                    </td>
                    <td className="p-3 text-right font-bold">
                      <span
                        className={
                          l.runningBalance >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }
                      >
                        <KzAmount value={Math.abs(l.runningBalance)} />{' '}
                        <span className="text-[10px] font-normal">
                          ({l.runningBalance >= 0 ? 'D' : 'C'})
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => onSelectEntry(l.rawEntry)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600"
                        title="Ver lançamento em partidas dobradas"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
