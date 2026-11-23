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
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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

export interface NavSubItem {
  tab: string;
  label: string;
}

export interface NavItem {
  key: ModuleKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  subItems?: NavSubItem[];
}

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

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
  { key: 'pos', label: 'POS / Caixa Rápido', icon: Receipt },
  {
    key: 'invoicing',
    label: 'Facturação',
    icon: FileText,
    subItems: [
      { tab: 'invoices', label: 'Documentos Emitidos' },
      { tab: 'proformas', label: 'Facturas Proforma' },
      { tab: 'new_invoice', label: 'Emitir Factura' },
      { tab: 'series', label: 'Séries Fiscais' },
      { tab: 'saft', label: 'Exportação SAF-T' },
    ],
  },
  {
    key: 'inventory',
    label: 'Gestão de Stock',
    icon: Boxes,
    subItems: [
      { tab: 'products', label: 'Produtos & Catálogo' },
      { tab: 'warehouses', label: 'Armazéns & Lojas' },
      { tab: 'movements', label: 'Movimentos de Stock' },
      { tab: 'batches', label: 'Lotes & Validades' },
      { tab: 'entities', label: 'Entidades Comerciais' },
    ],
  },
  {
    key: 'treasury',
    label: 'Tesouraria & Caixa',
    icon: Wallet,
    subItems: [
      { tab: 'cash_flow', label: 'Fluxo de Caixa' },
      { tab: 'payables', label: 'Contas a Pagar' },
      { tab: 'receivables', label: 'Contas a Receber' },
      { tab: 'transfers', label: 'Transferências' },
      { tab: 'bank_accounts', label: 'Contas & Caixas' },
      { tab: 'receipts', label: 'Recibos Emitidos' },
    ],
  },
  {
    key: 'payroll',
    label: 'Recursos Humanos',
    icon: Users,
    subItems: [
      { tab: 'periods', label: 'Períodos Salariais' },
      { tab: 'employees', label: 'Colaboradores' },
      { tab: 'contracts', label: 'Contratos de Trabalho' },
      { tab: 'organization', label: 'Estrutura Organizacional' },
      { tab: 'vacations', label: 'Gestão de Férias' },
      { tab: 'absences', label: 'Assiduidade & Faltas' },
      { tab: 'conflicts', label: 'Conflitos & Alertas' },
    ],
  },
  {
    key: 'accounting',
    label: 'Contabilidade',
    icon: Scale,
    subItems: [
      { tab: 'trial_balance', label: 'Balancete de Verificação' },
      { tab: 'entries', label: 'Diário & Lançamentos' },
      { tab: 'ledger', label: 'Razão Geral' },
      { tab: 'financial_statements', label: 'Demonstrações Financeiras' },
      { tab: 'cost_centers', label: 'Centros de Custo' },
      { tab: 'vat_settlement', label: 'Apuramento de IVA' },
      { tab: 'chart', label: 'Plano de Contas (PGC)' },
    ],
  },
  {
    key: 'integrations',
    label: 'Integrações & ETL',
    icon: Network,
    subItems: [
      { tab: 'endpoints', label: 'Terminais & Endpoints' },
      { tab: 'mappings', label: 'Mapeamentos de Dados' },
      { tab: 'runs', label: 'Execuções & Histórico' },
      { tab: 'templates', label: 'Modelos de Importação' },
    ],
  },
  {
    key: 'settings',
    label: 'Configurações & SAF-T',
    icon: Settings,
    subItems: [
      { tab: 'organization', label: 'Organização & Filiais' },
      { tab: 'users', label: 'Utilizadores, Perfis & RBAC' },
      { tab: 'certification', label: 'Certificação AGT & RSA' },
      { tab: 'series', label: 'Séries Fiscais' },
      { tab: 'saft', label: 'Ficheiro SAF-T (AO)' },
      { tab: 'backups', label: 'Cópias de Segurança' },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  const { user, activeTenant } = useAuthStore();
  const {
    mobileSidebarOpen,
    setMobileSidebarOpen,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    activeSubTabs,
    setActiveSubTab,
    openSidebarDropdowns,
    toggleSidebarDropdown,
    setSidebarDropdownOpen,
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
    if (!BILLABLE_MODULES.includes(item.key)) {
      return true;
    }
    if (isSuperadmin || !subscribedModules) {
      return true;
    }
    return subscribedModules.includes(item.key);
  });

  const isDropdownOpen = (key: ModuleKey) => {
    if (openSidebarDropdowns[key] !== undefined) {
      return openSidebarDropdowns[key];
    }
    return activeModule === key;
  };

  const handleItemClick = (item: NavItem, isMobile = false) => {
    const hasSubs = Boolean(item.subItems && item.subItems.length > 0);
    if (activeModule !== item.key) {
      onSelectModule(item.key);
      if (hasSubs) {
        setSidebarDropdownOpen(item.key, true);
      } else if (isMobile) {
        setMobileSidebarOpen(false);
      }
    } else if (hasSubs) {
      toggleSidebarDropdown(item.key);
    } else if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleSubItemClick = (moduleKey: ModuleKey, tab: string) => {
    onSelectModule(moduleKey);
    setActiveSubTab(moduleKey, tab);
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
        className={`no-print fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
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
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.key;
            const hasSubs = Boolean(item.subItems && item.subItems.length > 0);
            const isOpen = hasSubs && isDropdownOpen(item.key);

            return (
              <div key={item.key} className="w-full">
                <button
                  type="button"
                  onClick={() => handleItemClick(item, true)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out text-left cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {hasSubs && (
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-300 ease-in-out shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                      }`}
                    />
                  )}
                </button>

                {hasSubs && (
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-emerald-500/25 ml-4 my-1">
                        {item.subItems?.map((sub) => {
                          const isSubActive =
                            activeModule === item.key && activeSubTabs[item.key] === sub.tab;
                          return (
                            <button
                              key={sub.tab}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubItemClick(item.key, sub.tab);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-in-out text-left cursor-pointer ${
                                isSubActive
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                              {isSubActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 ring-2 ring-emerald-500/20" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Sidebar Desktop (>= lg) */}
      <aside
        className={`no-print hidden lg:flex h-full min-h-dvh self-stretch flex-shrink-0 flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out ${
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
            const hasSubs = Boolean(item.subItems && item.subItems.length > 0);
            const isOpen = hasSubs && isDropdownOpen(item.key);

            return (
              <div key={item.key} className="w-full">
                <button
                  type="button"
                  onClick={() => handleItemClick(item, false)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out ${
                    sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2.5 text-left'
                  } ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && hasSubs && (
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-300 ease-in-out shrink-0 ${
                        isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                      }`}
                    />
                  )}
                </button>

                {!sidebarCollapsed && hasSubs && (
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-emerald-500/25 ml-4 my-1">
                        {item.subItems?.map((sub) => {
                          const isSubActive =
                            activeModule === item.key && activeSubTabs[item.key] === sub.tab;
                          return (
                            <button
                              key={sub.tab}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubItemClick(item.key, sub.tab);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ease-in-out text-left cursor-pointer ${
                                isSubActive
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <span className="truncate">{sub.label}</span>
                              {isSubActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0 ring-2 ring-emerald-500/20" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
