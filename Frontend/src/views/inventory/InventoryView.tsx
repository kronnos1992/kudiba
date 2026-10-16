import React from 'react';
import { Box, Typography } from '@mui/material';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

export const InventoryView: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Gestão de Artigos, Lotes &amp; Armazéns
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Valorização de stock por Custo Médio Ponderado (CMP) e armazéns via KudibaInventory
        </Typography>
      </Box>

      <GlassCard sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Depósitos &amp; Armazéns Ativos
          </Typography>
          <StatusBadge status="ok" label="Inventário Sincronizado" />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
          Armazém Central (Viana) • Depósito Loja (Talatona)
        </Typography>
        <Box sx={{ display: 'flex', gap: 4 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Valorização Patrimonial (CMP):</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}><KzAmount value={42850900.0} /></Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Total de Referências:</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>1.420 artigos</Typography>
          </Box>
        </Box>
      </GlassCard>
    </Box>
  );
};
