import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  FileText,
  Boxes,
  Wallet,
  Users,
  Scale,
  Settings,
  Network,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

export type ModuleKey =
  | 'dashboard'
  | 'pos'
  | 'invoicing'
  | 'inventory'
  | 'treasury'
  | 'payroll'
  | 'accounting'
  | 'integrations'
  | 'settings'
  | 'clients';

interface SidebarProps {
  activeModule: ModuleKey;
  onSelectModule: (module: ModuleKey) => void;
}

const BILLABLE_MODULES: ModuleKey[] = [
  'invoicing',
  'inventory',
  'treasury',
  'payroll',
  'accounting',
  'integrations',
];

const NAV_ITEMS: Array<{ key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
  { key: 'pos', label: 'POS / Caixa Rápido', icon: Receipt },
  { key: 'invoicing', label: 'Faturação AGT', icon: FileText },
  { key: 'inventory', label: 'Artigos & Armazéns', icon: Boxes },
  { key: 'treasury', label: 'Tesouraria & Caixa', icon: Wallet },
  { key: 'payroll', label: 'Recursos Humanos', icon: Users },
  { key: 'accounting', label: 'Contabilidade PGC', icon: Scale },
  { key: 'integrations', label: 'Integrações & ETL', icon: Network },
  { key: 'settings', label: 'Configurações & SAF-T', icon: Settings },
  { key: 'clients', label: 'Clientes & Licenças', icon: Building2 },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  const { user, activeTenant } = useAuthStore();
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useUiStore();

  const isSuperadmin = Boolean(user?.is_superadmin);
  const subscribedModules = activeTenant?.subscribed_modules ?? null;
  const roles = user?.roles?.length ? user.roles : (activeTenant?.roles ?? []);
  const isCashierOnly =
    roles.length > 0 && roles.every((r) => r.toUpperCase() === 'OPERADOR_CAIXA');

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (isCashierOnly) {
      return item.key === 'pos';
    }
    if (item.key === 'clients') {
      return isSuperadmin;
    }
    if (!BILLABLE_MODULES.includes(item.key)) {
      return true;
    }
    if (isSuperadmin || !subscribedModules) {
      return true;
    }
    return subscribedModules.includes(item.key);
  });

  const handleSelect = (key: ModuleKey) => {
    onSelectModule(key);
    setMobileSidebarOpen(false);
  };

  return (
    <>
      {mobileSidebarOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer Mobile / Tablet (< lg) */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-200 ease-in-out lg:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-extrabold text-base shadow-sm">
              K
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Kudiba <span className="text-amber-600 dark:text-amber-400">ERP</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                Angola Fiscal v2026
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Fechar menu"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 text-left ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Sidebar Desktop (>= lg) */}
      <aside
        className={`no-print hidden lg:flex h-full min-h-dvh self-stretch flex-shrink-0 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-200 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div
          className={`h-16 flex items-center border-b border-slate-200 dark:border-slate-800 ${
            sidebarCollapsed ? 'justify-center px-2' : 'px-5 gap-3'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-extrabold text-base shadow-sm shrink-0">
            K
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                Kudiba <span className="text-amber-600 dark:text-amber-400">ERP</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide truncate">
                Angola Fiscal v2026
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-150 ${
                  sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3.5 py-2.5 text-left'
                } ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={toggleSidebarCollapsed}
            title={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Recolher Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
