import React from 'react';
import { ShieldCheck, Moon, Sun, ArrowRight, MessageSquareCode } from 'lucide-react';
import { useUiStore } from '../../../stores/uiStore';

interface LandingNavbarProps {
  onOpenLogin: () => void;
  onOpenDemo: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenLogin, onOpenDemo }) => {
  const { themeMode, toggleTheme } = useUiStore();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-950/95 transition-colors">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo & MONAIT */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-900 text-white shadow-md shadow-emerald-950/20">
            <span className="font-sans text-2xl font-black tracking-tight text-amber-300">K</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Kudiba<span className="text-emerald-700 dark:text-emerald-400">ERP</span>
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                MONAIT
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Solução Integrada de Gestão Empresarial · Angola
            </p>
          </div>
        </div>

        {/* Center Nav Links (Estilo SAP / Primavera) */}
        <nav className="hidden items-center gap-8 lg:flex text-sm font-semibold text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => scrollTo('solucoes')}
            className="transition hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            Soluções
          </button>
          <button
            type="button"
            onClick={() => scrollTo('vantagens')}
            className="transition hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            Porquê o Kudiba?
          </button>
          <button
            type="button"
            onClick={() => scrollTo('conformidade-agt')}
            className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-400 transition"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Rigor Fiscal AGT</span>
          </button>
          <button
            type="button"
            onClick={() => scrollTo('calculadora')}
            className="transition hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            Simulador de Poupança
          </button>
          <button
            type="button"
            onClick={() => scrollTo('planos')}
            className="transition hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => scrollTo('contabilistas')}
            className="transition hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            Contabilistas
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            {themeMode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={onOpenDemo}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 shadow-sm transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageSquareCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Falar com Consultor
          </button>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-900 active:bg-emerald-950 transition dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            <span>Aceder ao ERP</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
