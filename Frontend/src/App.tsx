import React, { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useUiStore } from './stores/uiStore';
import { LoginView } from './views/auth/LoginView';
import { AppLayout } from './components/layout/AppLayout';
import { ModuleKey } from './components/layout/Sidebar';
import { DashboardView } from './views/dashboard/DashboardView';
import { PosView } from './views/pos/PosView';
import { InvoicingView } from './views/invoicing/InvoicingView';
import { InventoryView } from './views/inventory/InventoryView';
import { TreasuryView } from './views/treasury/TreasuryView';
import { PayrollView } from './views/payroll/PayrollView';
import { AccountingView } from './views/accounting/AccountingView';
import { SettingsView } from './views/settings/SettingsView';

export const App: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const { themeMode } = useUiStore();
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderActiveModule = () => {
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
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={(mod) => setActiveModule(mod as ModuleKey)} />;
    }
  };

  return (
    <AppLayout activeModule={activeModule} onSelectModule={setActiveModule}>
      {renderActiveModule()}
    </AppLayout>
  );
};
