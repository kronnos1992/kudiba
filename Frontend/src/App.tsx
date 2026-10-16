import React, { useState } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { useAuthStore } from './stores/authStore';
import { useUiStore } from './stores/uiStore';
import { createAppTheme } from './theme/muiTheme';
import { tokens } from './theme/designTokens';
import { GlobalStyles } from './theme/GlobalStyles';
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

  const muiTheme = createAppTheme(themeMode);
  const styledTheme = tokens[themeMode];

  if (!isAuthenticated) {
    return (
      <MuiThemeProvider theme={muiTheme}>
        <StyledThemeProvider theme={styledTheme}>
          <CssBaseline />
          <GlobalStyles />
          <LoginView />
        </StyledThemeProvider>
      </MuiThemeProvider>
    );
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
    <MuiThemeProvider theme={muiTheme}>
      <StyledThemeProvider theme={styledTheme}>
        <CssBaseline />
        <GlobalStyles />
        <AppLayout activeModule={activeModule} onSelectModule={setActiveModule}>
          {renderActiveModule()}
        </AppLayout>
      </StyledThemeProvider>
    </MuiThemeProvider>
  );
};
