import React, { useState } from 'react';
import { ShoppingCart, Trash2, Printer, CheckCircle2, X } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
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

export const PosView: React.FC = () => {
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
    <div className="space-y-6">
      <div className="no-print">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Terminal de Ponto de Venda (POS Balcão)
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Emissão direta de Fatura-Recibo (FR) com assinatura fiscal AGT instantânea
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="p-4">
            <form onSubmit={handleAddItem} className="flex gap-3">
              <input
                type="text"
                placeholder="Ler código de barras ou digitar nome do produto..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                autoFocus
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-xs transition-all cursor-pointer"
              >
                Adicionar
              </button>
            </form>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Artigo</th>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                    <th className="py-2.5 px-3 text-center">Qtd</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    <th className="py-2.5 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {cart.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {item.name}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.code}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <KzAmount value={item.price} />
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        {item.qty}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <KzAmount value={item.price * item.qty} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        O carrinho do terminal está vazio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <div>
          <GlassCard className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Resumo da Venda
              </h3>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <KzAmount value={subtotal} />
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>IVA Geral (14%)</span>
                <KzAmount value={tax} />
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="font-extrabold text-slate-900 dark:text-white uppercase text-sm">
                  Total a Pagar
                </span>
                <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                  <KzAmount value={total} />
                </span>
              </div>
            </div>

            <button
              disabled={cart.length === 0}
              onClick={() => setTicketModalOpen(true)}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Emitir FR &amp; Finalizar</span>
            </button>
          </GlassCard>
        </div>
      </div>

      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-900 relative">
            <button
              onClick={() => setTicketModalOpen(false)}
              className="no-print absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="ticket-80mm font-mono text-xs text-black border border-dashed border-slate-300 p-4 rounded-lg bg-white my-3">
              <div className="text-center mb-3">
                <p className="font-bold text-sm uppercase">
                  {activeTenant?.name || 'KUDIBA COMÉRCIO GERAL'}
                </p>
                <p>NIF: {activeTenant?.taxId || '5001234567'}</p>
                <p className="font-semibold mt-1">FATURA-RECIBO: FR 2026/00912</p>
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="space-y-1">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.qty}x {item.name.substring(0, 16)}</span>
                    <span>{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="flex justify-between font-bold">
                <span>TOTAL (Kz):</span>
                <span>{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>IVA Incluído (14%):</span>
                <span>{tax.toFixed(2)}</span>
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="text-center mt-2 text-[10px] space-y-0.5">
                <p className="font-bold">4 CARACTERES DO HASH: b4x8</p>
                <p>Processado por Software Certificado nº 000/AGT/2026 Kudiba</p>
              </div>
            </div>

            <div className="no-print flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setTicketModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Talão 80mm</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
