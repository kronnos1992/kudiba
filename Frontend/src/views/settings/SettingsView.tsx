import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import KeyIcon from '@mui/icons-material/Key';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';

export const SettingsView: React.FC = () => {
  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Configurações Fiscais, Certificação &amp; SAF-T (AO)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Gestão de chaves criptográficas RSA-2048, registo de produtor de software e exportação XML
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <GlassCard sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <KeyIcon sx={{ color: '#0D5C3A' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Chave Privada RSA-2048 (Assinatura AGT)
              </Typography>
            </Box>
            <StatusBadge status="ok" label="Chave Ativa & Conforme" />
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Versão da Chave: 1 • Algoritmo: SHA1withRSA conforme requisitos técnicos da AGT
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', display: 'block', bgcolor: 'rgba(0,0,0,0.04)', p: 1.5, borderRadius: 1 }}>
            Chave Pública registada no portal da AGT para verificação do ficheiro SAF-T.
          </Typography>
        </GlassCard>

        <GlassCard sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Exportação do Ficheiro SAF-T (AO) Mensal
            </Typography>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              sx={{ fontWeight: 700 }}
              onClick={() => alert('Download do ficheiro SAF-T AO 2026 XML iniciado.')}
            >
              Exportar XML AGT
            </Button>
          </Box>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Estrutura XML em conformidade com o Decreto Presidencial 385/20 e validações do motor fiscal Kudiba.
          </Typography>
        </GlassCard>
      </Box>
    </Box>
  );
};
