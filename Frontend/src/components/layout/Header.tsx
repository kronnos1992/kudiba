import React from 'react';
import { Sun, Moon, LogOut, Store, ShieldCheck, Menu } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { StatusBadge } from '../common/StatusBadge';

export const Header: React.FC = () => {
  const { user, tenants, activeTenant, activeBranch, setActiveTenant, logout } = useAuthStore();
  const { themeMode, toggleTheme, toggleMobileSidebar } = useUiStore();

  return (
    <header className="no-print sticky top-0 z-30 h-16 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 transition-colors">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={toggleMobileSidebar}
          aria-label="Abrir menu de navegação"
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {activeTenant?.logo_data_url && (
          <img
            src={activeTenant.logo_data_url}
            alt={activeTenant.name}
            className="hidden sm:block w-8 h-8 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white p-0.5 shrink-0"
          />
        )}

        {tenants.length > 0 && (
          <div className="relative min-w-0 max-w-[190px] sm:max-w-[280px] md:max-w-sm">
            <select
              value={activeTenant?.id || ''}
              onChange={(e) => {
                const selected = tenants.find((t) => t.id === e.target.value);
                if (selected) setActiveTenant(selected);
              }}
              className="w-full truncate appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 pr-6 sm:pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trade_name || t.name} (NIF: {t.nif || t.taxId})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
          <Store className="w-4 h-4 shrink-0" />
          {activeTenant?.branches && activeTenant.branches.length > 1 ? (
            <select
              value={activeBranch?.id || activeTenant.branches[0]?.id || ''}
              onChange={(e) => {
                const br = activeTenant.branches.find((b) => b.id === e.target.value);
                if (br && activeTenant) setActiveTenant(activeTenant, br);
              }}
              className="bg-transparent font-medium text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {activeTenant.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate max-w-[160px]">
              {activeBranch?.name || activeTenant?.branches?.[0]?.name || 'Sede Principal'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-1.5" title="Motor Fiscal AGT Conforme (RSA-SHA1)">
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
          <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block text-left max-w-[150px]">
            <p className="text-xs sm:text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100 truncate">
              {user?.fullName || 'Utilizador Kudiba'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
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
