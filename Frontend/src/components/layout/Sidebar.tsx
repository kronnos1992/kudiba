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
} from 'lucide-react';

export type ModuleKey =
  | 'dashboard'
  | 'pos'
  | 'invoicing'
  | 'inventory'
  | 'treasury'
  | 'payroll'
  | 'accounting'
  | 'settings';

interface SidebarProps {
  activeModule: ModuleKey;
  onSelectModule: (module: ModuleKey) => void;
}

const NAV_ITEMS: Array<{ key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
  { key: 'pos', label: 'POS / Caixa Rápido', icon: Receipt },
  { key: 'invoicing', label: 'Faturação AGT', icon: FileText },
  { key: 'inventory', label: 'Artigos & Armazéns', icon: Boxes },
  { key: 'treasury', label: 'Tesouraria & Caixa', icon: Wallet },
  { key: 'payroll', label: 'Recursos Humanos', icon: Users },
  { key: 'accounting', label: 'Contabilidade PGC', icon: Scale },
  { key: 'settings', label: 'Configurações & SAF-T', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  return (
    <aside className="no-print w-64 h-screen sticky top-0 flex-shrink-0 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors">
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
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

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelectModule(item.key)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 text-left ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
