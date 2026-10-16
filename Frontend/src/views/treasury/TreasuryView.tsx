import React from 'react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const TreasuryView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Tesouraria, Caixas Físicos &amp; Recibos RC
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Sessões de caixa, contas bancárias (IBAN AO06) e quitação de faturas a prazo
        </p>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Caixa Principal (Sessão Aberta)
          </h3>
          <StatusBadge status="ok" label="Fecho Cego Ativo" />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Operador: Gestor Comercial Kudiba • Abertura: 08:30:00
        </p>
        <div className="flex flex-wrap gap-8">
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Saldo em Caixa (Dinheiro):
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={345200.0} />
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Multicaixa (TPA):
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              <KzAmount value={1280450.0} />
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
