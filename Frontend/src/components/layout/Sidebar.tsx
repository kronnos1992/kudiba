import React from 'react';
import styled from 'styled-components';
import { Box, Typography } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BadgeIcon from '@mui/icons-material/Badge';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SettingsIcon from '@mui/icons-material/Settings';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';

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

const SidebarContainer = styled.aside<{ $mode: 'light' | 'dark' }>`
  width: 260px;
  background: ${({ $mode }) => tokens[$mode].bgSidebar};
  border-right: 1px solid ${({ $mode }) => tokens[$mode].border};
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  flex-shrink: 0;
`;

const BrandSection = styled.div<{ $mode: 'light' | 'dark' }>`
  height: 64px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 24px;
  border-bottom: 1px solid ${({ $mode }) => tokens[$mode].border};
`;

const NavList = styled.nav`
  flex: 1;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
`;

const NavItem = styled.button<{ $active: boolean; $mode: 'light' | 'dark' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: ${({ $active, $mode }) =>
    $active
      ? $mode === 'light'
        ? 'rgba(13, 92, 58, 0.12)'
        : 'rgba(16, 185, 129, 0.18)'
      : 'transparent'};
  color: ${({ $active, $mode }) =>
    $active
      ? tokens[$mode].emeraldPrimary
      : tokens[$mode].textSecondary};
  font-family: var(--font-primary);
  font-size: 0.875rem;
  font-weight: ${({ $active }) => ($active ? '700' : '500')};
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ $mode, $active }) =>
      $active
        ? $mode === 'light'
          ? 'rgba(13, 92, 58, 0.16)'
          : 'rgba(16, 185, 129, 0.22)'
        : $mode === 'light'
        ? 'rgba(0, 0, 0, 0.04)'
        : 'rgba(255, 255, 255, 0.05)'};
    color: ${({ $mode }) => tokens[$mode].textPrimary};
  }
`;

const NAV_ITEMS: Array<{ key: ModuleKey; label: string; icon: React.ReactElement }> = [
  { key: 'dashboard', label: 'Dashboard Executivo', icon: <DashboardIcon fontSize="small" /> },
  { key: 'pos', label: 'POS / Caixa Rápido', icon: <PointOfSaleIcon fontSize="small" /> },
  { key: 'invoicing', label: 'Faturação AGT', icon: <ReceiptLongIcon fontSize="small" /> },
  { key: 'inventory', label: 'Artigos & Armazéns', icon: <Inventory2Icon fontSize="small" /> },
  { key: 'treasury', label: 'Tesouraria & Caixa', icon: <AccountBalanceWalletIcon fontSize="small" /> },
  { key: 'payroll', label: 'Recursos Humanos', icon: <BadgeIcon fontSize="small" /> },
  { key: 'accounting', label: 'Contabilidade PGC', icon: <AccountBalanceIcon fontSize="small" /> },
  { key: 'settings', label: 'Configurações & SAF-T', icon: <SettingsIcon fontSize="small" /> },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeModule, onSelectModule }) => {
  const themeMode = useUiStore((s) => s.themeMode);

  return (
    <SidebarContainer $mode={themeMode} className="no-print">
      <BrandSection $mode={themeMode}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            bgcolor: tokens[themeMode].emeraldPrimary,
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.1rem',
            boxShadow: '0 2px 8px rgba(13, 92, 58, 0.3)',
          }}
        >
          K
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Kudiba <span style={{ color: tokens[themeMode].goldPrimary }}>ERP</span>
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
            Angola Fiscal v2026
          </Typography>
        </Box>
      </BrandSection>

      <NavList>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.key}
            $active={activeModule === item.key}
            $mode={themeMode}
            onClick={() => onSelectModule(item.key)}
          >
            {item.icon}
            {item.label}
          </NavItem>
        ))}
      </NavList>
    </SidebarContainer>
  );
};
