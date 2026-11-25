import React, { useState } from 'react';
import { Calculator, TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react';

interface TcoCalculatorSectionProps {
  onOpenDemoWithPlan?: (planDetails: string) => void;
}

export const TcoCalculatorSection: React.FC<TcoCalculatorSectionProps> = ({ onOpenDemoWithPlan }) => {
  const [terminals, setTerminals] = useState<number>(4);
  const [currentSystem, setCurrentSystem] = useState<string>('primavera');
  const [hasDedicatedDbServer, setHasDedicatedDbServer] = useState<boolean>(true);

  // Approximate cost models in Angola (AOA exchange rate ~950 AOA/USD)
  // Legacy systems: Base license per workstation ~650 USD/yr + maintenance ~25%
  // MS SQL Server & Windows Server: ~1,500 USD/yr if dedicated
  // Kudiba: Fixed predictable plan in Kwanzas
  const usdExchangeRate = 950;

  const legacySystemNames: Record<string, string> = {
    primavera: 'Primavera / Cegid',
    phc: 'PHC CS',
    sage: 'Sage 50c',
    outro: 'Outro Sistema Tradicional',
  };

  const calculateLegacyCostAoa = () => {
    const licensePerWorkstationUsd = currentSystem === 'primavera' ? 700 : currentSystem === 'phc' ? 650 : 600;
    const maintenancePerYearUsd = 800;
    const dbServerCostUsd = hasDedicatedDbServer ? 1600 : 0;
    const totalUsd = terminals * licensePerWorkstationUsd + maintenancePerYearUsd + dbServerCostUsd;
    return Math.round(totalUsd * usdExchangeRate);
  };

  const calculateKudibaCostAoa = () => {
    // Kudiba predictable cost in Kwanzas:
    // Base tier up to 3 terminals: ~480,000 Kz/yr
    // Each additional terminal: ~90,000 Kz/yr
    // 0 Kz in DB licenses (Postgres open-source)
    const baseCost = 480000;
    const additionalTerminalsCost = terminals > 3 ? (terminals - 3) * 90000 : 0;
    return baseCost + additionalTerminalsCost;
  };

  const legacyTotal = calculateLegacyCostAoa();
  const kudibaTotal = calculateKudibaCostAoa();
  const annualSavingsAoa = Math.max(0, legacyTotal - kudibaTotal);
  const savingsPercentage = Math.round((annualSavingsAoa / legacyTotal) * 100);

  const handleApplySavings = () => {
    const details = `Calculadora TCO: ${terminals} postos, migração de ${legacySystemNames[currentSystem] || 'Legado'}, poupança estimada de ${annualSavingsAoa.toLocaleString('pt-AO')} Kz/ano`;
    if (onOpenDemoWithPlan) {
      onOpenDemoWithPlan(details);
    }
  };

  return (
    <section id="calculadora" className="py-16 sm:py-24 bg-white dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Calculator className="h-3.5 w-3.5" />
            <span>Simulador de Poupança Empresarial (TCO)</span>
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Descubra quanto a sua empresa poupa em Kwanzas com o Kudiba
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Compare os custos de licenças indexadas a moedas estrangeiras e servidores proprietários face ao modelo Kudiba sem custos ocultos.
          </p>
        </div>

        {/* Calculator Widget */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Controls Column */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900/60">
            {/* Input 1: Terminals */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="terminals-range" className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Número de Caixas / Postos de Venda / Utilizadores
                </label>
                <span className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-extrabold text-white font-mono">
                  {terminals} {terminals === 1 ? 'posto' : 'postos'}
                </span>
              </div>
              <input
                id="terminals-range"
                type="range"
                min="1"
                max="25"
                value={terminals}
                onChange={(e) => setTerminals(Number(e.target.value))}
                className="mt-4 w-full accent-emerald-600 cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400">
                <span>1 posto (Balcão simples)</span>
                <span>10 postos (Supermercado / PME)</span>
                <span>25 postos (Grupo multi-loja)</span>
              </div>
            </div>

            {/* Input 2: Current ERP */}
            <div className="mt-8">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-200 block mb-3">
                Qual é o software de faturação ou ERP que utiliza atualmente?
              </label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  { id: 'primavera', label: 'Primavera' },
                  { id: 'phc', label: 'PHC CS' },
                  { id: 'sage', label: 'Sage' },
                  { id: 'outro', label: 'Outro' },
                ].map((sys) => (
                  <button
                    key={sys.id}
                    type="button"
                    onClick={() => setCurrentSystem(sys.id)}
                    className={`rounded-xl border p-3 text-center text-xs font-bold transition ${
                      currentSystem === sys.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-500 dark:text-emerald-200 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {sys.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input 3: Dedicated Database Server */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Servidor dedicado com Microsoft SQL Server pago?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Os ERPs legados exigem licenças caras de Windows Server e MS SQL Server.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHasDedicatedDbServer(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      hasDedicatedDbServer
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasDedicatedDbServer(false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      !hasDedicatedDbServer
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Column */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 p-7 text-white shadow-xl shadow-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/30">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Redução de até {savingsPercentage}%
                </span>
                <span className="text-xs font-medium text-slate-400">Estimativa Anual</span>
              </div>

              {/* Total Savings Display */}
              <div className="mt-6">
                <p className="text-xs font-medium text-emerald-200 uppercase tracking-wider">
                  Poupança Anual Estimada
                </p>
                <p className="mt-1 text-4xl sm:text-5xl font-black text-amber-300 font-mono tracking-tight">
                  {annualSavingsAoa.toLocaleString('pt-AO')} <span className="text-2xl font-bold text-white">Kz</span>
                </p>
                <p className="text-xs text-slate-300 mt-2">
                  Poupa aproximadamente <strong>{(annualSavingsAoa / 12).toLocaleString('pt-AO')} Kz por mês</strong> que deixam de ser enviados para o estrangeiro em licenças.
                </p>
              </div>

              {/* Breakdown comparison bars */}
              <div className="mt-6 space-y-3 pt-6 border-t border-slate-800 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Custo Estimado no {legacySystemNames[currentSystem] || 'Legado'}</span>
                    <span className="font-mono font-bold text-rose-300">
                      {legacyTotal.toLocaleString('pt-AO')} Kz/ano
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full w-full" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Investimento no Kudiba ERP (Preço Fixo em Kwanzas)</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {kudibaTotal.toLocaleString('pt-AO')} Kz/ano
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(15, 100 - savingsPercentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Key guarantees */}
              <div className="mt-6 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Sem taxa de conversão cambial (100% faturado em Angola)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Migração assistida de artigos e clientes do sistema antigo em 48h</span>
                </div>
              </div>

              {/* Call to action */}
              <button
                type="button"
                onClick={handleApplySavings}
                className="mt-7 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-3.5 text-sm font-extrabold text-slate-950 shadow-md hover:bg-amber-300 active:scale-[0.99] transition"
              >
                <span>Quero Garantir Esta Poupança</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
