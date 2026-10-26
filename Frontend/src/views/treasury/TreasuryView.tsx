import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark,
  Wallet,
  Receipt,
  FileCheck2,
  PlusCircle,
  ArrowDownCircle,
  Lock,
  Unlock,
  Building2,
  X,
  Search,
  Printer,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  ArrowLeftRight,
  ArrowUpCircle,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import {
  treasuryApi,
  CashRegister,
  CashSession,
  PaymentMethodType,
  MovementType,
  CreateCashRegisterPayload,
  OpenCashSessionPayload,
  CloseCashSessionPayload,
  RecordCashMovementPayload,
  CreateBankAccountPayload,
  IssueReceiptPayload,
  TreasuryReceipt,
  InvoiceReceivable,
} from '../../api/treasury';
import { toast } from '../../stores/toastStore';
import { inventoryApi } from '../../api/inventory';
import { CashFlowTab } from './components/CashFlowTab';
import { PayablesTab } from './components/PayablesTab';
import { TransfersTab } from './components/TransfersTab';
import { BankAccountsTab } from './components/BankAccountsTab';

type TreasuryTab =
  | 'cash_flow'
  | 'payables'
  | 'receivables'
  | 'transfers'
  | 'bank_accounts'
  | 'registers'
  | 'receipts';

