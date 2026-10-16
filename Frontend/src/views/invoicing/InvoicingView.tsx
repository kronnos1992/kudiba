import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { tokens } from '../../theme/designTokens';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';

const A4Document = styled.div`
  width: 100%;
  max-width: 680px;
  margin: 0 auto;
  background: #ffffff;
  color: #000000;
  padding: 32px;
  font-family: var(--font-primary, sans-serif);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

export const InvoicingView: React.FC = () => {
  const themeMode = useUiStore((s) => s.themeMode);
  const { activeTenant } = useAuthStore();

  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const mockDocuments = [
    {
      id: 'FT 2026/00142',
      type: 'FT',
      client: 'Sonangol Distribuidora E.P.',
      nif: '5401239871',
      date: '16/10/2026',
      subtotal: 4254385.96,
      tax: 595614.04,
      retention: 276535.09,
      total: 4850000.0,
      hash4: '7a9f',
      status: 'ok',
      statusText: 'Certificada AGT',
    },
    {
      id: 'FR 2026/00891',
      type: 'FR',
      client: 'Consumidor Final',
      nif: '999999999',
      date: '16/10/2026',
      subtotal: 10921.05,
      tax: 1528.95,
      retention: 0.0,
      total: 12450.0,
      hash4: 'c12e',
      status: 'ok',
      statusText: 'Quitada',
    },
    {
      id: 'FT 2026/00141',
      type: 'FT',
      client: 'Unitel S.A.',
      nif: '5409871234',
      date: '15/10/2026',
      subtotal: 1596491.23,
      tax: 223508.77,
      retention: 103771.93,
      total: 1820000.0,
      hash4: 'f5d8',
      status: 'ok',
      statusText: 'Certificada AGT',
    },
    {
      id: 'NC 2026/00018',
      type: 'NC',
      client: 'ENSA Seguros',
      nif: '5405551234',
      date: '14/10/2026',
      subtotal: -83333.33,
      tax: -11666.67,
      retention: 0.0,
      total: -95000.0,
      hash4: '2b4c',
      status: 'medio',
      statusText: 'Nota de Crédito',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Faturação &amp; Gestão Fiscal AGT
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Emissão de FT, FR, NC e ND em conformidade com o Decreto Presidencial 71/25
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddCircleIcon />}
          sx={{
            bgcolor: tokens[themeMode].emeraldPrimary,
            '&:hover': { bgcolor: tokens[themeMode].emeraldLight },
            fontWeight: 700,
          }}
        >
          Criar Novo Documento
        </Button>
      </Box>

      <GlassCard sx={{ p: 2.5 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Nº Documento</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cliente</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>IVA (14%)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Total (Kz)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Estado</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockDocuments.map((doc) => (
                <TableRow key={doc.id} hover>
                  <TableCell>
                    <Chip
                      label={doc.type}
                      size="small"
                      sx={{
                        fontWeight: 800,
                        bgcolor: doc.type === 'NC' ? '#DC262620' : `${tokens[themeMode].emeraldPrimary}20`,
                        color: doc.type === 'NC' ? '#DC2626' : tokens[themeMode].emeraldPrimary,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {doc.id}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{doc.client}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'var(--font-mono)' }}>
                      NIF: {doc.nif}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{doc.date}</TableCell>
                  <TableCell align="right">
                    <KzAmount value={doc.subtotal} />
                  </TableCell>
                  <TableCell align="right">
                    <KzAmount value={doc.tax} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    <KzAmount value={doc.total} />
                  </TableCell>
                  <TableCell align="center">
                    <StatusBadge status={doc.status as 'ok' | 'medio'} label={doc.statusText} />
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      startIcon={<VisibilityIcon />}
                      onClick={() => setSelectedDoc(doc)}
                      sx={{ fontWeight: 600 }}
                    >
                      A4
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </GlassCard>

      {/* Modal de Pré-visualização A4 AGT */}
      <Dialog
        open={Boolean(selectedDoc)}
        onClose={() => setSelectedDoc(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 4, bgcolor: '#F8FAFC' }}>
          {selectedDoc && (
            <A4Document className="invoice-a4-page">
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0D5C3A' }}>
                    {activeTenant?.name || 'KUDIBA COMÉRCIO GERAL, LDA'}
                  </Typography>
                  <Typography variant="body2">Luanda, Angola</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)' }}>
                    NIF: {activeTenant?.taxId || '5417892341'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {selectedDoc.id}
                  </Typography>
                  <Typography variant="body2">Data: {selectedDoc.date}</Typography>
                  <Typography variant="caption" sx={{ color: '#0D5C3A', fontWeight: 700 }}>
                    ORIGINAL
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  DADOS DO CLIENTE
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {selectedDoc.client}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)' }}>
                  NIF: {selectedDoc.nif}
                </Typography>
              </Box>

              <Table size="small" sx={{ mb: 3 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#F1F5F9' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Descrição</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Taxa IVA</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Valor (Kz)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Prestação de Serviços Especializados / Fornecimento</TableCell>
                    <TableCell align="right">14%</TableCell>
                    <TableCell align="right">
                      <KzAmount value={selectedDoc.subtotal} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
                <Box sx={{ width: 260, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Incidência:</Typography>
                    <KzAmount value={selectedDoc.subtotal} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">Total IVA (14%):</Typography>
                    <KzAmount value={selectedDoc.tax} />
                  </Box>
                  {selectedDoc.retention > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                      <Typography variant="body2">Retenção (6,5%):</Typography>
                      <KzAmount value={selectedDoc.retention} />
                    </Box>
                  )}
                  <Divider />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Total Documento:</Typography>
                    <KzAmount value={selectedDoc.total} />
                  </Box>
                </Box>
              </Box>

              <Box sx={{ borderTop: '1px solid #CBD5E1', pt: 2, textAlign: 'center', fontSize: '11px', color: '#64748B' }}>
                <Typography variant="caption" sx={{ display: 'block', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {selectedDoc.hash4}-Processado por programa validado nº 000/AGT/2026 Kudiba ERP
                </Typography>
                <Typography variant="caption">
                  Os bens/serviços foram colocados à disposição do adquirente na data do documento.
                </Typography>
              </Box>
            </A4Document>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setSelectedDoc(null)}>Fechar</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => window.print()}
            sx={{ bgcolor: tokens[themeMode].emeraldPrimary }}
          >
            Imprimir A4
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
