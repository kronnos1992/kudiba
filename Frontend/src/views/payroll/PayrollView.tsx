import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const PayrollView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Recursos Humanos &amp; Processamento Salarial (KudibaPayroll)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Tabelas oficiais de IRT de Angola, Segurança Social (INSS 3% e 8%) e ficheiros PS2
        </p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Folha do Mês Corrente (Outubro 2026)
          </h3>
          <StatusBadge status="ok" label="Apuramento Conforme IRT/INSS" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Contratos ativos: 28 colaboradores
        </p>
        <div className="flex flex-wrap gap-8">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Massa Salarial Ilíquida:
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={11450000.0} />
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Retenção de IRT:
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={1250000.0} />
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              INSS Total (11%):
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={1259500.0} />
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
