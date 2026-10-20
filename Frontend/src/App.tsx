import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from './stores/authStore';
import { useUiStore } from './stores/uiStore';
import { authApi } from './api/auth';
import { LoginView } from './views/auth/LoginView';
import { AppLayout } from './components/layout/AppLayout';
import { SessionIdleWatcher } from './components/session/SessionIdleWatcher';
import { ModuleKey } from './components/layout/Sidebar';
import { DashboardView } from './views/dashboard/DashboardView';
import { PosView } from './views/pos/PosView';
import { InvoicingView } from './views/invoicing/InvoicingView';
import { InventoryView } from './views/inventory/InventoryView';
import { TreasuryView } from './views/treasury/TreasuryView';
import { PayrollView } from './views/payroll/PayrollView';
import { AccountingView } from './views/accounting/AccountingView';
import { IntegrationsView } from './views/integrations/IntegrationsView';
import { SettingsView } from './views/settings/SettingsView';
import { ClientesView } from './views/backoffice/ClientesView';
import { CompanyOnboardingModal } from './components/onboarding/CompanyOnboardingModal';

const isCashierOnly = (roles?: string[]): boolean =>
  Boolean(roles && roles.length > 0 && roles.every((r) => r.toUpperCase() === 'OPERADOR_CAIXA'));

export const App: React.FC = () => {
  const { isAuthenticated, activeTenant, updateActiveTenantSettings, user } = useAuthStore();
  const { themeMode } = useUiStore();

  const userRoles = user?.roles?.length ? user.roles : (activeTenant?.roles ?? []);
  const isCashier = isCashierOnly(userRoles);

  const [activeModule, setActiveModule] = useState<ModuleKey>(
    isCashier ? 'pos' : 'dashboard'
  );
  const [onboardingModalOpen, setOnboardingModalOpen] = useState(false);
  const [dismissedOnboardingForTenant, setDismissedOnboardingForTenant] = useState<string | null>(null);

  useEffect(() => {
    setActiveModule(isCashier ? 'pos' : 'dashboard');
  }, [user?.id, isCashier]);

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  useEffect(() => {
    if (!isAuthenticated || !activeTenant?.id || isCashier) return;
    let mounted = true;
    authApi
      .getTenantSettings()
      .then((settings) => {
        if (!mounted) return;
        updateActiveTenantSettings(settings);
        if (settings.onboarding_completed === false && dismissedOnboardingForTenant !== settings.id) {
          setOnboardingModalOpen(true);
        }
      })
      .catch(() => {
        if (
          mounted &&
          activeTenant.onboarding_completed === false &&
          dismissedOnboardingForTenant !== activeTenant.id
        ) {
          setOnboardingModalOpen(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, activeTenant?.id, isCashier]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const needsOnboarding = !isCashier && activeTenant?.onboarding_completed === false;

  const renderActiveModule = () => {
    if (isCashier) {
      return <PosView />;
    }
    switch (activeModule) {
      case 'dashboard':
        return <DashboardView onNavigate={(mod) => setActiveModule(mod as ModuleKey)} />;
      case 'pos':
        return <PosView />;
      case 'invoicing':
        return <InvoicingView />;
      case 'inventory':
        return <InventoryView />;
      case 'treasury':
        return <TreasuryView />;
      case 'payroll':
        return <PayrollView />;
      case 'accounting':
        return <AccountingView />;
      case 'integrations':
        return <IntegrationsView />;
      case 'settings':
        return <SettingsView onOpenOnboarding={() => setOnboardingModalOpen(true)} />;
      case 'clients':
        return <ClientesView />;
      default:
        return <DashboardView onNavigate={(mod) => setActiveModule(mod as ModuleKey)} />;
    }
  };

  return (
    <AppLayout activeModule={activeModule} onSelectModule={setActiveModule}>
      {needsOnboarding && (
        <div className="mb-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Parametrização Inicial da Empresa Pendente
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Antes de emitir documentos oficiais (Faturas, Recibos, SAF-T AO), conclua os dados legais, NIF, endereço, logótipo e coordenadas bancárias da sua empresa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnboardingModalOpen(true)}
            className="btn-primary text-xs shrink-0"
          >
            Configurar Empresa Agora
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {renderActiveModule()}

      <SessionIdleWatcher />

      <CompanyOnboardingModal
        isOpen={onboardingModalOpen}
        onClose={() => {
          setOnboardingModalOpen(false);
          if (activeTenant?.id) {
            setDismissedOnboardingForTenant(activeTenant.id);
          }
        }}
        forceAllowClose={true}
      />
    </AppLayout>
  );
};

