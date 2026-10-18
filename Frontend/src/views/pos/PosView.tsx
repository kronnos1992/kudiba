import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Trash2,
  Printer,
  CheckCircle2,
  X,
  Search,
  Plus,
  Minus,
  AlertCircle,
  Clock,
  Loader2,
  Unlock,
  Lock,
  ArrowDownCircle,
  LayoutDashboard,
  FileText,
  Store,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { inventoryApi, Product } from '../../api/inventory';
import { invoicingApi, Invoice, PosDailyReportResult, PosZReportSummary } from '../../api/invoicing';
import { treasuryApi, MovementType, PosPanelResponse } from '../../api/treasury';

interface CartItem {
  productId: string;
  code: string;
  name: string;
  unitPrice: number;
  qty: number;
  taxRate: number;
  isService: boolean;
  exemptionCode?: string | null;
}

export const PosView: React.FC = () => {
  const { activeTenant, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('NUMERARIO');
  const [customerName, setCustomerName] = useState<string>('Consumidor Final');
  const [customerNif, setCustomerNif] = useState<string>('999999999');
  const [seriesCode, setSeriesCode] = useState<string>('2026A');
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');

  // Modais de Gestão de Caixa no POS
  const [openSessionModal, setOpenSessionModal] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('50000.00');
  const [closeSessionModal, setCloseSessionModal] = useState(false);
  const [closingCountedInput, setClosingCountedInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementTypeInput, setMovementTypeInput] = useState<MovementType>('SUPPLY');
  const [movementAmountInput, setMovementAmountInput] = useState('');
  const [movementReasonInput, setMovementReasonInput] = useState('');

  // Modais de Relatórios POS
  const [issuedInvoice, setIssuedInvoice] = useState<Invoice | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [leituraXText, setLeituraXText] = useState<string | null>(null);
  const [fechoZResult, setFechoZResult] = useState<PosDailyReportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Painel POS, abas e sessão do gestor
  const [posTab, setPosTab] = useState<'venda' | 'painel' | 'relatorios'>('venda');
  const [panelDate, setPanelDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [posOpenModal, setPosOpenModal] = useState(false);
  const [posCloseModal, setPosCloseModal] = useState(false);
  const [posNotesInput, setPosNotesInput] = useState('');
  const [zReports, setZReports] = useState<PosZReportSummary[]>([]);
  const [loadingZReports, setLoadingZReports] = useState(false);

  const roles = (user?.roles ?? []).map((r) => r.toUpperCase());
  const isManager = roles.length === 0 || roles.some((r) => r !== 'OPERADOR_CAIXA');

  // Queries
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({    queryKey: ['pos_products', activeTenant?.id],
    queryFn: () => inventoryApi.listProducts({ limit: 150 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ['pos_series', activeTenant?.id],
    queryFn: () => invoicingApi.listSeries(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: registers = [] } = useQuery({
    queryKey: ['pos_registers', activeTenant?.id],
    queryFn: () => treasuryApi.listRegisters(),
    enabled: Boolean(activeTenant?.id),
  });

  const activeRegister =
    registers.find((r) => r.id === selectedRegisterId) ||
    registers.find((r) => r.is_active) ||
    registers[0];

  const { data: currentSession } = useQuery({
    queryKey: ['pos_current_session', activeRegister?.id],
    queryFn: () => treasuryApi.getCurrentSession(activeRegister!.id),
    enabled: Boolean(activeRegister?.id),
  });

  const { data: currentPosSession } = useQuery({
    queryKey: ['pos_session_current', activeRegister?.id],
    queryFn: () => treasuryApi.getCurrentPosSession(activeRegister!.id),
    enabled: Boolean(activeRegister?.id),
  });

  const { data: posPanel, isLoading: isLoadingPanel, refetch: refetchPanel } = useQuery<PosPanelResponse>({
    queryKey: ['pos_panel', activeTenant?.id, activeRegister?.id, panelDate],
    queryFn: () =>
      treasuryApi.getPosPanel({
        register_id: isManager ? undefined : activeRegister?.id,
        date: panelDate,
      }),
    enabled: Boolean(activeTenant?.id) && posTab === 'painel',
  });

  // Totais do carrinho
  const subtotal = cart.reduce((acc, item) => acc + item.unitPrice * item.qty, 0);
  const totalTax = cart.reduce((acc, item) => acc + item.unitPrice * item.qty * (item.taxRate / 100), 0);
  const totalGross = subtotal + totalTax;

  // Filtragem de catálogo
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.barcode && p.barcode.includes(productSearch))
  );

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      const price = Number(product.sale_price) || 0;
      const taxRate =
        product.tax_percentage !== undefined && product.tax_percentage !== null
          ? Number(product.tax_percentage)
          : 14;

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          code: product.code,
          name: product.name,
          unitPrice: price,
          qty: 1,
          taxRate,
          isService: product.product_type === 'S' || !product.is_stockable,
          exemptionCode: product.exemption_reason_code,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Mutações de Sessão de Caixa (Tesouraria)
  const openSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeRegister) {
        throw new Error('Nenhum posto de caixa selecionado.');
      }
      const existing = await treasuryApi.getCurrentSession(activeRegister.id);
      if (existing && existing.status === 'OPEN') {
        throw new Error('Este caixa já possui uma sessão aberta. Feche o turno atual antes de abrir outro.');
      }
      return await treasuryApi.openSession({
        register_id: activeRegister.id,
        operator_user_id: user?.id || user?.email || 'pos-operator',
        opening_balance: openingBalanceInput || '0.00',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      setOpenSessionModal(false);
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      setOpenSessionModal(false);
      setErrorMessage(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Este caixa já possui uma sessão aberta. Feche o turno atual antes de abrir outro.'
      );
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      if (!currentSession) {
        throw new Error('Não existe sessão aberta para encerrar.');
      }
      return await treasuryApi.closeSession(currentSession.id, {
        closing_balance_counted: closingCountedInput || '0.00',
        notes: closingNotesInput || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      setCloseSessionModal(false);
      setClosingCountedInput('');
      setClosingNotesInput('');
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          'Erro ao fechar sessão de caixa.'
      );
    },
  });

  const recordMovementMutation = useMutation({
    mutationFn: async () => {
      if (!currentSession) {
        throw new Error('Abra uma sessão de caixa antes de registar movimentos.');
      }
      return await treasuryApi.recordMovement({
        session_id: currentSession.id,
        movement_type: movementTypeInput,
        amount: movementAmountInput,
        reason: movementReasonInput || 'Movimento de caixa POS',
        operator_user_id: user?.id || user?.email || 'pos-operator',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
      setMovementModalOpen(false);
      setMovementAmountInput('');
      setMovementReasonInput('');
    },
    onError: (err: any) => {
      setErrorMessage(err?.response?.data?.detail || 'Erro ao registar movimento de caixa.');
    },
  });

  // Mutação para Emissão de Fatura-Recibo (FR) + Integração Tesouraria & Inventário
  const issueFrMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const currentYear = new Date().getFullYear();
      const activeSeries =
        seriesList.find((s) => s.documentType === 'FR' && s.isActive)?.seriesCode ||
        seriesCode ||
        '2026A';

      const cartSnapshot = [...cart];
      const customerNameVal = customerName.trim() || 'Consumidor Final';
      const customerNifVal = customerNif.trim() || '999999999';

      const payload = {
        tenantId: activeTenant!.id,
        documentType: 'FR',
        seriesCode: activeSeries,
        fiscalYear: currentYear,
        customerName: customerNameVal,
        customerNif: customerNifVal,
        customerAddress: activeTenant?.address_detail || 'Venda ao Balcão (POS)',
        customerCity: activeTenant?.city || 'Luanda',
        customerCountry: activeTenant?.country || 'AO',
        paymentMethods: [selectedPaymentMethod],
        lines: cartSnapshot.map((item) => ({
          productCode: item.code,
          description: item.name,
          quantity: item.qty,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          taxExemptionCode: item.taxRate === 0 ? item.exemptionCode || 'M02' : undefined,
          isService: item.isService,
        })),
      };

      const issued = await invoicingApi.issueInvoice(payload);
      const invoiceId = issued.invoiceId || issued.id || '';

      // 1. Registar entrada na Sessão de Caixa aberta (Tesouraria)
      if (currentSession?.status === 'OPEN') {
        try {
          await treasuryApi.recordMovement({
            session_id: currentSession.id,
            movement_type: 'SALE_RECEIPT',
            amount: Number(issued.grossTotal || totalGross).toFixed(2),
            reason: `Venda POS ${issued.documentNumber} (${selectedPaymentMethod})`,
            operator_user_id: user?.id || user?.email || 'pos-operator',
          });
        } catch {
          // Segue sem bloquear o talão fiscal já assinado
        }
      }

      // 2. Abater stock no Inventário para artigos movimentáveis
      try {
        await inventoryApi.processInvoiceIssued({
          invoiceId,
          tenantId: activeTenant!.id,
          documentNumber: issued.documentNumber,
          documentType: 'FR',
          lines: cartSnapshot.map((item, idx) => ({
            lineNumber: idx + 1,
            productCode: item.code,
            description: item.name,
            quantity: item.qty,
            unitPrice: item.unitPrice,
          })),
        });
      } catch {
        // Segue sem bloquear o talão fiscal já assinado
      }

      // 3. Obter o documento fiscal completo (ou construir fallback completo com linhas)
      let fullInvoice: Invoice;
      try {
        fullInvoice = await invoicingApi.getInvoice(invoiceId);
      } catch {
        fullInvoice = {
          id: invoiceId,
          tenantId: activeTenant!.id,
          issuerNif: activeTenant?.taxId || '',
          issuerAddress: activeTenant?.address_detail || 'Luanda, Angola',
          issuerCity: activeTenant?.city || 'Luanda',
          issuerCountry: activeTenant?.country || 'AO',
          seriesId: '',
          documentNumber: issued.documentNumber,
          sequenceNumber: issued.sequenceNumber,
          documentType: 'FR',
          customerName: customerNameVal,
          customerNif: customerNifVal,
          paymentMethods: [selectedPaymentMethod],
          currency: 'AOA',
          netTotal: issued.netTotal,
          taxTotal: issued.taxTotal,
          grossTotal: issued.grossTotal,
          withholdingTotal: issued.withholdingTotal,
          stampDutyTotal: issued.stampDutyTotal,
          amountDue: issued.amountDue,
          hashSha256: issued.hashSha256,
          signatureRsaBase64: issued.signatureRsaBase64,
          validationChars: issued.validationChars,
          keyVersion: '1',
          isContingency: issued.isContingency,
          taxRegimeCode: 'GERAL',
          issuedAt: issued.issuedAt,
          systemEntryDate: issued.systemEntryDate,
          createdAt: issued.issuedAt,
          lines: cartSnapshot.map((item, idx) => ({
            lineNumber: idx + 1,
            productCode: item.code,
            description: item.name,
            quantity: item.qty,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            lineTotal: item.unitPrice * item.qty * (1 + item.taxRate / 100),
          })),
        };
      }

      return fullInvoice;
    },
    onSuccess: (data) => {
      setIssuedInvoice(data);
      setTicketModalOpen(true);
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['pos_products'] });
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        'Erro ao emitir Fatura-Recibo fiscal.';
      setErrorMessage(msg);
    },
  });

  // Sessão POS (turno do gestor)
  const openPosSessionMutation = useMutation({
    mutationFn: async () => {
      if (!activeRegister) {
        throw new Error('Nenhum posto de caixa selecionado.');
      }
      return await treasuryApi.openPosSession({
        register_id: activeRegister.id,
        notes: posNotesInput || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_session_current'] });
      setPosOpenModal(false);
      setPosNotesInput('');
    },
    onError: (err: any) => {
      setPosOpenModal(false);
      setErrorMessage(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          'Erro ao abrir a sessão POS.'
      );
    },
  });

  const closePosSessionMutation = useMutation({
    mutationFn: async () => {
      if (!currentPosSession) {
        throw new Error('Não existe sessão POS aberta.');
      }
      return await treasuryApi.closePosSession(currentPosSession.id, {
        notes: posNotesInput || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos_session_current'] });
      setPosCloseModal(false);
      setPosNotesInput('');
    },
    onError: (err: any) => {
      setPosCloseModal(false);
      setErrorMessage(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          'Erro ao fechar a sessão POS.'
      );
    },
  });

  const handleLoadZReports = async () => {
    try {
      setLoadingZReports(true);
      setErrorMessage(null);
      const terminalId = activeRegister?.code || undefined;
      const reports = await invoicingApi.getZReports({ posTerminalId: terminalId });
      setZReports(reports);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Erro ao carregar o histórico de Fechos Z.'
      );
    } finally {
      setLoadingZReports(false);
    }
  };

  // Leitura X (Relatório Térmico 80mm)
  const handleLeituraX = async () => {
    try {
      setErrorMessage(null);
      const terminalId = activeRegister?.code || seriesCode || 'POS-01';
      const text = await invoicingApi.getLeituraX(terminalId);
      setLeituraXText(text);
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Erro ao gerar relatório de Leitura X.'
      );
    }
  };

  // Mutação para Fecho Z Diário
  const fechoZMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      const terminalId = activeRegister?.code || seriesCode || 'POS-01';
      return await invoicingApi.postFechoZ({ posTerminalId: terminalId });
    },
    onSuccess: (data) => {
      setFechoZResult(data);
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.detail ||
          err?.response?.data?.error ||
          'Erro ao processar Fecho Z fiscal.'
      );
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Cabeçalho */}
      <div className="no-print flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Terminal de Ponto de Venda (POS Balcão)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Emissão direta de Fatura-Recibo (FR) com certificação AGT em tempo real e integração de caixa
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Posto / Caixa */}
          {registers.length > 0 && (
            <select
              value={activeRegister?.id || ''}
              onChange={(e) => setSelectedRegisterId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 max-w-full"
            >
              {registers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">
              {user?.fullName || user?.full_name || 'Operador'} •{' '}
              {currentSession?.status === 'OPEN' ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                  Sessão Aberta
                </span>
              ) : (
                <span className="text-amber-600 font-bold">Sem Sessão Ativa</span>
              )}
            </span>
          </div>

          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${
              currentPosSession?.status === 'OPEN'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Store className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Sessão POS:{' '}
              {currentPosSession?.status === 'OPEN' ? (
                <span className="font-bold">Aberta</span>
              ) : (
                <span className="text-amber-600 font-bold">Fechada</span>
              )}
            </span>
          </div>

          {/* Controlo da Sessão POS (apenas gestão) */}
          {isManager &&
            (currentPosSession?.status === 'OPEN' ? (
              <button
                onClick={() => setPosCloseModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-bold transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Encerrar Sessão POS</span>
              </button>
            ) : (
              activeRegister && (
                <button
                  onClick={() => setPosOpenModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5 shrink-0" />
                  <span>Abrir Sessão POS</span>
                </button>
              )
            ))}

          {currentSession?.status === 'OPEN' ? (
            <>
              <button
                onClick={() => setMovementModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Reforço / Sangria</span>
              </button>
              <button
                onClick={() => setCloseSessionModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Fechar Turno</span>
              </button>
            </>
          ) : (
            activeRegister && (
              <button
                onClick={() => {
                  if (!currentPosSession || currentPosSession.status !== 'OPEN') {
                    setErrorMessage(
                      'Peça ao gestor para abrir a Sessão POS antes de abrir o turno de caixa.'
                    );
                    return;
                  }
                  setOpenSessionModal(true);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  currentPosSession?.status === 'OPEN'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'border border-slate-300 dark:border-slate-700 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Unlock className="w-3.5 h-3.5 shrink-0" />
                <span>Abrir Turno</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Abas do POS */}
      <div className="no-print flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 w-full sm:w-auto overflow-x-auto">
        {(
          [
            { id: 'venda', label: 'Venda', icon: ShoppingCart },
            { id: 'painel', label: 'Painel dos POS', icon: LayoutDashboard },
            { id: 'relatorios', label: 'Relatórios X/Z', icon: FileText },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = posTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setPosTab(tab.id)}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex-1 sm:flex-none ${
                active
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div className="no-print p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="break-words">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid Principal do POS */}
      {posTab === 'venda' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 no-print">
        {/* Catálogo de Produtos (7 colunas) */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4 min-w-0">
          <GlassCard className="p-3 sm:p-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome, código ou código de barras..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 max-h-[380px] sm:max-h-[480px] lg:max-h-[580px] overflow-y-auto pr-1">
            {isLoadingProducts ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <span>A carregar catálogo de artigos...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                Nenhum artigo encontrado.
              </div>
            ) : (
              filteredProducts.map((prod) => (
                <button
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 hover:border-emerald-500 hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer min-w-0"
                >
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                      {prod.code}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                      {prod.name}
                    </h4>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 truncate">
                      <KzAmount value={Number(prod.sale_price) || 0} />
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold shrink-0">
                      +{prod.tax_percentage}%
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Carrinho & Checkout (5 colunas) */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          <GlassCard className="p-4 sm:p-5 flex flex-col justify-between lg:min-h-[580px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white">Talão Atual</h3>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {cart.length} artigo{cart.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Lista do Carrinho */}
              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 sm:py-12 text-center text-slate-400 text-sm">
                    O carrinho está vazio. Selecione artigos no catálogo.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.productId}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/50 flex items-center justify-between gap-2 sm:gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono truncate">
                          <KzAmount value={item.unitPrice} /> × {item.qty}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.productId)}
                          className="ml-0.5 sm:ml-1 p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Dados do Cliente e Pagamento */}
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Série FR</label>
                    <select
                      value={seriesCode}
                      onChange={(e) => setSeriesCode(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold"
                    >
                      {seriesList
                        .filter((s) => s.documentType === 'FR')
                        .map((s) => (
                          <option key={s.id} value={s.seriesCode}>
                            {s.seriesCode}
                          </option>
                        ))}
                      {seriesList.filter((s) => s.documentType === 'FR').length === 0 && (
                        <option value="2026A">2026A</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Cliente</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase">NIF</label>
                    <input
                      type="text"
                      value={customerNif}
                      onChange={(e) => setCustomerNif(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">
                    Meio de Pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['NUMERARIO', 'MULTICAIXA', 'TRANSFERENCIA'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(m)}
                        className={`py-1.5 px-1 text-[11px] sm:text-xs font-bold rounded-lg border transition-all cursor-pointer truncate ${
                          selectedPaymentMethod === m
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Totais e Botão de Emissão */}
            <div className="pt-4 mt-4 lg:mt-0 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal Líquido</span>
                  <KzAmount value={subtotal} />
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>IVA Total</span>
                  <KzAmount value={totalTax} />
                </div>
                <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>Total a Pagar</span>
                  <span className="text-lg sm:text-xl text-emerald-700 dark:text-emerald-400">
                    <KzAmount value={totalGross} />
                  </span>
                </div>
              </div>

              <button
                disabled={cart.length === 0 || issueFrMutation.isPending}
                onClick={() => issueFrMutation.mutate()}
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {issueFrMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>A Certificar junto da AGT...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Emitir FR &amp; Finalizar Venda</span>
                  </>
                )}
              </button>
            </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Painel dos POS */}
      {posTab === 'painel' && (
        <div className="no-print space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Painel dos POS</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Faturação por caixa e por usuário — movimentos de tesouraria do dia
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={panelDate}
                onChange={(e) => setPanelDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
              />
              <button
                onClick={() => refetchPanel()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>

          {isLoadingPanel ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <span>A carregar painel dos POS...</span>
            </div>
          ) : !posPanel ? (
            <div className="py-16 text-center text-slate-400">Sem dados do painel.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <GlassCard className="p-4">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Vendas do Dia</p>
                  <p className="text-lg sm:text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                    <KzAmount value={Number(posPanel.totals.sales_total) || 0} />
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {posPanel.totals.sales_count} venda{posPanel.totals.sales_count !== 1 ? 's' : ''}
                  </p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Caixas Abertos</p>
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {posPanel.totals.open_cash_sessions}/{posPanel.totals.active_registers}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">postos ativos</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Sessões POS Abertas</p>
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {posPanel.totals.open_pos_sessions}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">turnos de gestor</p>
                </GlassCard>
                <GlassCard className="p-4">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Reforços / Sangrias</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
                    <KzAmount value={Number(posPanel.totals.supplies_total) || 0} />
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                    <KzAmount value={Number(posPanel.totals.bleeds_total) || 0} /> em sangrias
                  </p>
                </GlassCard>
              </div>

              <GlassCard className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">Faturação por Caixa</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2 pr-3 font-bold">Caixa</th>
                        <th className="py-2 pr-3 font-bold">Estado</th>
                        <th className="py-2 pr-3 font-bold">Operador</th>
                        <th className="py-2 pr-3 text-right font-bold">Nº Vendas</th>
                        <th className="py-2 pr-2 text-right font-bold">Vendas</th>
                        <th className="py-2 text-right font-bold">Estimado em Gaveta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {posPanel.registers.map((r) => (
                        <tr key={r.register_id} className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-2 pr-2">
                            <span className="font-bold text-slate-900 dark:text-white">{r.code}</span>
                            <span className="block text-[11px] text-slate-500 truncate">{r.name}</span>
                          </td>
                          <td className="py-2 pr-2">
                            {r.cash_session ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold">
                                Aberto
                              </span>
                            ) : r.pos_session ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                                Sessão POS
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                Fechado
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-2 text-slate-600 dark:text-slate-300 font-mono truncate max-w-[160px]">
                            {r.cash_session?.operator_user_id || '—'}
                          </td>
                          <td className="py-2 pr-2 text-right font-bold text-slate-900 dark:text-white">
                            {Number(r.sales_count) || 0}
                          </td>
                          <td className="py-2 pr-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                            <KzAmount value={Number(r.sales_total) || 0} />
                          </td>
                          <td className="py-2 text-right font-bold text-slate-900 dark:text-white">
                            <KzAmount value={Number(r.expected_cash) || 0} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              <GlassCard className="p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    Faturação por Usuário
                  </h4>
                </div>
                {posPanel.operators.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Sem movimentos registados nesta data.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                          <th className="py-2 pr-2">Operador</th>
                          <th className="py-2 pr-2 text-right">Nº Vendas</th>
                          <th className="py-2 pr-2 text-right">Total Vendas</th>
                          <th className="py-2 pr-2 text-right">Reforços</th>
                          <th className="py-2 pr-2 text-right">Sangrias</th>
                          <th className="py-2 text-right">Líquido em Caixa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posPanel.operators.map((op) => (
                          <tr
                            key={op.operator_user_id}
                            className="border-b border-slate-100 dark:border-slate-800/60"
                          >
                            <td className="py-2 pr-2 font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                              {op.operator_user_id}
                            </td>
                            <td className="py-2 pr-2 text-right font-bold text-slate-900 dark:text-white">
                              {Number(op.sales_count) || 0}
                            </td>
                            <td className="py-2 pr-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                              <KzAmount value={Number(op.sales_total) || 0} />
                            </td>
                            <td className="py-2 pr-2 text-right text-slate-600 dark:text-slate-300">
                              <KzAmount value={Number(op.supplies_total) || 0} />
                            </td>
                            <td className="py-2 pr-2 text-right text-rose-600 dark:text-rose-400">
                              <KzAmount value={Number(op.bleeds_total) || 0} />
                            </td>
                            <td className="py-2 text-right font-extrabold text-slate-900 dark:text-white">
                              <KzAmount value={Number(op.net_cash_total) || 0} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </>
          )}
        </div>
      )}

      {/* Relatórios X/Z */}
      {posTab === 'relatorios' && (
        <div className="no-print space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Leitura X</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Relatório parcial de vendas do dia, sem encerrar o período fiscal.
              </p>
              <button
                onClick={handleLeituraX}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Gerar Leitura X</span>
              </button>
            </GlassCard>

            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Fecho Z Diário</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Encerramento fiscal do dia (memória imutável). Requer perfil de gestão.
              </p>
              <button
                onClick={() => fechoZMutation.mutate()}
                disabled={fechoZMutation.isPending || !isManager}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {fechoZMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>Processar Fecho Z</span>
              </button>
            </GlassCard>
          </div>

          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                Histórico de Fechos Z
              </h4>
              <button
                onClick={handleLoadZReports}
                disabled={loadingZReports}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                {loadingZReports ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Carregar</span>
              </button>
            </div>
            {zReports.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {loadingZReports ? 'A carregar...' : 'Sem Fechos Z gravados. Clique em Carregar.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-2">Fecho Z</th>
                      <th className="py-2 pr-2">Data</th>
                      <th className="py-2 pr-2">Terminal</th>
                      <th className="py-2 pr-2 text-right">Faturas</th>
                      <th className="py-2 pr-2 text-right">Vendas Brutas</th>
                      <th className="py-2 pr-2 text-right">IVA</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zReports.map((z) => (
                      <tr key={z.id} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-2 pr-2 font-mono font-bold text-slate-900 dark:text-white">
                          {z.zNumber}
                        </td>
                        <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">
                          {z.closingDate}
                        </td>
                        <td className="py-2 pr-2 text-slate-600 dark:text-slate-300">
                          {z.posTerminalId || '—'}
                        </td>
                        <td className="py-2 pr-2 text-right">{z.invoicesCount}</td>
                        <td className="py-2 pr-2 text-right">
                          <KzAmount value={Number(z.grossSalesTotal) || 0} />
                        </td>
                        <td className="py-2 pr-2 text-right">
                          <KzAmount value={Number(z.vatTotal) || 0} />
                        </td>
                        <td className="py-2 text-right font-bold text-slate-900 dark:text-white">
                          <KzAmount value={Number(z.finalTotal) || 0} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Modal de Abertura de Turno / Sessão de Caixa */}
      {openSessionModal && activeRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-white relative">
            <button
              onClick={() => setOpenSessionModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-1">Abrir Turno de Caixa</h3>
            <p className="text-xs text-slate-500 mb-4">
              Posto: {activeRegister.name} ({activeRegister.code})
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Fundo de Maneio Inicial (AOA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setOpenSessionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => openSessionMutation.mutate()}
                  disabled={openSessionMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                >
                  Confirmar Abertura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fecho Cego de Turno */}
      {closeSessionModal && currentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-white relative">
            <button
              onClick={() => setCloseSessionModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-1">Fecho Cego de Sessão</h3>
            <p className="text-xs text-slate-500 mb-4">
              Declare o valor físico contado em gaveta para reconciliação automática.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Saldo Físico Contado (AOA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={closingCountedInput}
                  onChange={(e) => setClosingCountedInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Observações / Justificação
                </label>
                <input
                  type="text"
                  placeholder="Opcional..."
                  value={closingNotesInput}
                  onChange={(e) => setClosingNotesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCloseSessionModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => closeSessionMutation.mutate()}
                  disabled={closeSessionMutation.isPending || !closingCountedInput}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  Encerrar Turno
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reforço / Sangria de Caixa */}
      {movementModalOpen && currentSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-white relative">
            <button
              onClick={() => setMovementModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-3">Movimento de Caixa (Reforço / Sangria)</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementTypeInput('SUPPLY')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    movementTypeInput === 'SUPPLY'
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Reforço (Entrada)
                </button>
                <button
                  type="button"
                  onClick={() => setMovementTypeInput('BLEED')}
                  className={`py-2 rounded-xl text-xs font-bold border ${
                    movementTypeInput === 'BLEED'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  Sangria (Saída)
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Montante (AOA)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={movementAmountInput}
                  onChange={(e) => setMovementAmountInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Motivo
                </label>
                <input
                  type="text"
                  placeholder="Ex: Trocos para gaveta / Recolha para cofre"
                  value={movementReasonInput}
                  onChange={(e) => setMovementReasonInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setMovementModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => recordMovementMutation.mutate()}
                  disabled={recordMovementMutation.isPending || !movementAmountInput}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold disabled:opacity-50"
                >
                  Registar Movimento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Abertura de Sessão POS (gestor) */}
      {posOpenModal && activeRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-white relative">
            <button
              onClick={() => setPosOpenModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-1">Abrir Sessão POS</h3>
            <p className="text-xs text-slate-500 mb-4">
              Posto: {activeRegister.name} ({activeRegister.code}). Habilita a abertura de caixas pelos operadores.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  placeholder="Opcional..."
                  value={posNotesInput}
                  onChange={(e) => setPosNotesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPosOpenModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => openPosSessionMutation.mutate()}
                  disabled={openPosSessionMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-xs font-bold disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fecho de Sessão POS (gestor) */}
      {posCloseModal && currentPosSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 dark:text-white relative">
            <button
              onClick={() => setPosCloseModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-1">Fechar Sessão POS</h3>
            <p className="text-xs text-slate-500 mb-4">
              Só é possível fechar quando todos os caixas do posto estiverem encerrados.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Observações de Fecho
                </label>
                <input
                  type="text"
                  placeholder="Opcional..."
                  value={posNotesInput}
                  onChange={(e) => setPosNotesInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setPosCloseModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => closePosSessionMutation.mutate()}
                  disabled={closePosSessionMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  Encerrar Sessão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Talão Fiscal Emitido (80mm) */}
      {ticketModalOpen && issuedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-slate-900 relative">
            <button
              onClick={() => setTicketModalOpen(false)}
              className="no-print absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="ticket-80mm font-mono text-xs text-black border border-dashed border-slate-300 p-4 rounded-lg bg-white my-2">
              <div className="text-center mb-3">
                <p className="font-extrabold text-sm uppercase">
                  {activeTenant?.trade_name || activeTenant?.name || 'KUDIBA COMÉRCIO GERAL'}
                </p>
                <p>NIF: {issuedInvoice.issuerNif || activeTenant?.taxId}</p>
                <p className="text-[10px] text-slate-600">
                  {issuedInvoice.issuerAddress || activeTenant?.address_detail}
                </p>
                <p className="font-bold text-xs mt-2 text-emerald-800">
                  FATURA-RECIBO: {issuedInvoice.documentNumber}
                </p>
                <p className="text-[10px]">Data: {new Date(issuedInvoice.issuedAt).toLocaleString()}</p>
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="text-[11px] mb-2">
                <p>Cliente: {issuedInvoice.customerName || 'Consumidor Final'}</p>
                <p>NIF: {issuedInvoice.customerNif || '999999999'}</p>
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="space-y-1 text-[11px]">
                {issuedInvoice.lines?.map((line, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="truncate pr-2">
                      {line.quantity}x {line.description}
                    </span>
                    <span>
                      {(Number(line.unitPrice) * Number(line.quantity)).toLocaleString('pt-AO', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Total Líquido:</span>
                  <span>
                    {Number(issuedInvoice.netTotal).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>IVA Total:</span>
                  <span>
                    {Number(issuedInvoice.taxTotal).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                  </span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-dashed border-black">
                  <span>TOTAL AOA:</span>
                  <span>
                    {Number(issuedInvoice.grossTotal).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz
                  </span>
                </div>
              </div>

              <div className="border-t border-dashed border-black my-2" />

              <div className="text-center text-[10px] space-y-0.5">
                <p className="font-bold">Validação AGT: {issuedInvoice.validationChars}-Processado por</p>
                <p>Software Certificado nº 000/AGT/2026 Kudiba</p>
                <p className="font-mono text-[9px] text-slate-500 break-all">
                  Hash: {issuedInvoice.hashSha256?.substring(0, 32)}...
                </p>
              </div>
            </div>

            <div className="no-print flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setTicketModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Talão Fiscal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Leitura X */}
      {leituraXText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 relative">
            <button
              onClick={() => setLeituraXText(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-3">Relatório Fiscal - Leitura X</h3>
            <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-96">
              {leituraXText}
            </pre>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setLeituraXText(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Fecho Z */}
      {fechoZResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-900 relative">
            <button
              onClick={() => setFechoZResult(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-extrabold mb-3 text-amber-700">
              Fecho Z Diário Processado com Sucesso
            </h3>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 font-mono">
              <p>
                Fecho Z Nº:{' '}
                {fechoZResult.zReportNumber ||
                  `Z ${new Date().getFullYear()}/${String(fechoZResult.zReportSequence || 1).padStart(6, '0')}`}
              </p>
              <p>Data Fiscal: {fechoZResult.date}</p>
              <p>Terminal / Série: {fechoZResult.posTerminalId || seriesCode}</p>
              <p>
                Documentos Emitidos: {fechoZResult.invoicesCount} Faturas | {fechoZResult.creditNotesCount} NCs
              </p>
              <p>
                Vendas Brutas:{' '}
                {Number(fechoZResult.grossSalesTotal || 0).toLocaleString('pt-AO', {
                  minimumFractionDigits: 2,
                })}{' '}
                Kz
              </p>
              <p>
                Total IVA Liquidado:{' '}
                {Number(fechoZResult.vatTotal || 0).toLocaleString('pt-AO', {
                  minimumFractionDigits: 2,
                })}{' '}
                Kz
              </p>
              <p className="font-bold pt-1 border-t border-amber-300">
                Total Líquido Encerrado:{' '}
                {Number(fechoZResult.finalTotal || 0).toLocaleString('pt-AO', {
                  minimumFractionDigits: 2,
                })}{' '}
                Kz
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold"
              >
                Imprimir
              </button>
              <button
                onClick={() => setFechoZResult(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