interface TreasuryViewProps {
  onNavigate?: (module: string) => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({ onNavigate }) => {
  const { activeTenant, activeBranch, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TreasuryTab>('cash_flow');
  const [searchTerm, setSearchTerm] = useState('');

  // Modais de Caixa
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [openSessionRegister, setOpenSessionRegister] = useState<CashRegister | null>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('50000.00');

  const [closeSessionTarget, setCloseSessionTarget] = useState<CashSession | null>(null);
  const [closingCountedInput, setClosingCountedInput] = useState('');
  const [closingNotesInput, setClosingNotesInput] = useState('');

  const [movementSessionTarget, setMovementSessionTarget] = useState<CashSession | null>(null);
  const [movementTypeInput, setMovementTypeInput] = useState<MovementType>('SUPPLY');
  const [movementAmountInput, setMovementAmountInput] = useState('');
  const [movementReasonInput, setMovementReasonInput] = useState('');

  const [reportModalSessionId, setReportModalSessionId] = useState<string | null>(null);

  // Modais de Banco e Recibo
  const [showBankModal, setShowBankModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Queries
  const { data: registers = [], isLoading: registersLoading } = useQuery({
    queryKey: ['treasury_registers', activeTenant?.id],
    queryFn: () => treasuryApi.listRegisters(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: registerSessionsMap = {}, isLoading: sessionsMapLoading } = useQuery({
    queryKey: ['treasury_register_sessions', activeTenant?.id, registers.map((r) => r.id).join(',')],
    queryFn: async () => {
      const entries = await Promise.all(
        registers.map(async (r) => {
          try {
            const session = await treasuryApi.getCurrentSession(r.id);
            return [r.id, session] as const;
          } catch {
            return [r.id, null] as const;
          }
        })
      );
      return Object.fromEntries(entries) as Record<string, CashSession | null>;
    },
    enabled: Boolean(activeTenant?.id) && registers.length > 0,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['treasury_bank_accounts', activeTenant?.id],
    queryFn: () => treasuryApi.listBankAccounts(),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
    queryKey: ['treasury_receipts', activeTenant?.id],
    queryFn: () => treasuryApi.listReceipts({ limit: 100 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: receivables = [], isLoading: receivablesLoading } = useQuery({
    queryKey: ['treasury_receivables', activeTenant?.id],
    queryFn: () => treasuryApi.listReceivables(100),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['treasury_entities', activeTenant?.id],
    queryFn: () => inventoryApi.listEntities({ limit: 100 }),
    enabled: Boolean(activeTenant?.id),
  });

  const { data: sessionReport, isLoading: reportLoading } = useQuery({
    queryKey: ['treasury_session_report', reportModalSessionId],
    queryFn: () => (reportModalSessionId ? treasuryApi.getSessionReport(reportModalSessionId) : null),
    enabled: Boolean(reportModalSessionId),
  });

  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string>>(new Set());
  const toggleReceiptExpand = (id: string) => {
    setExpandedReceiptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredReceipts = React.useMemo(() => {
    return receipts.filter(
      (r) =>
        r.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [receipts, searchTerm]);

  const {
    sortedData: sortedReceipts,
    sortConfig: receiptsSortConfig,
    requestSort: requestReceiptsSort,
  } = useTableSort<TreasuryReceipt>(filteredReceipts, { key: 'issued_at', direction: 'desc' });

  const [expandedReceivableIds, setExpandedReceivableIds] = useState<Set<string>>(new Set());
  const toggleReceivableExpand = (id: string) => {
    setExpandedReceivableIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isReceivableSettled = React.useCallback(
    (rec: InvoiceReceivable) => {
      if (rec.status?.toUpperCase() === 'SETTLED') return true;
      if (rec.document_type === 'NC') return true;
      return receipts.some(
        (rc) =>
          rc.lines?.some((l) => l.invoice_id === rec.invoice_id || l.invoice_number === rec.document_number) ||
          (rc.notes && rc.notes.includes(rec.document_number))
      );
    },
    [receipts]
  );

  const filteredReceivables = React.useMemo(() => {
    return receivables.filter(
      (rec) =>
        rec.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.document_type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [receivables, searchTerm]);

  const {
    sortedData: sortedReceivables,
    sortConfig: receivablesSortConfig,
    requestSort: requestReceivablesSort,
  } = useTableSort<InvoiceReceivable>(filteredReceivables, { key: 'created_at', direction: 'desc' });

  // Formulário de Caixa
  const [registerForm, setRegisterForm] = useState<CreateCashRegisterPayload>({
    code: '',
    name: '',
  });

  // Formulário de Conta Bancária
  const [bankForm, setBankForm] = useState<CreateBankAccountPayload>({
    bank_name: 'Banco Angolano de Investimentos (BAI)',
    account_number: '',
    iban: 'AO06',
    currency: 'AOA',
    initial_balance: '0.00',
  });

  // Formulário de Recibo RC
  const [receiptForm, setReceiptForm] = useState<IssueReceiptPayload>({
    customer_id: '',
    customer_name: '',
    customer_nif: '',
    bank_account_id: '',
    session_id: '',
    payment_method: 'TRANSFERENCIA',
    total_amount: '',
    currency: 'AOA',
    notes: '',
    lines: [
      {
        invoice_id: '',
        invoice_number: '',
        amount_settled: '',
        notes: 'Liquidação de fatura',
      },
    ],
  });

  // Mutations
  const createRegisterMutation = useMutation({
    mutationFn: (payload: CreateCashRegisterPayload) => treasuryApi.createRegister(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      setShowRegisterModal(false);
      setRegisterForm({ code: '', name: '' });
      toast.success('Posto de caixa criado com sucesso.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Erro ao criar posto de caixa.');
    },
  });

  const openSessionMutation = useMutation({
    mutationFn: (payload: OpenCashSessionPayload) => treasuryApi.openSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
      setOpenSessionRegister(null);
      toast.success('Sessão de caixa aberta com sucesso.');
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      setOpenSessionRegister(null);
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          'Este caixa já possui uma sessão aberta. Encerre a sessão atual antes de abrir uma nova.'
      );
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CloseCashSessionPayload }) =>
      treasuryApi.closeSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['pos_current_session'] });
      setCloseSessionTarget(null);
      setClosingCountedInput('');
      setClosingNotesInput('');
      toast.success('Sessão de caixa encerrada com sucesso.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Erro ao encerrar sessão de caixa.');
    },
  });

  const recordMovementMutation = useMutation({
    mutationFn: (payload: RecordCashMovementPayload) => treasuryApi.recordMovement(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_session_report'] });
      setMovementSessionTarget(null);
      setMovementAmountInput('');
      setMovementReasonInput('');
      toast.success('Movimento de caixa registado.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Erro ao registar movimento.');
    },
  });

  const createBankMutation = useMutation({
    mutationFn: (payload: CreateBankAccountPayload) => treasuryApi.createBankAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_bank_accounts'] });
      setShowBankModal(false);
      setBankForm({
        bank_name: 'Banco Angolano de Investimentos (BAI)',
        account_number: '',
        iban: 'AO06',
        currency: 'AOA',
        initial_balance: '0.00',
      });
    },
  });

  const issueReceiptMutation = useMutation({
    mutationFn: (payload: IssueReceiptPayload) => treasuryApi.issueReceipt(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_receipts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_bank_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_receivables'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_dashboard_summary'] });
      setShowReceiptModal(false);
      toast.success('Recibo de quitação RC emitido com sucesso.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Erro ao emitir recibo.');
    },
  });

  // Impressão Térmica de Fecho / Relatório de Sessão
  const printSessionReport = () => {
    if (!sessionReport) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const opening = Number(sessionReport.reconciliation.opening_balance) || 0;
    const totalIn = Number(sessionReport.reconciliation.total_in) || 0;
    const totalOut = Number(sessionReport.reconciliation.total_out) || 0;
    const expected = Number(sessionReport.reconciliation.expected_balance) || 0;

    const movementsHtml = sessionReport.movements
      .map(
        (m) => `
        <tr>
          <td style="padding: 4px 0;">${new Date(m.created_at).toLocaleTimeString('pt-AO')}</td>
          <td style="padding: 4px 0; font-weight: bold;">${m.movement_type}</td>
          <td style="padding: 4px 0;">${m.reason}</td>
          <td style="padding: 4px 0; text-align: right; font-weight: bold;">${Number(m.amount).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</td>
        </tr>`
      )
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Sessão - ${sessionReport.register_code}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif; font-size: 11px; margin: 0; padding: 16px; color: #000; width: 300px; }
            .header { text-align: center; border-bottom: 1px dashed #444; padding-bottom: 8px; margin-bottom: 10px; }
            .title { font-size: 13px; font-weight: 800; margin: 0 0 4px 0; }
            .meta { font-size: 10px; color: #444; margin: 2px 0; }
            .section { margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; }
            .bold { font-weight: bold; }
            .total-row { font-size: 12px; font-weight: bold; margin-top: 6px; border-top: 1px dashed #444; padding-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
            th { text-align: left; border-bottom: 1px solid #444; padding: 3px 0; }
            .footer { border-top: 1px dashed #444; margin-top: 14px; padding-top: 8px; text-align: center; font-size: 9px; color: #555; }
            .sign { margin-top: 24px; border-top: 1px solid #444; padding-top: 4px; text-align: center; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <p class="title">KUDIBA ERP — TESOURARIA</p>
            <p class="meta">RELATÓRIO DE SESSÃO / FECHO X</p>
            <p class="meta">Posto: <strong>${sessionReport.register_code} — ${sessionReport.register_name}</strong></p>
            <p class="meta">Filial: ${activeBranch?.name || 'Sede Principal'}</p>
            <p class="meta">Data/Hora: ${new Date().toLocaleString('pt-AO')}</p>
          </div>

          <div class="section">
            <div class="row"><span>Fundo de Abertura:</span><span class="bold">${opening.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</span></div>
            <div class="row"><span>Total de Entradas:</span><span class="bold">+${totalIn.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</span></div>
            <div class="row"><span>Total de Saídas:</span><span class="bold">-${totalOut.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</span></div>
            <div class="row total-row">
              <span>Saldo Esperado em Caixa:</span><span>${expected.toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</span>
            </div>
          </div>

          <div class="section">
            <p style="font-weight: bold; margin-bottom: 2px;">Movimentos da Sessão:</p>
            ${
              sessionReport.movements.length === 0
                ? '<p style="font-size: 10px; color: #555;">Sem movimentos avulsos registados.</p>'
                : `<table>
                    <thead>
                      <tr><th>Hora</th><th>Tipo</th><th>Motivo</th><th style="text-align: right;">Valor</th></tr>
                    </thead>
                    <tbody>${movementsHtml}</tbody>
                  </table>`
            }
          </div>

          <div class="sign">
            Assinatura do Operador / Encarregado
          </div>

          <div class="footer">
            Documento de auditoria interna • Kudiba ERP
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Totais
  const totalBankBalance = bankAccounts.reduce(
    (acc, b) => acc + (b.is_active ? Number(b.current_balance) || 0 : 0),
    0
  );
  const totalCashInRegisters = Object.values(registerSessionsMap).reduce((acc, s) => {
    if (s && s.status === 'OPEN') {
      return acc + (Number(s.opening_balance) || 0);
    }
    return acc;
  }, 0);
  const totalGlobalTreasury = totalBankBalance + totalCashInRegisters;

  const totalReceivables = receivables
    .filter((r) => r.status === 'Outstanding')
    .reduce((acc, r) => acc + (Number(r.gross_total) || 0), 0);
  const totalSettledReceipts = receipts.reduce(
    (acc, r) => acc + (Number(r.total_amount) || 0),
    0
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header & Identificação */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            <span>Tesouraria, Caixas &amp; Contas Bancárias</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sessões de caixa com fecho cego, contas bancárias (IBAN AO06) e emissão de recibos RC via KudibaTreasury
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'registers' && (
            <button
              onClick={() => setShowRegisterModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Novo Posto / Caixa</span>
            </button>
          )}

          {activeTab === 'bank_accounts' && (
            <button
              onClick={() => setShowBankModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Adicionar Conta Bancária</span>
            </button>
          )}

          {activeTab === 'receipts' && (
            <button
              onClick={() => setShowReceiptModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Emitir Recibo de Quitação (RC)</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Disponibilidades Globais</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalGlobalTreasury} />
          </div>
          <span className="text-xs text-slate-400 truncate block">
            {bankAccounts.length} Banco(s) ({Number(totalBankBalance).toLocaleString('pt-AO')} Kz) • Gavetas ({Number(totalCashInRegisters).toLocaleString('pt-AO')} Kz)
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Caixas Físicos</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            {registers.length} Postos
          </div>
          <span className="text-xs text-emerald-600 font-medium truncate block">
            Filial {activeBranch?.name || 'Sede Principal'}
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Total Quitado (RC)</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalSettledReceipts} />
          </div>
          <span className="text-xs text-slate-400">
            {receipts.length} Recibos Oficiais Emitidos
          </span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Contas a Receber</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-lg sm:text-xl 2xl:text-2xl font-bold text-slate-900 dark:text-white truncate">
            <KzAmount value={totalReceivables} />
          </div>
          <span className="text-xs text-amber-600 font-medium">
            Faturas a Prazo Pendentes
          </span>
        </GlassCard>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('cash_flow')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cash_flow'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <TrendingUp className="w-4 h-4 shrink-0" />
          <span>Fluxo de Caixa</span>
        </button>

        <button
          onClick={() => setActiveTab('payables')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'payables'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ArrowUpCircle className="w-4 h-4 shrink-0" />
          <span>Contas a Pagar</span>
        </button>

        <button
          onClick={() => setActiveTab('receivables')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'receivables'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ArrowDownCircle className="w-4 h-4 shrink-0" />
          <span>Contas a Receber</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transfers'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4 shrink-0" />
          <span>Transferências Internas</span>
        </button>

        <button
          onClick={() => setActiveTab('bank_accounts')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'bank_accounts'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          <span>Bancos &amp; Conciliação</span>
        </button>

        <button
          onClick={() => setActiveTab('registers')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'registers'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span>Caixas Físicos &amp; Sessões</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'receipts'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span>Recibos Emitidos (RC)</span>
        </button>
      </div>

      {/* Tab: Fluxo de Caixa */}
      {activeTab === 'cash_flow' && (
        <CashFlowTab
          tenantId={activeTenant?.id}
          onNavigateTab={(tab) => setActiveTab(tab as TreasuryTab)}
        />
      )}

      {/* Tab: Contas a Pagar */}
      {activeTab === 'payables' && (
        <PayablesTab tenantId={activeTenant?.id} bankAccounts={bankAccounts} />
      )}

      {/* Tab: Transferências Internas */}
      {activeTab === 'transfers' && (
        <TransfersTab
          tenantId={activeTenant?.id}
          bankAccounts={bankAccounts}
          registers={registers}
        />
      )}

      {/* Tab: Bancos & Conciliação */}
      {activeTab === 'bank_accounts' && (
        <BankAccountsTab tenantId={activeTenant?.id} bankAccounts={bankAccounts} />
      )}

      {/* Tab 1: Caixas Físicos & Sessões */}
      {activeTab === 'registers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {registersLoading ? (
              <div className="col-span-full py-8 text-center text-slate-500">
                A carregar caixas físicos...
              </div>
            ) : registers.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-500">
                Nenhum caixa registado. Clique em "Novo Posto / Caixa" para criar.
              </div>
            ) : (
              registers.map((r) => {
                const currentSession = registerSessionsMap[r.id] ?? null;
                const isSessionOpen = currentSession?.status === 'OPEN';

                return (
                  <GlassCard key={r.id} className="p-4 sm:p-5 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-500/20">
                          {r.code}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isSessionOpen
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-500/20'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {isSessionOpen ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Sessão Aberta
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3 text-slate-400" />
                                Caixa Fechado
                              </>
                            )}
                          </span>
                          <StatusBadge
                            status={r.is_active ? 'ok' : 'acompanhar'}
                            label={r.is_active ? 'Ativo' : 'Inativo'}
                          />
                        </div>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {r.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        Filial: {activeBranch?.name || 'Sede'} • ID: {r.id.slice(0, 8)}...
                      </p>

                      {isSessionOpen && currentSession && (
                        <div className="mt-3 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                              Fundo Inicial:
                            </span>
                            <span className="font-bold text-emerald-900 dark:text-emerald-200">
                              <KzAmount value={Number(currentSession.opening_balance)} />
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-emerald-200/50 dark:border-emerald-800/40">
                            <span>Operador: <strong className="text-slate-700 dark:text-slate-300">{currentSession.operator_user_id || 'Operador'}</strong></span>
                            <span>Desde: {new Date(currentSession.opened_at).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      {isSessionOpen ? (
                        <>
                          <div className="flex items-center gap-2">
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate('pos')}
                                className="flex-1 justify-center inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-700/20"
                                title="Ir para o Terminal de Vendas POS deste Caixa"
                              >
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                <span>Terminal POS</span>
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={sessionsMapLoading}
                              onClick={() => {
                                if (currentSession) {
                                  setMovementSessionTarget(currentSession);
                                }
                              }}
                              className="flex-1 justify-center inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer"
                              title="Registar Sangria para Cofre ou Reforço de Trocos"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Sangria / Reforço</span>
                            </button>
                            <button
                              type="button"
                              disabled={sessionsMapLoading}
                              onClick={() => {
                                if (currentSession) {
                                  setCloseSessionTarget(currentSession);
                                }
                              }}
                              className="justify-center inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer"
                              title="Encerrar Turno e Efetuar Fecho Cego de Caixa"
                            >
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              <span>Fecho</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={sessionsMapLoading}
                            onClick={() => {
                              if (currentSession) {
                                setReportModalSessionId(currentSession.id);
                              }
                            }}
                            className="w-full text-center text-xs font-medium text-slate-500 hover:text-emerald-600 py-1 cursor-pointer transition-colors"
                          >
                            Ver Relatório da Sessão Atual (Fecho X)
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={sessionsMapLoading}
                            onClick={async () => {
                              const existing = await treasuryApi.getCurrentSession(r.id);
                              if (existing && existing.status === 'OPEN') {
                                queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
                                toast.error('Este caixa já está aberto.');
                                return;
                              }
                              setOpenSessionRegister(r);
                            }}
                            className="flex-1 justify-center inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5 shrink-0" />
                            <span>Abrir Sessão de Caixa</span>
                          </button>
                          {onNavigate && (
                            <button
                              type="button"
                              onClick={() => onNavigate('pos')}
                              className="justify-center inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Ir para o POS"
                            >
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              <span>POS</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Recibos de Quitação (RC) */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por número de recibo ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <span className="text-xs text-slate-400">
              Total: {receipts.length} Recibos emitidos
            </span>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="text-xs uppercase font-semibold">
                  <tr>
                    <th className="w-10 px-3 py-3 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10"></th>
                    <SortableHeader
                      columnKey="receipt_number"
                      label="N.º do Recibo"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="issued_at"
                      label="Data / Hora"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="customer_name"
                      label="Cliente / Adquirente"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="customer_nif"
                      label="NIF"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="payment_method"
                      label="Método Pagamento"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="total_amount"
                      label="Valor Quitado"
                      align="right"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="notes"
                      label="Observações"
                      currentSort={receiptsSortConfig}
                      onSort={requestReceiptsSort}
                      className="px-4 py-3"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receiptsLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        A carregar recibos...
                      </td>
                    </tr>
                  ) : sortedReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Nenhum recibo de quitação emitido até ao momento.
                      </td>
                    </tr>
                  ) : (
                    sortedReceipts.map((r) => {
                      const isExpanded = expandedReceiptIds.has(r.id);
                      return (
                        <React.Fragment key={r.id}>
                          <tr
                            onClick={() => toggleReceiptExpand(r.id)}
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                                : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="px-3 py-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-600 inline" />
                              ) : (
                                <ChevronRight className="w-4 h-4 inline" />
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                              {r.receipt_number}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {new Date(r.issued_at).toLocaleString('pt-AO')}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                              {r.customer_name}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-slate-500">
                              {r.customer_nif || '999999999'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                {r.payment_method}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                              <KzAmount value={Number(r.total_amount)} />
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 truncate max-w-xs">
                              {r.notes || '—'}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-y border-emerald-100 dark:border-emerald-900/30">
                              <td colSpan={8} className="px-6 py-4">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                      Drilldown — Recibo de Quitação Oficial (RC)
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                                      <span>ID: {r.id}</span>
                                      <span>Moeda: {r.currency || 'AOA'}</span>
                                      {r.bank_account_id && <span>Conta Bancária: {r.bank_account_id}</span>}
                                      {r.session_id && <span>Sessão POS: {r.session_id}</span>}
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                                      Faturas Liquidadas neste Recibo:
                                    </h4>
                                    {r.lines && r.lines.length > 0 ? (
                                      <div className="rounded border border-slate-200 dark:border-slate-800 overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold">
                                            <tr>
                                              <th className="px-3 py-1.5 text-left">Fatura N.º</th>
                                              <th className="px-3 py-1.5 text-left">ID Fatura</th>
                                              <th className="px-3 py-1.5 text-right">Valor Quitado</th>
                                              <th className="px-3 py-1.5 text-left">Anotações</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {r.lines.map((l, idx) => (
                                              <tr key={l.id || idx}>
                                                <td className="px-3 py-1.5 font-mono font-bold text-emerald-600">
                                                  {l.invoice_number || 'FT s/n'}
                                                </td>
                                                <td className="px-3 py-1.5 font-mono text-slate-500">
                                                  {l.invoice_id}
                                                </td>
                                                <td className="px-3 py-1.5 text-right font-bold text-slate-900 dark:text-white">
                                                  <KzAmount value={Number(l.amount_settled)} />
                                                </td>
                                                <td className="px-3 py-1.5 text-slate-500">
                                                  {l.notes || 'Liquidação'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">
                                        Nenhuma linha discriminada individualmente (quitação global de fatura).
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}



      {/* Tab 4: Faturas a Prazo (Contas a Receber) */}
      {activeTab === 'receivables' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Contas Correntes de Faturas a Prazo (Crédito)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Faturas FT registadas aguardando liquidação ou quitação via Recibo RC
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {receivables.filter((r) => !isReceivableSettled(r)).length} Pendentes
              </span>
            </div>

            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="text-xs uppercase font-semibold">
                  <tr>
                    <th className="w-10 px-3 py-3 sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10"></th>
                    <SortableHeader
                      columnKey="document_number"
                      label="Documento"
                      currentSort={receivablesSortConfig}
                      onSort={requestReceivablesSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="document_type"
                      label="Tipo"
                      currentSort={receivablesSortConfig}
                      onSort={requestReceivablesSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="created_at"
                      label="Data Emissão"
                      currentSort={receivablesSortConfig}
                      onSort={requestReceivablesSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="payment_mechanism"
                      label="Mecanismo Pagamento"
                      currentSort={receivablesSortConfig}
                      onSort={requestReceivablesSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="gross_total"
                      label="Total a Liquidar"
                      align="right"
                      currentSort={receivablesSortConfig}
                      onSort={requestReceivablesSort}
                      className="px-4 py-3"
                    />
                    <SortableHeader
                      columnKey="status"
                      label="Estado"
                      align="center"
                      currentSort={receivablesSortConfig}
                      onSort={requestReceivablesSort}
                      className="px-4 py-3"
                    />
                    <th className="px-4 py-3 text-right sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-10">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {receivablesLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        A carregar contas a receber...
                      </td>
                    </tr>
                  ) : sortedReceivables.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma fatura a prazo pendente de liquidação.
                      </td>
                    </tr>
                  ) : (
                    sortedReceivables.map((rec) => {
                      const isExpanded = expandedReceivableIds.has(rec.id);
                      return (
                        <React.Fragment key={rec.id}>
                          <tr
                            onClick={() => toggleReceivableExpand(rec.id)}
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="px-3 py-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-amber-600 inline" />
                              ) : (
                                <ChevronRight className="w-4 h-4 inline" />
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                              {rec.document_number}
                            </td>
                            <td className="px-4 py-3 font-semibold text-xs text-slate-600 dark:text-slate-300">
                              {rec.document_type}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {new Date(rec.created_at).toLocaleDateString('pt-AO')}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {rec.payment_mechanism || 'CREDITO'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                              <KzAmount value={Number(rec.gross_total)} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              {(() => {
                                const settled = isReceivableSettled(rec);
                                if (rec.document_type === 'NC') {
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                      Crédito / Regularizada
                                    </span>
                                  );
                                }
                                return (
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                      !settled
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    }`}
                                  >
                                    {!settled ? 'Pendente' : 'Liquidada'}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              {!isReceivableSettled(rec) && rec.document_type !== 'NC' && (
                                <button
                                  onClick={() => {
                                    const defaultEntity = entities.length > 0 ? entities[0] : null;
                                    setReceiptForm({
                                      customer_id: defaultEntity?.id || '',
                                      customer_name: defaultEntity?.name || 'Cliente Adquirente',
                                      customer_nif: defaultEntity?.tax_id || '999999999',
                                      bank_account_id: bankAccounts[0]?.id || '',
                                      session_id: '',
                                      payment_method: 'TRANSFERENCIA',
                                      total_amount: String(rec.gross_total),
                                      currency: 'AOA',
                                      notes: `Liquidação da fatura ${rec.document_number}`,
                                      lines: [
                                        {
                                          invoice_id: rec.invoice_id,
                                          invoice_number: rec.document_number,
                                          amount_settled: String(rec.gross_total),
                                          notes: 'Liquidação integral',
                                        },
                                      ],
                                    });
                                    setShowReceiptModal(true);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                                >
                                  Emitir RC
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-y border-amber-200 dark:border-amber-900/30">
                              <td colSpan={8} className="px-6 py-4">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                      Drilldown — Conta a Receber (Fatura a Crédito)
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                                      <span>ID Registo: {rec.id}</span>
                                      <span>UUID Fatura: {rec.invoice_id}</span>
                                      <span>Última Atualização: {new Date(rec.updated_at).toLocaleString('pt-AO')}</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300 pt-1">
                                    <div className="p-2.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block text-[11px]">Tipo de Documento:</span>
                                      <span className="font-semibold text-slate-900 dark:text-white">{rec.document_type}</span>
                                    </div>
                                    <div className="p-2.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block text-[11px]">Condição de Pagamento:</span>
                                      <span className="font-semibold text-slate-900 dark:text-white">{rec.payment_mechanism || 'Crédito / A Prazo'}</span>
                                    </div>
                                    <div className="p-2.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                      <span className="text-slate-400 block text-[11px]">
                                        {isReceivableSettled(rec) ? 'Total Liquidado / Regularizado:' : 'Total Pendente de Cobrança:'}
                                      </span>
                                      <span className={`font-bold ${isReceivableSettled(rec) ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        <KzAmount value={Number(rec.gross_total)} />
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modal: Novo Posto / Caixa */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                Registar Novo Caixa Físico
              </h3>
              <button onClick={() => setShowRegisterModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Código do Caixa *
                </label>
                <input
                  type="text"
                  placeholder="ex: CX-02 ou POS-01"
                  value={registerForm.code}
                  onChange={(e) => setRegisterForm({ ...registerForm, code: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Designação do Caixa *
                </label>
                <input
                  type="text"
                  placeholder="ex: Caixa Balcão Rápido 02"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!registerForm.code || !registerForm.name || createRegisterMutation.isPending}
                onClick={() =>
                  createRegisterMutation.mutate({
                    branch_id: activeBranch?.id,
                    code: registerForm.code,
                    name: registerForm.name,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Criar Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Abertura de Caixa */}
      {openSessionRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Unlock className="w-5 h-5 text-emerald-600" />
                Abertura de Caixa: {openSessionRegister.name}
              </h3>
              <button onClick={() => setOpenSessionRegister(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Operador do Caixa
                </label>
                <input
                  type="text"
                  disabled
                  value={user?.fullName || 'Operador Comercial'}
                  className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Fundo de Maneio Inicial (Kz) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Trocos e notas conferidas para início de operações
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOpenSessionRegister(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={openSessionMutation.isPending}
                onClick={() =>
                  openSessionMutation.mutate({
                    register_id: openSessionRegister.id,
                    operator_user_id: user?.id || 'operador-01',
                    opening_balance: openingBalanceInput,
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Confirmar Abertura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fecho Cego de Caixa */}
      {closeSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-600" />
                Fecho Cego de Sessão (Contagem de Caixa)
              </h3>
              <button onClick={() => setCloseSessionTarget(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
              <span className="font-bold">Regra de Auditoria:</span> Conte as cédulas e moedas físicas na gaveta e introduza o total apurado sem consultar o saldo teórico do sistema.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Total Físico Contado em Dinheiro (Kz) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={closingCountedInput}
                  onChange={(e) => setClosingCountedInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Notas de Fecho / Justificativa
                </label>
                <textarea
                  rows={2}
                  value={closingNotesInput}
                  onChange={(e) => setClosingNotesInput(e.target.value)}
                  placeholder="Contagem efetuada com o encarregado de turno"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCloseSessionTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!closingCountedInput || closeSessionMutation.isPending}
                onClick={() =>
                  closeSessionMutation.mutate({
                    id: closeSessionTarget.id,
                    payload: {
                      closing_balance_counted: closingCountedInput,
                      notes: closingNotesInput || undefined,
                    },
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
              >
                Encerrar Caixa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Registo de Movimento de Caixa (SUPPLY / BLEED / EXPENSE) */}
      {movementSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-amber-600" />
                Registar Movimento no Caixa
              </h3>
              <button onClick={() => setMovementSessionTarget(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Tipo de Operação *
                </label>
                <select
                  value={movementTypeInput}
                  onChange={(e) => setMovementTypeInput(e.target.value as MovementType)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  <option value="SUPPLY">Reforço de Fundo / Trocos (SUPPLY)</option>
                  <option value="BLEED">Sangria para Cofre / Banco (BLEED)</option>
                  <option value="EXPENSE">Despesa Avulsa Autorizada (EXPENSE)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Montante (Kz) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={movementAmountInput}
                  onChange={(e) => setMovementAmountInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Motivo / Justificação *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Sangria de numerário para cofre central"
                  value={movementReasonInput}
                  onChange={(e) => setMovementReasonInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMovementSessionTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!movementAmountInput || !movementReasonInput || recordMovementMutation.isPending}
                onClick={() =>
                  recordMovementMutation.mutate({
                    session_id: movementSessionTarget.id,
                    movement_type: movementTypeInput,
                    amount: movementAmountInput,
                    reason: movementReasonInput,
                    operator_user_id: user?.id || 'operador-01',
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Movimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Relatório de Sessão / Fecho Z */}
      {reportModalSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  Relatório da Sessão de Caixa
                </h3>
                <span className="text-xs text-slate-400">
                  {sessionReport?.register_code} — {sessionReport?.register_name}
                </span>
              </div>
              <button onClick={() => setReportModalSessionId(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {reportLoading ? (
              <div className="py-8 text-center text-slate-500">
                A calcular conciliação da sessão...
              </div>
            ) : sessionReport ? (
              <div className="space-y-4">
                {/* Resumo da Conciliação */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Fundo Abertura:</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      <KzAmount value={Number(sessionReport.reconciliation.opening_balance)} />
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Total Entradas:</span>
                    <span className="font-bold text-sm text-emerald-600">
                      +<KzAmount value={Number(sessionReport.reconciliation.total_in)} />
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Total Saídas:</span>
                    <span className="font-bold text-sm text-rose-600">
                      -<KzAmount value={Number(sessionReport.reconciliation.total_out)} />
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Saldo Esperado:</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      <KzAmount value={Number(sessionReport.reconciliation.expected_balance)} />
                    </span>
                  </div>
                </div>

                {/* Movimentos da Sessão */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
                    Movimentos Registados na Sessão
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2">Hora</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Motivo</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sessionReport.movements.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                              Sem movimentos registados nesta sessão.
                            </td>
                          </tr>
                        ) : (
                          sessionReport.movements.map((m) => (
                            <tr key={m.id}>
                              <td className="px-3 py-2 font-mono text-slate-500">
                                {new Date(m.created_at).toLocaleTimeString('pt-AO')}
                              </td>
                              <td className="px-3 py-2">
                                <span className="font-semibold">{m.movement_type}</span>
                              </td>
                              <td className="px-3 py-2">{m.reason}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white">
                                <KzAmount value={Number(m.amount)} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={printSessionReport}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Imprimir Relatório (80mm)</span>
              </button>
              <button
                type="button"
                onClick={() => setReportModalSessionId(null)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Conta Bancária */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Adicionar Conta Bancária (Angola)
              </h3>
              <button onClick={() => setShowBankModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Instituição Bancária *
                </label>
                <select
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="Banco Angolano de Investimentos (BAI)">BAI — Banco Angolano de Investimentos</option>
                  <option value="Banco de Fomento Angola (BFA)">BFA — Banco de Fomento Angola</option>
                  <option value="Banco Millennium Atlântico (BMA)">BMA — Banco Millennium Atlântico</option>
                  <option value="Banco BIC">BIC — Banco BIC</option>
                  <option value="Standard Bank Angola">Standard Bank Angola</option>
                  <option value="Banco Sol">Banco Sol</option>
                  <option value="Banco de Poupança e Crédito (BPC)">BPC — Banco de Poupança e Crédito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Número de Conta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: 123456789"
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  IBAN Oficial (Prefixo AO06) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="AO06 0040 0000 1234 5678 9012 3"
                  value={bankForm.iban}
                  onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Moeda
                  </label>
                  <select
                    value={bankForm.currency}
                    onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="AOA">Kwanzas (AOA)</option>
                    <option value="USD">Dólares (USD)</option>
                    <option value="EUR">Euros (EUR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Saldo Inicial
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankForm.initial_balance}
                    onChange={(e) => setBankForm({ ...bankForm, initial_balance: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBankModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!bankForm.account_number || !bankForm.iban || createBankMutation.isPending}
                onClick={() => createBankMutation.mutate(bankForm)}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Gravar Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Emitir Recibo de Quitação (RC) */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                Emitir Recibo de Quitação (RC)
              </h3>
              <button onClick={() => setShowReceiptModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Cliente Adquirente *
                </label>
                <select
                  value={receiptForm.customer_id}
                  onChange={(e) => {
                    const ent = entities.find((ent) => ent.id === e.target.value);
                    setReceiptForm({
                      ...receiptForm,
                      customer_id: e.target.value,
                      customer_name: ent ? ent.name : '',
                      customer_nif: ent ? ent.tax_id : '',
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Selecione o cliente cadastrado...</option>
                  {entities.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} (NIF: {ent.tax_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Nome do Cliente
                  </label>
                  <input
                    type="text"
                    required
                    value={receiptForm.customer_name}
                    onChange={(e) => setReceiptForm({ ...receiptForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    NIF
                  </label>
                  <input
                    type="text"
                    value={receiptForm.customer_nif || ''}
                    onChange={(e) => setReceiptForm({ ...receiptForm, customer_nif: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Meio de Pagamento *
                  </label>
                  <select
                    value={receiptForm.payment_method}
                    onChange={(e) =>
                      setReceiptForm({
                        ...receiptForm,
                        payment_method: e.target.value as PaymentMethodType,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                  >
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="MULTICAIXA">Multicaixa (TPA)</option>
                    <option value="NUMERARIO">Numerário (Dinheiro)</option>
                    <option value="GPO_REFERENCE">Referência Multicaixa (GPO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Montante a Quitar (Kz) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={receiptForm.total_amount}
                    onChange={(e) => setReceiptForm({ ...receiptForm, total_amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                  />
                </div>
              </div>

              {receiptForm.payment_method === 'TRANSFERENCIA' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Conta Bancária de Destino
                  </label>
                  <select
                    value={receiptForm.bank_account_id}
                    onChange={(e) => setReceiptForm({ ...receiptForm, bank_account_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Selecione a conta...</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.iban})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Notas / Referência do Pagamento
                </label>
                <input
                  type="text"
                  placeholder="ex: Comprovativo BAI n.º 982173"
                  value={receiptForm.notes || ''}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !receiptForm.customer_name ||
                  !receiptForm.total_amount ||
                  issueReceiptMutation.isPending
                }
                onClick={() =>
                  issueReceiptMutation.mutate({
                    customer_id: receiptForm.customer_id || '00000000-0000-0000-0000-000000000001',
                    customer_name: receiptForm.customer_name,
                    customer_nif: receiptForm.customer_nif || undefined,
                    payment_method: receiptForm.payment_method,
                    total_amount: receiptForm.total_amount,
                    currency: receiptForm.currency,
                    bank_account_id: receiptForm.bank_account_id || undefined,
                    notes: receiptForm.notes || undefined,
                    lines:
                      receiptForm.lines && receiptForm.lines.length > 0
                        ? receiptForm.lines.map((l) => ({
                            invoice_id: l.invoice_id,
                            invoice_number: l.invoice_number,
                            amount_settled: receiptForm.total_amount,
                            notes: l.notes || 'Liquidação integral',
                          }))
                        : [
                            {
                              invoice_id: '',
                              invoice_number: '',
                              amount_settled: receiptForm.total_amount,
                              notes: receiptForm.notes || 'Liquidação de fatura',
                            },
                          ],
                  })
                }
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                {issueReceiptMutation.isPending ? 'A emitir...' : 'Emitir Recibo RC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
