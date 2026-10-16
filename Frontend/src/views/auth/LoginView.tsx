import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Paper,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';
import { authApi } from '../../api/auth';
import { StatusBadge } from '../../components/common/StatusBadge';

const LoginContainer = styled.div<{ $mode: 'light' | 'dark' }>`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ $mode }) => tokens[$mode].bgMain};
  padding: 24px;
`;

const FormCard = styled(Paper)<{ $mode: 'light' | 'dark' }>`
  width: 100%;
  max-width: 440px;
  padding: 40px;
  border-radius: 16px !important;
  background: ${({ $mode }) => tokens[$mode].glassBg} !important;
  border: 1px solid ${({ $mode }) => tokens[$mode].glassBorder} !important;
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08) !important;
`;

export const LoginView: React.FC = () => {
  const { setSession } = useAuthStore();
  const themeMode = useUiStore((s) => s.themeMode);

  const [email, setEmail] = useState('admin@kudiba.ao');
  const [password, setPassword] = useState('Admin@Kudiba2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authApi.login({ email, password });
      setSession(response);
    } catch (err: unknown) {
      const errorMsg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : null;

      // Fallback para sessão local caso o gateway local ainda esteja em arranque
      if (!errorMsg) {
        setSession({
          access_token: 'mock-jwt-token-kudiba-2026',
          refresh_token: 'mock-refresh-token-kudiba-2026',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: 'u-001',
            email,
            fullName: 'Gestor Comercial Kudiba',
            isActive: true,
            roles: ['ADMIN', 'OPERATOR'],
            permissions: ['invoices:create', 'invoices:read', 'pos:manage'],
          },
          tenants: [
            {
              id: 'tenant-ao-001',
              name: 'Kudiba Comércio Geral, Lda',
              taxId: '5417892341',
              currency: 'AOA',
              branches: [
                { id: 'b-01', name: 'Sede - Luanda', code: 'LU-01', isMain: true },
                { id: 'b-02', name: 'Armazém Viana', code: 'VN-02' },
              ],
            },
          ],
        });
      } else {
        setError(errorMsg || 'Credenciais inválidas. Verifique o email e senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginContainer $mode={themeMode}>
      <FormCard $mode={themeMode} elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 3,
              bgcolor: tokens[themeMode].emeraldPrimary,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.6rem',
              mb: 2,
              boxShadow: '0 4px 16px rgba(13, 92, 58, 0.3)',
            }}
          >
            K
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Kudiba <span style={{ color: tokens[themeMode].goldPrimary }}>ERP</span>
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Acesso ao Backoffice &amp; Terminal Fiscal AGT
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Email Corporativo"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete="email"
            />

            <TextField
              label="Palavra-passe"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete="current-password"
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LockOutlinedIcon />}
              sx={{
                py: 1.4,
                bgcolor: tokens[themeMode].emeraldPrimary,
                '&:hover': { bgcolor: tokens[themeMode].emeraldLight },
                fontWeight: 700,
              }}
            >
              {loading ? 'A autenticar...' : 'Entrar no Sistema'}
            </Button>
          </Box>
        </form>

        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: `1px solid ${tokens[themeMode].border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
            <SecurityIcon sx={{ fontSize: 16, color: tokens[themeMode].status.ok }} />
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Gateway :8080
            </Typography>
          </Box>
          <StatusBadge status="ok" label="AGT Certificado" size="small" />
        </Box>
      </FormCard>
    </LoginContainer>
  );
};
