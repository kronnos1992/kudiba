import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusCircle,
  Search,
  AlertTriangle,
  CreditCard,
  X,
  FileText,
  Receipt,
} from 'lucide-react';
import { GlassCard } from '../../../components/common/GlassCard';
import { KzAmount } from '../../../components/common/KzAmount';
import {
  treasuryApi,
  InvoicePayable,
  CreatePayablePayload,
  SettlePayablePayload,
  BankAccount,
  PaymentMethodType,
} from '../../../api/treasury';
import { toast } from '../../../stores/toastStore';

interface PayablesTabProps {
  tenantId?: string;
  bankAccounts: BankAccount[];
}

export const PayablesTab: React.FC<PayablesTabProps> = ({ tenantId, bankAccounts }) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activityFilter, setActivityFilter] = useState<string>('ALL');

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState<InvoicePayable | null>(null);
  const [historyTarget, setHistoryTarget] = useState<InvoicePayable | null>(null);

  // Form de Nova Fatura
  const [createForm, setCreateForm] = useState<CreatePayablePayload>({
    supplier_name: '',
    supplier_nif: '',
    invoice_number: '',
    activity_type: 'OPERATIONAL',
    category: 'FORNECEDORES_MERCADORIAS',
    currency: 'AOA',
    gross_total: 0,
    withholding_rate: 0,
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    issue_date: new Date().toISOString().split('T')[0],
    payment_method: 'TRANSFERENCIA',
    notes: '',
  });
  const [applyWithholding, setApplyWithholding] = useState(false);

  // Form de Liquidação
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleBankId, setSettleBankId] = useState<string>('');
  const [settleMethod, setSettleMethod] = useState<PaymentMethodType>('TRANSFERENCIA');
  const [settleRef, setSettleRef] = useState<string>('');
  const [settleNotes, setSettleNotes] = useState<string>('');

  // Queries
  const { data: payables = [], isLoading } = useQuery<InvoicePayable[]>({
    queryKey: ['treasury_payables', tenantId, statusFilter, activityFilter],
    queryFn: () =>
      treasuryApi.listPayables({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        activity_type: activityFilter === 'ALL' ? undefined : activityFilter,
      }),
    enabled: Boolean(tenantId),
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ['treasury_settlements', historyTarget?.id],
    queryFn: () => (historyTarget ? treasuryApi.listPayableSettlements(historyTarget.id) : []),
    enabled: Boolean(historyTarget),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: CreatePayablePayload) => treasuryApi.createPayable(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_payables'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_cash_flow'] });
      setShowCreateModal(false);
      setCreateForm({
        supplier_name: '',
        supplier_nif: '',
        invoice_number: '',
        activity_type: 'OPERATIONAL',
        category: 'FORNECEDORES_MERCADORIAS',
        currency: 'AOA',
        gross_total: 0,
        withholding_rate: 0,
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        issue_date: new Date().toISOString().split('T')[0],
        payment_method: 'TRANSFERENCIA',
        notes: '',
      });
      setApplyWithholding(false);
      toast.success('Fatura de fornecedor registada com sucesso.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.response?.data?.title || 'Erro ao criar fatura a pagar.');
    },
  });

  const settleMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SettlePayablePayload }) =>
      treasuryApi.settlePayable(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_payables'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_bank_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_cash_flow'] });
      setSettleTarget(null);
      setSettleAmount('');
      setSettleRef('');
      setSettleNotes('');
      toast.success('Pagamento liquidado e debitado na conta bancária selecionada.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || err?.response?.data?.title || 'Erro ao liquidar pagamento.');
    },
  });

  const handleOpenSettle = (p: InvoicePayable) => {
    const remaining = Number(p.net_payable) - Number(p.amount_paid);
    setSettleTarget(p);
    setSettleAmount(remaining.toFixed(2));
    setSettleBankId(bankAccounts.find((b) => b.is_active && b.currency === 'AOA')?.id || '');
    setSettleMethod((p.payment_method as PaymentMethodType) || 'TRANSFERENCIA');
    setSettleRef('');
    setSettleNotes('');
  };

  const handleExecuteSettle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Informe um montante válido a liquidar.');
      return;
    }

    settleMutation.mutate({
      id: settleTarget.id,
      payload: {
        bank_account_id: settleBankId || undefined,
        amount_paid: amount,
        payment_method: settleMethod,
        payment_reference: settleRef || undefined,
        notes: settleNotes || undefined,
      },
    });
  };

  const filtered = payables.filter((p) => {
    const matchSearch =
      p.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.supplier_nif && p.supplier_nif.includes(searchTerm));
    return matchSearch;
  });

  const totalOutstanding = payables.reduce((sum, p) => {
    if (p.status !== 'SETTLED') {
      return sum + (Number(p.net_payable) - Number(p.amount_paid));
    }
    return sum;
  }, 0);

  const totalWithholdingToDeliver = payables.reduce((sum, p) => {
    return sum + (Number(p.withholding_amount) || 0);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Barra de Ações & Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por fornecedor, NIF ou fatura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todos os Estados</option>
            <option value="OUTSTANDING">Pendentes</option>
            <option value="PARTIALLY_PAID">Parcialmente Pagas</option>
            <option value="SETTLED">Liquidadas</option>
          </select>

          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">Todas as Atividades</option>
            <option value="OPERATIONAL">Operacional</option>
            <option value="INVESTMENT">Investimento</option>
            <option value="FINANCING">Financiamento</option>
          </select>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Fatura de Fornecedor</span>
        </button>
      </div>

      {/* Resumo de Contas a Pagar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-3.5">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total a Pagar Pendente</span>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            <KzAmount value={totalOutstanding} />
          </p>
          <span className="text-[11px] text-slate-400">
            Compromissos contratuais de curto prazo
          </span>
        </GlassCard>

        <GlassCard className="p-3.5">
          <span className="text-xs font-semibold text-slate-500 uppercase">Retenções na Fonte (AGT 6.5%)</span>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            <KzAmount value={totalWithholdingToDeliver} />
          </p>
          <span className="text-[11px] text-slate-400">
            A liquidar à AGT até ao final do mês seguinte
          </span>
        </GlassCard>

        <GlassCard className="p-3.5">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total de Faturas</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {filtered.length} faturas
          </p>
          <span className="text-[11px] text-slate-400">
            {filtered.filter((p) => p.status === 'SETTLED').length} liquidadas •{' '}
            {filtered.filter((p) => p.status !== 'SETTLED').length} pendentes
          </span>
        </GlassCard>
      </div>

      {/* Tabela de Contas a Pagar */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 text-left">Fornecedor</th>
                <th className="py-3 px-3 text-left">Nº Fatura</th>
                <th className="py-3 px-3 text-left">Atividade</th>
                <th className="py-3 px-3 text-center">Vencimento</th>
                <th className="py-3 px-3 text-right">Valor Bruto</th>
                <th className="py-3 px-3 text-right">Retenção 6.5%</th>
                <th className="py-3 px-3 text-right">Líquido a Pagar</th>
                <th className="py-3 px-3 text-right">Pago</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    A carregar contas a pagar...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Nenhuma fatura de fornecedor encontrada para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const remaining = Number(p.net_payable) - Number(p.amount_paid);
                  const isSettled = p.status === 'SETTLED';
                  const isPartiallyPaid = p.status === 'PARTIALLY_PAID';
                  const isOverdue =
                    !isSettled && new Date(p.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                        <div className="font-semibold">{p.supplier_name}</div>
                        {p.supplier_nif && (
                          <div className="text-[10px] text-slate-400">NIF: {p.supplier_nif}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {p.invoice_number}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.activity_type === 'OPERATIONAL'
                            ? 'Operacional'
                            : p.activity_type === 'INVESTMENT'
                            ? 'Investimento'
                            : 'Financiamento'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isOverdue && <AlertTriangle className="w-3 h-3" />}
                          {p.due_date}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400">
                        <KzAmount value={p.gross_total} />
                      </td>
                      <td className="py-3 px-3 text-right text-amber-600 font-medium">
                        {Number(p.withholding_amount) > 0 ? (
                          <KzAmount value={p.withholding_amount} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        <div><KzAmount value={p.net_payable} /></div>
                        {!isSettled && (
                          <div className="text-[10px] text-rose-500 font-medium">
                            Resta: <KzAmount value={remaining} />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-semibold">
                        <KzAmount value={p.amount_paid} />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isSettled ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            Liquidada
                          </span>
                        ) : isPartiallyPaid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            Parcial ({Math.round((Number(p.amount_paid) / Number(p.net_payable)) * 100)}%)
                          </span>
                        ) : isOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                            Vencida
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isSettled && (
                            <button
                              onClick={() => handleOpenSettle(p)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors"
                            >
                              Liquidar
                            </button>
                          )}
                          <button
                            onClick={() => setHistoryTarget(p)}
                            className="px-2 py-1 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[11px] font-medium transition-colors"
                          >
                            Histórico
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal: Nova Fatura de Fornecedor */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <span>Nova Fatura de Fornecedor</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const gross = Number(createForm.gross_total);
                if (gross <= 0) {
                  toast.error('O montante da fatura deve ser superior a zero.');
                  return;
                }
                createMutation.mutate({
                  ...createForm,
                  withholding_rate: applyWithholding ? 6.5 : 0,
                });
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Fornecedor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AngoAlissar Comércio Geral"
                    value={createForm.supplier_name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, supplier_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    NIF do Fornecedor
                  </label>
                  <input
                    type="text"
                    placeholder="54XXXXXXXX"
                    value={createForm.supplier_nif || ''}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, supplier_nif: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nº da Fatura do Fornecedor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="FT FORN/2026/001"
                    value={createForm.invoice_number}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, invoice_number: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Atividade (PGC)
                  </label>
                  <select
                    value={createForm.activity_type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, activity_type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                  >
                    <option value="OPERATIONAL">Atividade Operacional</option>
                    <option value="INVESTMENT">Atividade de Investimento</option>
                    <option value="FINANCING">Atividade de Financiamento</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, category: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                  >
                    <option value="FORNECEDORES_MERCADORIAS">Mercadorias / Stocks</option>
                    <option value="SERVICOS_TERCEIROS">Prestação de Serviços</option>
                    <option value="EQUIPAMENTOS">Equipamentos / TI</option>
                    <option value="COMBUSTIVEL">Combustíveis / Logística</option>
                    <option value="OUTROS">Outras Despesas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor Bruto da Fatura (Kz) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={createForm.gross_total || ''}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        gross_total: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data de Vencimento *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.due_date}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, due_date: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Retenção na Fonte AGT (6.5%) */}
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={applyWithholding}
                    onChange={(e) => setApplyWithholding(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Aplicar Retenção na Fonte AGT (6.50% - Serviços de Terceiros)</span>
                </label>
                {applyWithholding && (
                  <div className="mt-2 text-xs grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                    <div>
                      Retenção AGT: <strong>{(Number(createForm.gross_total) * 0.065).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</strong>
                    </div>
                    <div>
                      Líquido a Pagar ao Fornecedor: <strong>{(Number(createForm.gross_total) * 0.935).toLocaleString('pt-AO', { minimumFractionDigits: 2 })} Kz</strong>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Justificativo
                </label>
                <textarea
                  rows={2}
                  value={createForm.notes || ''}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {createMutation.isPending ? 'A registar...' : 'Registar Fatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Liquidar Conta a Pagar */}
      {settleTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Liquidar Fatura de Fornecedor</span>
              </h3>
              <button
                onClick={() => setSettleTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Fornecedor:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {settleTarget.supplier_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Nº Fatura:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">
                  {settleTarget.invoice_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Saldo Pendente:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  <KzAmount
                    value={Number(settleTarget.net_payable) - Number(settleTarget.amount_paid)}
                  />
                </span>
              </div>
            </div>

            <form onSubmit={handleExecuteSettle} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Montante a Liquidar (Kz) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Conta Bancária de Débito *
                </label>
                <select
                  required
                  value={settleBankId}
                  onChange={(e) => setSettleBankId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                >
                  <option value="">Selecione a conta bancária...</option>
                  {bankAccounts
                    .filter((b) => b.is_active)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} — Saldo: {Number(b.current_balance).toLocaleString('pt-AO')}{' '}
                        {b.currency}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Forma de Pagamento
                  </label>
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value as PaymentMethodType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                  >
                    <option value="TRANSFERENCIA">Transferência Bancária</option>
                    <option value="MULTICAIXA_EXPRESS">MULTICAIXA Express</option>
                    <option value="MULTICAIXA">Cartão / TPA</option>
                    <option value="GPO_REFERENCE">Pagamento por Referência</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nº Comprovativo / Ref.
                  </label>
                  <input
                    type="text"
                    placeholder="TRF-BAI-XXXX"
                    value={settleRef}
                    onChange={(e) => setSettleRef(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notas de Liquidação
                </label>
                <input
                  type="text"
                  placeholder="Pagamento autorizado pela gerência"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSettleTarget(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={settleMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {settleMutation.isPending ? 'A debitar...' : 'Confirmar Liquidação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Histórico de Liquidações */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <span>Histórico de Pagamentos — {historyTarget.invoice_number}</span>
              </h3>
              <button
                onClick={() => setHistoryTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2 text-xs max-h-80 overflow-y-auto">
              {settlements.length === 0 ? (
                <p className="text-center py-6 text-slate-400">
                  Nenhum pagamento registado para esta fatura até ao momento.
                </p>
              ) : (
                settlements.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {s.payment_method} • {s.payment_reference || 'Sem referência'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Liquidado em: {new Date(s.settled_at).toLocaleString('pt-AO')} por {s.operator_user_id}
                      </p>
                      {s.notes && <p className="text-[11px] text-slate-500 italic mt-0.5">{s.notes}</p>}
                    </div>
                    <span className="font-bold text-sm text-emerald-600">
                      <KzAmount value={s.amount_paid} />
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setHistoryTarget(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg font-semibold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
