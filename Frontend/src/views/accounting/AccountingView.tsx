import React from 'react';
import { Box, Typography } from '@mui/material';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const AccountingView: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Contabilidade Geral &amp; PGC Angolano
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Plano Geral de Contabilidade (Classes 1 a 8), balancetes de 4 e 6 colunas e partidas dobradas
        </Typography>
      </Box>

      <GlassCard sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Balancete de Verificação (Exercício 2026)
          </Typography>
          <StatusBadge status="ok" label="Partidas Dobradas Equilibradas" />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Contabilidade automatizada via lançamentos em tempo real
        </Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total Débitos:</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={68420000.0} /></Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total Créditos:</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={68420000.0} /></Typography>
          </Box>
        </Box>
      </GlassCard>
    </Box>
  );
};
