import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const InventoryView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Gestão de Artigos, Lotes &amp; Armazéns
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Valorização de stock por Custo Médio Ponderado (CMP) e armazéns via KudibaInventory
        </p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Depósitos &amp; Armazéns Ativos
          </h3>
          <StatusBadge status="ok" label="Inventário Sincronizado" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Armazém Central (Viana) • Depósito Loja (Talatona)
        </p>
        <div className="flex flex-wrap gap-8">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Valorização Patrimonial (CMP):
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={42850900.0} />
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Total de Referências:
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              1.420 artigos
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
