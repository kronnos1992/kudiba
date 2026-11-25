import React from 'react';
import { Moon, Sun, ArrowRight } from 'lucide-react';
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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-colors dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand: Minimal & Sophisticated */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800 text-white shadow-sm dark:bg-emerald-700">
            <span className="font-sans text-lg font-black tracking-tight text-amber-300">K</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kudiba<span className="text-emerald-700 dark:text-emerald-400">ERP</span>
            </span>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              por MONAIT
            </span>
          </div>
        </div>

        {/* Clean Nav Links */}
        <nav className="hidden items-center gap-8 md:flex text-sm font-medium text-slate-600 dark:text-slate-300">
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
            Vantagens
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

        {/* Right Actions: Compact & Direct */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            className="rounded-lg p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenDemo}
            className="hidden sm:inline-block text-xs font-semibold text-slate-700 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-400 transition px-2"
          >
            Contactar
          </button>

          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-900 active:bg-emerald-950 transition dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            <span>Entrar</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
