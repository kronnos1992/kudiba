import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Calculator,
  Award,
} from 'lucide-react';

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOpenLogin: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDemo, onOpenLogin }) => {
  const scrollToSolutions = () => {
    const el = document.getElementById('solucoes');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToCalculator = () => {
    const el = document.getElementById('calculadora');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50/50 pt-10 pb-16 lg:pt-16 lg:pb-24 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Background Soft Accent (SAP-style clean elegance) */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-emerald-600/10 via-teal-500/10 to-amber-500/10 blur-3xl dark:from-emerald-900/20 dark:via-slate-800/20"
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Commercial & Humanized Presentation */}
          <div className="lg:col-span-7">
            {/* AGT & Certification Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-700/20 bg-emerald-50/80 px-4 py-1.5 text-xs font-bold text-emerald-900 backdrop-blur-sm dark:bg-emerald-950/60 dark:border-emerald-500/30 dark:text-emerald-300">
              <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Certificação AGT n.º FE/528/AGT/2026 • Decreto Presidencial 71/25</span>
            </div>

            {/* Headline */}
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white leading-[1.14]">
              A inteligência e o rigor fiscal que a sua empresa merece.
            </h1>

            {/* Description */}
            <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              O <strong>Kudiba ERP</strong> é a solução de gestão empresarial desenvolvida para responder com exatidão às exigências da Administração Geral Tributária (AGT) e ao Plano Geral de Contabilidade (PGC) de Angola.
            </p>
            <p className="mt-2 text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200">
              Vendas no balcão que não param sem internet, controlo rigoroso de stocks e salários com IRT e INSS — tudo faturado em Kwanzas com estabilidade total para o seu negócio.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5 sm:gap-4">
              <button
                type="button"
                onClick={onOpenDemo}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-800 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/25 hover:bg-emerald-900 active:scale-[0.99] transition dark:bg-emerald-700 dark:hover:bg-emerald-600"
              >
                <span>Falar com um Consultor</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={scrollToCalculator}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Calculator className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <span>Simular Poupança</span>
              </button>

              <button
                type="button"
                onClick={onOpenLogin}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400 underline underline-offset-4 ml-1 transition"
              >
                Já é cliente? Iniciar sessão
              </button>
            </div>

            {/* Business Pillars Bar */}
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4 pt-6 border-t border-slate-200 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Moeda Operacional</p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">Kwanza (AOA)</p>
                <p className="text-[11px] text-slate-500">Sem risco cambial</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ponto de Venda</p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">Vende Offline</p>
                <p className="text-[11px] text-slate-500">A loja nunca pára</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Fiscalidade</p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">SAF-T (AO) 100%</p>
                <p className="text-[11px] text-slate-500">Decreto 71/25</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Arquitetura</p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-900 dark:text-white">Multi-Filiais</p>
                <p className="text-[11px] text-slate-500">Lojas e Holding</p>
              </div>
            </div>
          </div>

          {/* Right Column: Executive Overview Panel (Estilo SAP / Primavera) */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-sm">
                    M
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Painel de Controlo Executivo
                    </span>
                    <span className="text-[11px] text-slate-400">Visão consolidada em tempo real</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Operação Ativa
                </span>
              </div>

              {/* Snapshot Metrics */}
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Faturação Comercial & Retalho
                    </span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      AGT Validada
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
                    12.450.000 <span className="text-sm font-bold text-slate-500">Kz</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    184 documentos assinados digitalmente com QR Code oficial
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Stocks & Armazém
                    </span>
                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                      Custo Médio (CMP)
                    </p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Multi-loja com lotes
                    </span>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                      Recursos Humanos
                    </span>
                    <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                      IRT & INSS 100%
                    </p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Lei Geral Trabalho 12/23
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-600/20 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Garantia de Continuidade Kudiba
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    A sua equipa trabalha com tranquilidade: atualizações fiscais automáticas, apoio técnico em Angola e implementação assistida em 48 horas.
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Descubra os módulos por área
                </span>
                <button
                  type="button"
                  onClick={scrollToSolutions}
                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 transition"
                >
                  <span>Explorar Soluções</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
