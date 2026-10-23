import React from 'react';
import { History, Loader2, Printer } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { SortableHeader } from '../../components/common/SortableHeader';
import type { StockMovement } from '../../api/inventory';

interface MovementsTabProps {
  sortedMovements: StockMovement[];
  movementsLoading: boolean;
  movementsSort?: { key: string; direction: 'asc' | 'desc' } | null;
  requestMovementsSort: (field: string) => void;
  printingDocRef: string | null;
  onPrintTransferGuide: (movement: StockMovement) => void;
}

export const MovementsTab: React.FC<MovementsTabProps> = ({
  sortedMovements,
  movementsLoading,
  movementsSort,
  requestMovementsSort,
  printingDocRef,
  onPrintTransferGuide,
}) => {
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                Histórico Auditável de Movimentos de Stock
              </h3>
              <span className="text-xs text-slate-400">Últimos movimentos registados</span>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <SortableHeader field="created_at" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      Data / Hora
                    </SortableHeader>
                    <SortableHeader field="movement_type" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      Tipo Movimento
                    </SortableHeader>
                    <SortableHeader field="document_ref" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      Doc Ref
                    </SortableHeader>
                    <SortableHeader field="quantity" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} align="right" className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      Quantidade
                    </SortableHeader>
                    <SortableHeader field="unit_cost" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} align="right" className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      Custo Unitário
                    </SortableHeader>
                    <SortableHeader field="total_cost" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} align="right" className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      Custo Total
                    </SortableHeader>
                    <SortableHeader field="resulting_cmp" currentSortField={movementsSort?.key} sortDirection={movementsSort?.direction} onSort={requestMovementsSort} align="right" className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                      CMP Resultante
                    </SortableHeader>
                    <th className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-4 py-3">Observações</th>
                    <th className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-4 py-3 text-center">Guia / Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movementsLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        A carregar histórico de movimentos...
                      </td>
                    </tr>
                  ) : sortedMovements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Nenhum movimento registado. Utilize os botões acima para registar Entradas, Transferências ou Ajustes.
                      </td>
                    </tr>
                  ) : (
                    sortedMovements.map((m) => {
                      const qty = Number(m.quantity) || 0;
                      const unitCost = Number(m.unit_cost) || 0;
                      const totalCost = Number(m.total_cost) || 0;
                      const resultingCmp = Number(m.resulting_cmp) || 0;
                      const isEntry = m.movement_type.includes('In') || m.movement_type.includes('Purchase');

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                            {new Date(m.created_at).toLocaleString('pt-AO')}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                isEntry
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {m.movement_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white font-mono text-xs">
                            {m.document_ref || '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                            {qty}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                            <KzAmount value={unitCost} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                            <KzAmount value={totalCost} />
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 font-bold">
                            <KzAmount value={resultingCmp} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-xs">
                            {m.notes || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {m.document_ref || m.movement_type.includes('Transfer') ? (
                              <button
                                type="button"
                                onClick={() => onPrintTransferGuide(m)}
                                disabled={printingDocRef === m.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition shadow-xs disabled:opacity-50"
                                title="Imprimir Guia Oficial de Transporte (GT)"
                              >
                                {printingDocRef === m.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                                ) : (
                                  <Printer className="w-3.5 h-3.5" />
                                )}
                                <span>{m.document_ref?.startsWith('GT') ? 'Guia GT' : 'Imprimir Guia'}</span>
                              </button>
                            ) : (
                              <span className="text-2xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
};
