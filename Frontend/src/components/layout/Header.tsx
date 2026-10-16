import React from 'react';
import { Sun, Moon, LogOut, Store, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { StatusBadge } from '../common/StatusBadge';

export const Header: React.FC = () => {
  const { user, tenants, activeTenant, setActiveTenant, logout } = useAuthStore();
  const { themeMode, toggleTheme } = useUiStore();

  return (
    <header className="no-print sticky top-0 z-40 h-16 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        {tenants.length > 0 && (
          <div className="relative">
            <select
              value={activeTenant?.id || ''}
              onChange={(e) => {
                const selected = tenants.find((t) => t.id === e.target.value);
                if (selected) setActiveTenant(selected);
              }}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (NIF: {t.taxId})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Store className="w-4 h-4" />
          <span>Filial Principal</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5" title="Motor Fiscal AGT Conforme (RSA-SHA1)">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <StatusBadge status="ok" label="AGT Conforme" size="small" />
        </div>

        <button
          onClick={toggleTheme}
          aria-label="Alternar tema"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
              {user?.fullName || 'Utilizador Kudiba'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {user?.email || 'admin@kudiba.ao'}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          title="Terminar Sessão"
          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
