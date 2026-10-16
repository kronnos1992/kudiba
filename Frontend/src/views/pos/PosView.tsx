import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useUiStore } from '../../stores/uiStore';
import { useAuthStore } from '../../stores/authStore';
import { tokens } from '../../theme/designTokens';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';

interface CartItem {
  id: string;
  name: string;
  code: string;
  price: number;
  qty: number;
  taxRate: number;
}

const PosLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 24px;
  height: calc(100vh - 120px);

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const CartSidebar = styled.div`
  display: flex;
  flex-direction: column;
  padding: 24px;
  height: 100%;
`;

const ThermalPreview = styled.div`
  width: 280px;
  margin: 0 auto;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.35;
  color: #000000;
  background: #ffffff;
  padding: 16px;
  border: 1px dashed #cccccc;
`;

export const PosView: React.FC = () => {
  const themeMode = useUiStore((s) => s.themeMode);
  const { activeTenant } = useAuthStore();

  const [cart, setCart] = useState<CartItem[]>([
    { id: '1', name: 'Óleo Alimentar 1L', code: 'PROD-001', price: 1850.0, qty: 2, taxRate: 14 },
    { id: '2', name: 'Arroz Agulha 5Kg', code: 'PROD-002', price: 6200.0, qty: 1, taxRate: 14 },
    { id: '3', name: 'Leite Condensado 397g', code: 'PROD-003', price: 950.0, qty: 3, taxRate: 14 },
  ]);

  const [barcodeInput, setBarcodeInput] = useState('');
  const [ticketModalOpen, setTicketModalOpen] = useState(false);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const tax = subtotal * 0.14;
  const total = subtotal + tax;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setCart((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Artigo Barcode ${barcodeInput}`,
        code: barcodeInput,
        price: 2500.0,
        qty: 1,
        taxRate: 14,
      },
    ]);
    setBarcodeInput('');
  };

  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Terminal de Ponto de Venda (POS Balcão)
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Emissão direta de Fatura-Recibo (FR) com assinatura fiscal AGT instantânea
        </Typography>
      </Box>

      <PosLayout>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <GlassCard sx={{ p: 2.5 }}>
            <form onSubmit={handleAddItem}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  placeholder="Ler código de barras ou digitar nome do produto..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  fullWidth
                  autoFocus
                  sx={{
                    '& input': { fontFamily: 'var(--font-mono)' },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    bgcolor: tokens[themeMode].emeraldPrimary,
                    '&:hover': { bgcolor: tokens[themeMode].emeraldLight },
                    px: 3,
                    fontWeight: 700,
                  }}
                >
                  Adicionar
                </Button>
              </Box>
            </form>
          </GlassCard>

          <GlassCard sx={{ flex: 1, p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Artigo</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Preço Unit.</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Qtd</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cart.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                      <TableCell sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        {item.code}
                      </TableCell>
                      <TableCell align="right">
                        <KzAmount value={item.price} />
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        {item.qty}
                      </TableCell>
                      <TableCell align="right">
                        <KzAmount value={item.price * item.qty} />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cart.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        O carrinho do terminal está vazio.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </GlassCard>
        </Box>

        <CartSidebar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <ShoppingCartIcon sx={{ color: tokens[themeMode].emeraldPrimary }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Resumo da Venda
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Subtotal</Typography>
              <KzAmount value={subtotal} />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>IVA Geral (14%)</Typography>
              <KzAmount value={tax} />
            </Box>

            <Divider sx={{ my: 1 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>TOTAL A PAGAR</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: tokens[themeMode].emeraldPrimary }}>
                <KzAmount value={total} />
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={cart.length === 0}
              onClick={() => setTicketModalOpen(true)}
              startIcon={<CheckCircleIcon />}
              sx={{
                bgcolor: tokens[themeMode].emeraldPrimary,
                '&:hover': { bgcolor: tokens[themeMode].emeraldLight },
                py: 1.5,
                fontWeight: 800,
                fontSize: '1rem',
              }}
            >
              Emitir FR &amp; Finalizar
            </Button>
          </Box>
        </CartSidebar>
      </PosLayout>

      <Dialog
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogContent sx={{ p: 2 }}>
          <ThermalPreview className="thermal-receipt">
            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, fontFamily: 'inherit' }}>
                {activeTenant?.name || 'KUDIBA COMÉRCIO GERAL'}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontFamily: 'inherit' }}>
                NIF: {activeTenant?.taxId || '5417892341'}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontFamily: 'inherit' }}>
                FATURA-RECIBO: FR 2026/00912
              </Typography>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000000', borderStyle: 'dashed' }} />

            {cart.map((item) => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <span>{item.qty}x {item.name.substring(0, 16)}</span>
                <span>{((item.price * item.qty)).toFixed(2)}</span>
              </Box>
            ))}

            <Divider sx={{ my: 1, borderColor: '#000000', borderStyle: 'dashed' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>TOTAL (Kz):</span>
              <span>{total.toFixed(2)}</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span>IVA Incluído (14%):</span>
              <span>{tax.toFixed(2)}</span>
            </Box>

            <Divider sx={{ my: 1, borderColor: '#000000', borderStyle: 'dashed' }} />

            <Box sx={{ textAlign: 'center', mt: 1, fontSize: '10px' }}>
              <Typography variant="caption" sx={{ display: 'block', fontFamily: 'inherit', fontWeight: 700 }}>
                4 CARACTERES DO HASH: b4x8
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontFamily: 'inherit', mt: 0.5 }}>
                Processado por Software Certificado nº 000/AGT/2026 Kudiba
              </Typography>
            </Box>
          </ThermalPreview>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTicketModalOpen(false)}>Fechar</Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ bgcolor: tokens[themeMode].emeraldPrimary }}
          >
            Imprimir Talão 80mm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
