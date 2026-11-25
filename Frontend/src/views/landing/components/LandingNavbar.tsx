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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90 transition-colors">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-md shadow-emerald-900/20">
            <span className="font-sans text-2xl font-black tracking-tighter text-amber-300">K</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Kudiba<span className="text-emerald-600 dark:text-emerald-400">ERP</span>
              </span>
              <span className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 sm:inline-flex dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/30">
                <ShieldCheck className="h-3 w-3" /> AGT FE/528/2026
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Cloud-Native & Edge-Ready • Angola
            </p>
          </div>
        </div>

        {/* Center Nav Links (Desktop) */}
        <nav className="hidden items-center gap-7 lg:flex text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={() => scrollTo('modulos')}
            className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Módulos
          </button>
          <button
            type="button"
            onClick={() => scrollTo('offline-pos')}
            className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            POS Offline
          </button>
          <button
            type="button"
            onClick={() => scrollTo('comparativo')}
            className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Vantagens
          </button>
          <button
            type="button"
            onClick={() => scrollTo('calculadora')}
            className="flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            Calculadora TCO
          </button>
          <button
            type="button"
            onClick={() => scrollTo('planos')}
            className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Planos
          </button>
          <button
            type="button"
            onClick={() => scrollTo('contabilistas')}
            className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Contabilistas
          </button>
          <button
            type="button"
            onClick={() => scrollTo('faq')}
            className="transition hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            Perguntas
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
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition dark:bg-emerald-950/40 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
          >
            <MessageSquareCode className="h-4 w-4" />
            Demonstração
          </button>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition"
          >
            <span>Aceder ao ERP</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
