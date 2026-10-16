import React from 'react';
import styled from 'styled-components';
import {
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Avatar,
  Box,
  Typography,
  Tooltip,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import LogoutIcon from '@mui/icons-material/Logout';
import StorefrontIcon from '@mui/icons-material/Storefront';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';
import { StatusBadge } from '../common/StatusBadge';

const HeaderBar = styled.header<{ $mode: 'light' | 'dark' }>`
  height: 64px;
  background: ${({ $mode }) => tokens[$mode].glassBg};
  border-bottom: 1px solid ${({ $mode }) => tokens[$mode].border};
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const Header: React.FC = () => {
  const { user, tenants, activeTenant, setActiveTenant, logout } = useAuthStore();
  const { themeMode, toggleTheme } = useUiStore();

  return (
    <HeaderBar $mode={themeMode} className="no-print">
      <LeftSection>
        {tenants.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <Select
              value={activeTenant?.id || ''}
              onChange={(e) => {
                const selected = tenants.find((t) => t.id === e.target.value);
                if (selected) setActiveTenant(selected);
              }}
              displayEmpty
              sx={{
                bgcolor: themeMode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(20,26,38,0.8)',
                borderRadius: 2,
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {tenants.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {t.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
                      NIF: {t.taxId}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
          <StorefrontIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Filial Principal
          </Typography>
        </Box>
      </LeftSection>

      <RightSection>
        <Tooltip title="Motor Fiscal AGT Conforme (RSA-SHA1)">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <VerifiedUserIcon sx={{ color: tokens[themeMode].status.ok, fontSize: 18 }} />
            <StatusBadge status="ok" label="AGT Conforme" size="small" />
          </Box>
        </Tooltip>

        <IconButton onClick={toggleTheme} size="small" sx={{ color: 'text.primary' }}>
          {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: tokens[themeMode].emeraldPrimary,
              fontSize: '0.875rem',
              fontWeight: 700,
            }}
          >
            {user?.fullName?.charAt(0) || 'U'}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {user?.fullName || 'Utilizador Kudiba'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {user?.email || 'admin@kudiba.ao'}
            </Typography>
          </Box>
        </Box>

        <Tooltip title="Terminar Sessão">
          <IconButton onClick={logout} size="small" color="error">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </RightSection>
    </HeaderBar>
  );
};
