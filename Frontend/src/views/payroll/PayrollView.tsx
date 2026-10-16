import React from 'react';
import { Box, Typography } from '@mui/material';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const PayrollView: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Recursos Humanos &amp; Processamento Salarial (KudibaPayroll)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Tabelas oficiais de IRT de Angola, Segurança Social (INSS 3% e 8%) e ficheiros PS2
        </Typography>
      </Box>

      <GlassCard sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Folha do Mês Corrente (Outubro 2026)
          </Typography>
          <StatusBadge status="ok" label="Apuramento Conforme IRT/INSS" />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Contratos ativos: 28 colaboradores
        </Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Massa Salarial Ilíquida:</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={11450000.0} /></Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Retenção de IRT:</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={1250000.0} /></Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>INSS Total (11%):</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={1259500.0} /></Typography>
          </Box>
        </Box>
      </GlassCard>
    </Box>
  );
};
