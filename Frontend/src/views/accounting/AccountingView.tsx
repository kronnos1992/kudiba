import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const AccountingView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Contabilidade Geral &amp; PGC Angolano
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Plano Geral de Contabilidade (Classes 1 a 8), balancetes de 4 e 6 colunas e partidas dobradas
        </p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Balancete de Verificação (Exercício 2026)
          </h3>
          <StatusBadge status="ok" label="Partidas Dobradas Equilibradas" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Contabilidade automatizada via lançamentos em tempo real
        </p>
        <div className="flex flex-wrap gap-8">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Total Débitos:
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={68420000.0} />
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Total Créditos:
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={68420000.0} />
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
