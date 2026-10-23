import React from 'react';
import { Receipt, PlusCircle } from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';

export interface VatSettlementData {
  totalIvaLiquidado: number;
  ivaLiquidado14: number;
  ivaLiquidado5: number;
  totalIvaDedutivel: number;
  ivaSuportado: number;
  ivaDedutivel: number;
  saldoIva: number;
  isPayable: boolean;
  ivaRegularizarNet: number;
}

interface VatSettlementTabProps {
  vatSettlement: VatSettlementData;
  onOpenVatSettlementEntry: () => void;
}

export const VatSettlementTab: React.FC<VatSettlementTabProps> = ({
  vatSettlement,
  onOpenVatSettlementEntry,
}) => {
  return (
    <div className="space-y-6">
      <GlassCard className="p-6 w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Quadro Sinóptico de Apuramento Periódico de IVA
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Em cumprimento do Código do IVA de Angola e Declaração Periódica Modelo 7
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenVatSettlementEntry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" />
            Gerar Lançamento de Apuramento (Conta 34.5.6)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
              IVA Liquidado (Vendas)
            </span>
            <div className="text-lg font-black text-blue-700 dark:text-blue-400 font-mono mt-1">
              <KzAmount value={vatSettlement.totalIvaLiquidado} />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
              <div className="flex justify-between">
                <span>Taxa Geral 14% (34.5.3.1):</span>
                <span className="font-mono font-bold">
                  <KzAmount value={vatSettlement.ivaLiquidado14} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>Taxa Reduzida 5% (34.5.3.2):</span>
                <span className="font-mono font-bold">
                  <KzAmount value={vatSettlement.ivaLiquidado5} />
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
              IVA Dedutível (Compras)
            </span>
            <div className="text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono mt-1">
              <KzAmount value={vatSettlement.totalIvaDedutivel} />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
              <div className="flex justify-between">
                <span>IVA Suportado (34.5.1):</span>
                <span className="font-mono font-bold">
                  <KzAmount value={vatSettlement.ivaSuportado} />
                </span>
              </div>
              <div className="flex justify-between">
                <span>IVA Dedutível (34.5.2):</span>
                <span className="font-mono font-bold">
                  <KzAmount value={vatSettlement.ivaDedutivel} />
                </span>
              </div>
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border ${
              vatSettlement.isPayable
                ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
                : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
            }`}
          >
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
              {vatSettlement.isPayable ? 'IVA a Pagar à Administração Tributária' : 'Crédito de IVA a Recuperar'}
            </span>
            <div
              className={`text-lg font-black font-mono mt-1 ${
                vatSettlement.isPayable ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              <KzAmount value={vatSettlement.saldoIva} />
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              {vatSettlement.isPayable
                ? 'Conta: 34.5.7 (IVA a Pagar)'
                : 'Conta: 34.5.8 (IVA a Recuperar)'}
            </div>
          </div>
        </div>

        {/* Reconciliation table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 dark:bg-slate-800 font-bold font-sans">
              <tr>
                <th className="p-3">Campo do Modelo 7</th>
                <th className="p-3">Conta</th>
                <th className="p-3 text-right">Valor Apurado (Kz)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              <tr>
                <td className="p-3">Total do IVA Liquidado às taxas de 14% e 5%</td>
                <td className="p-3 font-mono font-bold text-blue-600">34.5.3</td>
                <td className="p-3 text-right font-mono font-bold">
                  <KzAmount value={vatSettlement.totalIvaLiquidado} />
                </td>
              </tr>
              <tr>
                <td className="p-3">Total do IVA Dedutível (Existências, Imobilizado e FSE)</td>
                <td className="p-3 font-mono font-bold text-indigo-600">34.5.2</td>
                <td className="p-3 text-right font-mono font-bold">
                  (<KzAmount value={vatSettlement.totalIvaDedutivel} />)
                </td>
              </tr>
              <tr>
                <td className="p-3">Regularizações de IVA a favor do Estado / Sujeito Passivo</td>
                <td className="p-3 font-mono font-bold text-slate-600">34.5.5</td>
                <td className="p-3 text-right font-mono font-bold">
                  <KzAmount value={vatSettlement.ivaRegularizarNet} />
                </td>
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-900 font-bold">
                <td className="p-3 uppercase">
                  Posição Líquida Final do Período ({vatSettlement.isPayable ? 'A Pagar' : 'A Recuperar'})
                </td>
                <td className="p-3 font-mono">
                  {vatSettlement.isPayable ? '34.5.7' : '34.5.8'}
                </td>
                <td className="p-3 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                  <KzAmount value={vatSettlement.saldoIva} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
