import React from 'react';
import {
  TrendingUp,
  Receipt,
  Landmark,
  ShieldCheck,
  PlusCircle,
  Store,
  ArrowRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { activeTenant } = useAuthStore();

  const mockRecentInvoices = [
    { id: 'FT 2026/00142', client: 'Sonangol E.P.', date: '16/10/2026', total: 4850000.0, status: 'ok', statusText: 'Assinada AGT' },
    { id: 'FR 2026/00891', client: 'Consumidor Final', date: '16/10/2026', total: 12450.0, status: 'ok', statusText: 'Paga' },
    { id: 'FT 2026/00141', client: 'Unitel S.A.', date: '15/10/2026', total: 1820000.0, status: 'ok', statusText: 'Assinada AGT' },
    { id: 'FT 2026/00140', client: 'ENSA Seguros', date: '15/10/2026', total: 950000.0, status: 'medio', statusText: 'Pendente Retenção' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Painel Executivo Financeiro
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTenant?.name || 'Kudiba Organização'} • NIF {activeTenant?.taxId || '5001234567'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('pos')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-sm font-bold transition-all shadow-xs"
          >
            <Store className="w-4 h-4" />
            <span>Terminal POS</span>
          </button>

          <button
            onClick={() => onNavigate('invoicing')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-md shadow-emerald-700/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Emitir Fatura</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Faturação do Mês
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={18420500.0} />
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            +14,2% face ao mês anterior
          </span>
        </GlassCard>

        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              IVA Liquidado (14%)
            </span>
            <Landmark className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={2578870.0} />
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Apuramento SAF-T em curso
          </span>
        </GlassCard>

        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Retenção na Fonte (6,5%)
            </span>
            <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={315250.0} />
            </div>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Crédito tributário dedutível
          </span>
        </GlassCard>

        <GlassCard className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Certificação AGT
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="my-3">
            <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              RSA-2048 Válido
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Hash J-1 Chaining: OK
          </span>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Últimos Documentos Fiscais Emitidos
          </h3>
          <button
            onClick={() => onNavigate('invoicing')}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <span>Ver Todos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3">Nº Documento</th>
                <th className="py-3 px-3">Cliente</th>
                <th className="py-3 px-3">Data</th>
                <th className="py-3 px-3 text-right">Total (Kz)</th>
                <th className="py-3 px-3 text-center">Estado Fiscal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {mockRecentInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                    {inv.id}
                  </td>
                  <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                    {inv.client}
                  </td>
                  <td className="py-3.5 px-3 text-xs text-slate-500 dark:text-slate-400">
                    {inv.date}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <KzAmount value={inv.total} />
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <StatusBadge
                      status={inv.status as 'ok' | 'medio'}
                      label={inv.statusText}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
};
