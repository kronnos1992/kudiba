import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  WifiOff,
  Wifi,
  Coins,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Printer,
  Sparkles,
} from 'lucide-react';

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOpenLogin: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDemo, onOpenLogin }) => {
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);
  const [simulatedInvoicesCount, setSimulatedInvoicesCount] = useState(148);

  const scrollToCalculator = () => {
    const el = document.getElementById('calculadora');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSimulateSale = () => {
    setSimulatedInvoicesCount((prev) => prev + 1);
  };

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-500/15 via-teal-400/10 to-amber-400/10 blur-3xl dark:from-emerald-600/20 dark:via-teal-500/10 dark:to-emerald-950/0"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 backdrop-blur-sm dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Conformidade Estrita AGT • Decreto Presidencial n.º 71/25</span>
            </div>

            {/* Main Title */}
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white leading-[1.12]">
              O ERP e POS que <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-200">
                não pára quando a internet cai
              </span>
              .
            </h1>

            {/* Description */}
            <p className="mt-6 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Substitua sistemas legados caros (Primavera, PHC, Sage). O <strong>Kudiba ERP</strong> oferece
              faturação certificada pela AGT, ponto de venda com operação <em>Local-First</em> 100% offline,
              gestão de stocks e salários com IRT 2026.
              <span className="block mt-1 font-semibold text-slate-900 dark:text-white">
                Preços 100% em Kwanzas, sem risco cambial e com 0 Kz de custos ocultos com bases de dados.
              </span>
            </p>

            {/* Primary Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={scrollToCalculator}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/25 hover:bg-emerald-700 active:scale-[0.99] transition"
              >
                <Calculator className="h-4 w-4" />
                <span>Calcular Minha Poupança</span>
              </button>

              <button
                type="button"
                onClick={onOpenDemo}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>Solicitar Demonstração</span>
                <ArrowRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </button>

              <button
                type="button"
                onClick={onOpenLogin}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 underline underline-offset-4 ml-1 transition"
              >
                Já é cliente? Entrar no sistema
              </button>
            </div>

            {/* Micro Highlights Badges */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Certificado AGT
                </span>
              </div>
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  POS Vende Offline
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Núcleo Rust &lt;10ms
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  100% em Kwanzas
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Mock Terminal / Live Preview Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-3 w-3 rounded-full bg-rose-500" />
                  <span className="flex h-3 w-3 rounded-full bg-amber-500" />
                  <span className="flex h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-xs font-mono font-medium text-slate-400">
                    kudiba-pos // live-engine
                  </span>
                </div>

                {/* Offline Simulation Toggle */}
                <button
                  type="button"
                  onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    isSimulatedOffline
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-500/30'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                  }`}
                  title="Clique para testar o comportamento com ou sem internet"
                >
                  {isSimulatedOffline ? (
                    <>
                      <WifiOff className="h-3 w-3" />
                      <span>Sem Internet (Offline)</span>
                    </>
                  ) : (
                    <>
                      <Wifi className="h-3 w-3" />
                      <span>Conectado (Cloud Sync)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Status Banner */}
              <div
                className={`mt-4 rounded-xl p-3 text-xs transition ${
                  isSimulatedOffline
                    ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="font-bold">
                      {isSimulatedOffline
                        ? 'Operação Local-First Ativa:'
                        : 'Sincronização em Tempo Real:'}
                    </span>{' '}
                    {isSimulatedOffline
                      ? 'O POS continua a emitir faturas e talões térmicos com QR Code normalmente no balcão.'
                      : 'Todas as faturas, stocks e caixas sincronizados com a nuvem central.'}
                  </div>
                </div>
              </div>

              {/* Live Mini Counters */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Faturado Hoje
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                    {(simulatedInvoicesCount * 12450).toLocaleString('pt-AO')} Kz
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Faturas Assinadas AGT
                  </p>
                  <p className="mt-1 text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    {simulatedInvoicesCount} docs
                  </p>
                </div>
              </div>

              {/* Simulated Fast Transaction Receipt */}
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs font-mono dark:border-slate-700/80 dark:bg-slate-950">
                <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-2 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    FATURA-RECIBO FR KDB26/00{simulatedInvoicesCount}
                  </span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    RSA-2048 VÁLIDA
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Água Mineral 1.5L x 24</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      7.200,00 Kz
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Arroz Agulha 5Kg x 2</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      5.250,00 Kz
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                    <span>Total c/ IVA (14%)</span>
                    <span>12.450,00 Kz</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-dashed border-slate-200 text-[10px] text-slate-400 dark:border-slate-800">
                  <span>Hash: a1B4-Z9kL • QR Code Oficial</span>
                  <span>Tempo: 8ms</span>
                </div>
              </div>

              {/* Action Button inside preview */}
              <button
                type="button"
                onClick={handleSimulateSale}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 active:scale-[0.99] transition dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <Printer className="h-3.5 w-3.5 text-emerald-400" />
                <span>Simular Emissão Instantânea no Balcão</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
