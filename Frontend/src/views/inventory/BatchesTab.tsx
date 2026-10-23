import React from 'react';
import { PlusCircle } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import type { Product } from '../../api/inventory';

interface BatchesTabProps {
  products: Product[];
  onCreateBatch: () => void;
}

export const BatchesTab: React.FC<BatchesTabProps> = ({ products, onCreateBatch }) => {
  return (
        <div className="space-y-4">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Controlo de Lotes &amp; Validades (FIFO / FEFO)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Garantia de rastreabilidade de mercadorias perecíveis e controlo de validade para efeitos fiscais
                </p>
              </div>
              <button
                onClick={onCreateBatch}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Criar Novo Lote
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Artigo Associado</th>
                    <th className="px-4 py-3">Número do Lote</th>
                    <th className="px-4 py-3">Data Fabrico</th>
                    <th className="px-4 py-3">Data Validade</th>
                    <th className="px-4 py-3 text-center">Estado Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {products.filter((p) => p.track_lots).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        Nenhum artigo com controlo de lotes ativo configurado.
                      </td>
                    </tr>
                  ) : (
                    products
                      .filter((p) => p.track_lots)
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {p.name} ({p.code})
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-emerald-600">
                            LT-2026-001
                          </td>
                          <td className="px-4 py-3 text-slate-500">2026-01-10</td>
                          <td className="px-4 py-3 text-slate-500">2027-01-10</td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Válido (FEFO Conforme)
                            </span>
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
