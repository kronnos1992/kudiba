import React from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SecurityIcon from '@mui/icons-material/Security';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { tokens } from '../../theme/designTokens';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const KPICard = styled(GlassCard)`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

export const DashboardView: React.FC<{ onNavigate: (module: string) => void }> = ({ onNavigate }) => {
  const { activeTenant } = useAuthStore();
  const themeMode = useUiStore((s) => s.themeMode);

  const mockRecentInvoices = [
    { id: 'FT 2026/00142', client: 'Sonangol E.P.', date: '16/10/2026', total: 4850000.0, status: 'ok', statusText: 'Assinada AGT' },
    { id: 'FR 2026/00891', client: 'Consumidor Final', date: '16/10/2026', total: 12450.0, status: 'ok', statusText: 'Paga' },
    { id: 'FT 2026/00141', client: 'Unitel S.A.', date: '15/10/2026', total: 1820000.0, status: 'ok', statusText: 'Assinada AGT' },
    { id: 'FT 2026/00140', client: 'ENSA Seguros', date: '15/10/2026', total: 950000.0, status: 'medio', statusText: 'Pendente Retenção' },
  ];

  return (
    <Box>
      <PageHeader>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Painel Executivo Financeiro
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {activeTenant?.name || 'Kudiba Organização'} • NIF {activeTenant?.taxId || '5417892341'}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<PointOfSaleIcon />}
            onClick={() => onNavigate('pos')}
            sx={{
              borderColor: tokens[themeMode].emeraldPrimary,
              color: tokens[themeMode].emeraldPrimary,
              fontWeight: 700,
            }}
          >
            Terminal POS
          </Button>

          <Button
            variant="contained"
            startIcon={<AddCircleIcon />}
            onClick={() => onNavigate('invoicing')}
            sx={{
              bgcolor: tokens[themeMode].emeraldPrimary,
              '&:hover': { bgcolor: tokens[themeMode].emeraldLight },
              fontWeight: 700,
            }}
          >
            Emitir Fatura
          </Button>
        </Box>
      </PageHeader>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                Faturação do Mês
              </Typography>
              <TrendingUpIcon sx={{ color: tokens[themeMode].emeraldPrimary, fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              <KzAmount value={18420500.0} />
            </Typography>
            <Typography variant="caption" sx={{ color: tokens[themeMode].status.ok, fontWeight: 600 }}>
              +14,2% face ao mês anterior
            </Typography>
          </KPICard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                IVA Liquidado (14%)
              </Typography>
              <AccountBalanceIcon sx={{ color: tokens[themeMode].goldPrimary, fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              <KzAmount value={2578870.0} />
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Apuramento SAF-T em curso
            </Typography>
          </KPICard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                Retenção na Fonte (6,5%)
              </Typography>
              <ReceiptIcon sx={{ color: tokens[themeMode].emeraldPrimary, fontSize: 20 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              <KzAmount value={315250.0} />
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Crédito tributário dedutível
            </Typography>
          </KPICard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                Certificação AGT
              </Typography>
              <SecurityIcon sx={{ color: tokens[themeMode].status.ok, fontSize: 20 }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label="RSA-2048 Válido"
                size="small"
                sx={{
                  bgcolor: `${tokens[themeMode].emeraldPrimary}20`,
                  color: tokens[themeMode].emeraldPrimary,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
              Hash J-1 Chaining: OK
            </Typography>
          </KPICard>
        </Grid>
      </Grid>

      <GlassCard sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Últimos Documentos Fiscais Emitidos
          </Typography>
          <Button size="small" onClick={() => onNavigate('invoicing')} sx={{ fontWeight: 600 }}>
            Ver Todos
          </Button>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Nº Documento</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Total (Kz)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Estado Fiscal</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockRecentInvoices.map((inv) => (
                <TableRow key={inv.id} hover>
                  <TableCell sx={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {inv.id}
                  </TableCell>
                  <TableCell>{inv.client}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{inv.date}</TableCell>
                  <TableCell align="right">
                    <KzAmount value={inv.total} />
                  </TableCell>
                  <TableCell align="center">
                    <StatusBadge
                      status={inv.status as 'ok' | 'medio'}
                      label={inv.statusText}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GlassCard>
    </Box>
  );
};
