import React, { useState } from 'react';
import { TrendingDown, CheckCircle2, ArrowRight } from 'lucide-react';

interface TcoCalculatorSectionProps {
  onOpenDemoWithPlan?: (planDetails: string) => void;
}

export const TcoCalculatorSection: React.FC<TcoCalculatorSectionProps> = ({ onOpenDemoWithPlan }) => {
  const [terminals, setTerminals] = useState<number>(4);
  const [currentSystem, setCurrentSystem] = useState<string>('primavera');
  const [hasDedicatedServer, setHasDedicatedServer] = useState<boolean>(true);

  // Estimativa comercial realista em Angola (câmbio de referência e licenciamento em moeda externa)
  const usdExchangeRate = 950;

  const legacySystemNames: Record<string, string> = {
    primavera: 'Primavera / Cegid',
    phc: 'PHC CS',
    sage: 'Sage',
    outro: 'Outro Sistema Tradicional',
  };

  const calculateLegacyCostAoa = () => {
    const licensePerTerminalUsd = currentSystem === 'primavera' ? 700 : currentSystem === 'phc' ? 650 : 600;
    const maintenancePerYearUsd = 800;
    const dbServerCostUsd = hasDedicatedServer ? 1600 : 0;
    const totalUsd = terminals * licensePerTerminalUsd + maintenancePerYearUsd + dbServerCostUsd;
    return Math.round(totalUsd * usdExchangeRate);
  };

  const calculateKudibaCostAoa = () => {
    // Investimento anual transparente no Kudiba em Kwanzas
    const baseCost = 480000;
    const additionalTerminalsCost = terminals > 3 ? (terminals - 3) * 90000 : 0;
    return baseCost + additionalTerminalsCost;
  };

  const legacyTotal = calculateLegacyCostAoa();
  const kudibaTotal = calculateKudibaCostAoa();
  const annualSavingsAoa = Math.max(0, legacyTotal - kudibaTotal);
  const savingsPercentage = Math.round((annualSavingsAoa / legacyTotal) * 100);

  const handleApplySavings = () => {
    const details = `Simulação de Poupança: ${terminals} postos, transição de ${legacySystemNames[currentSystem] || 'Legado'}, poupança prevista de ${annualSavingsAoa.toLocaleString('pt-AO')} Kz/ano`;
    if (onOpenDemoWithPlan) {
      onOpenDemoWithPlan(details);
    }
  };

  return (
    <section id="calculadora" className="py-16 sm:py-24 bg-white dark:bg-slate-950 border-b border-slate-200/90 dark:border-slate-800/90">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="landing-eyebrow">
            Retorno do Investimento
          </span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Simulador de Poupança para a sua Empresa
          </h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            Veja a diferença entre manter licenças indexadas a moedas estrangeiras ou adotar uma solução 100% faturada em Kwanzas, sem custos ocultos de infraestrutura.
          </p>
        </div>

        {/* Calculator Widget (Estilo Corporativo Limpo) */}
        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          {/* Controls */}
          <div className="lg:col-span-7 rounded-lg border border-slate-200 bg-slate-50 p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="terminals-range" className="text-sm font-bold text-slate-900 dark:text-white">
                  Postos de Trabalho / Caixas de Venda
                </label>
                <span className="rounded-xl bg-slate-900 px-3.5 py-1 text-sm font-extrabold text-white dark:bg-emerald-700">
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
                className="mt-4 w-full accent-emerald-700 cursor-pointer"
              />
              <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-400">
                <span>1 posto (Loja individual)</span>
                <span>8 postos (PME em crescimento)</span>
                <span>25 postos (Rede multi-loja)</span>
              </div>
            </div>

            <div className="mt-8">
              <label className="text-sm font-bold text-slate-900 dark:text-white block mb-3">
                Software de faturação utilizado atualmente
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
                        ? 'border-emerald-700 bg-white text-emerald-900 shadow-sm dark:bg-emerald-950 dark:border-emerald-500 dark:text-emerald-200 ring-2 ring-emerald-600/30'
                        : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {sys.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    Servidor dedicado com licenças proprietárias adicionais?
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Custos extras anuais com licenças de servidores e sistemas operativos.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHasDedicatedServer(true)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      hasDedicatedServer
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasDedicatedServer(false)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                      !hasDedicatedServer
                        ? 'bg-emerald-800 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="lg:col-span-5">
            <div className="rounded-lg border border-slate-200 bg-slate-900 p-8 text-white shadow-xl dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Redução de até {savingsPercentage}%
                </span>
                <span className="text-xs text-slate-400">Estimativa Anual</span>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Poupança Anual Estimada
                </p>
                <p className="mt-1 text-4xl sm:text-5xl font-black text-amber-300 font-mono tracking-tight">
                  {annualSavingsAoa.toLocaleString('pt-AO')} <span className="text-2xl font-bold text-white">Kz</span>
                </p>
                <p className="text-xs text-slate-300 mt-2">
                  Valor reinvestido no crescimento do seu negócio em vez de remessas para licenças externas.
                </p>
              </div>

              <div className="mt-6 space-y-3 pt-6 border-t border-slate-800 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Custo Estimado Atual ({legacySystemNames[currentSystem] || 'Legado'})</span>
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
                    <span>Investimento Kudiba ERP (Preço Fixo em Kwanzas)</span>
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

              <div className="mt-6 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Sem surpresas cambiais — faturado 100% em Angola</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Apoio e migração direta com a equipa técnica Kudiba</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleApplySavings}
                className="mt-7 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-500 active:scale-[0.99] transition"
              >
                <span>Solicitar Proposta para Esta Poupança</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
