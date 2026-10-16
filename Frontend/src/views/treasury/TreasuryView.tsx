import React from 'react';
import { Box, Typography } from '@mui/material';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const TreasuryView: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Tesouraria, Caixas Físicos &amp; Recibos RC
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Sessões de caixa, contas bancárias (IBAN AO06) e quitação de faturas a prazo
        </Typography>
      </Box>

      <GlassCard sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Caixa Principal (Sessão Aberta)
          </Typography>
          <StatusBadge status="ok" label="Fecho Cego Ativo" />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Operador: Gestor Comercial Kudiba • Abertura: 08:30:00
        </Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Saldo em Caixa (Dinheiro):</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={345200.0} /></Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Multicaixa (TPA):</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={1280450.0} /></Typography>
          </Box>
        </Box>
      </GlassCard>
    </Box>
  );
};
