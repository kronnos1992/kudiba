import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  PlusCircle,
  Landmark,
  Wallet,
  X,
} from 'lucide-react';
import { GlassCard } from '../../../components/common/GlassCard';
import { KzAmount } from '../../../components/common/KzAmount';
import {
  treasuryApi,
  CashTransfer,
  CreateCashTransferPayload,
  BankAccount,
  CashRegister,
} from '../../../api/treasury';
import { toast } from '../../../stores/toastStore';

interface TransfersTabProps {
  tenantId?: string;
  bankAccounts: BankAccount[];
  registers: CashRegister[];
}

export const TransfersTab: React.FC<TransfersTabProps> = ({
  tenantId,
  bankAccounts,
  registers,
}) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState<CreateCashTransferPayload>({
    source_type: 'REGISTER',
    source_id: registers[0]?.id || '',
    target_type: 'BANK',
    target_id: bankAccounts[0]?.id || '',
    amount: 0,
    fee_amount: 0,
    currency: 'AOA',
    notes: '',
  });

  const { data: transfers = [], isLoading } = useQuery<CashTransfer[]>({
    queryKey: ['treasury_transfers', tenantId],
    queryFn: () => treasuryApi.listTransfers(),
    enabled: Boolean(tenantId),
  });

  const transferMutation = useMutation({
    mutationFn: (payload: CreateCashTransferPayload) => treasuryApi.executeTransfer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_transfers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_bank_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_registers'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_register_sessions'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_cash_flow'] });
      setShowModal(false);
      setForm({
        source_type: 'REGISTER',
        source_id: registers[0]?.id || '',
        target_type: 'BANK',
        target_id: bankAccounts[0]?.id || '',
        amount: 0,
        fee_amount: 0,
        currency: 'AOA',
        notes: '',
      });
      toast.success('Transferência interna efetuada com sucesso sem duplicação de receita/despesa.');
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail ||
          err?.response?.data?.title ||
          'Erro ao executar transferência interna.'
      );
    },
  });

  const totalTransferred = transfers.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalFees = transfers.reduce((sum, t) => sum + (Number(t.fee_amount) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Barra de Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
            <span>Transferências entre Contas Próprias &amp; Caixas</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Movimentos de caixa para banco (sangrias/depósitos), suprimentos e transferências interbancárias sem duplicação do fluxo de caixa.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Nova Transferência Interna</span>
        </button>
      </div>

      {/* KPIs Rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-3.5">
          <span className="text-xs font-semibold text-slate-500 uppercase">Volume de Transferências</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            <KzAmount value={totalTransferred} />
          </p>
          <span className="text-[11px] text-slate-400">Total movimentado entre contas e postos</span>
        </GlassCard>

        <GlassCard className="p-3.5">
          <span className="text-xs font-semibold text-slate-500 uppercase">Comissões Bancárias / STC</span>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            <KzAmount value={totalFees} />
          </p>
          <span className="text-[11px] text-slate-400">Custo operacional de transferências</span>
        </GlassCard>

        <GlassCard className="p-3.5">
          <span className="text-xs font-semibold text-slate-500 uppercase">Total de Operações</span>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {transfers.length} movimentos
          </p>
          <span className="text-[11px] text-slate-400">Auditados e consolidados</span>
        </GlassCard>
      </div>

      {/* Tabela de Transferências */}
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 text-left">Nº Transferência</th>
                <th className="py-3 px-3 text-left">Origem</th>
                <th className="py-3 px-3 text-center"></th>
                <th className="py-3 px-3 text-left">Destino</th>
                <th className="py-3 px-3 text-right">Montante</th>
                <th className="py-3 px-3 text-right">Comissão STC</th>
                <th className="py-3 px-3 text-left">Observações / Motivo</th>
                <th className="py-3 px-3 text-center">Data / Operador</th>
                <th className="py-3 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    A carregar transferências internas...
                  </td>
                </tr>
              ) : transfers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Nenhuma transferência interna registada até ao momento.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                      {t.transfer_number}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        {t.source_type === 'BANK' ? (
                          <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>
                          {t.source_name ||
                            (t.source_type === 'BANK'
                              ? bankAccounts.find((b) => b.id === t.source_id)?.bank_name || 'Conta Bancária'
                              : registers.find((r) => r.id === t.source_id)?.name || 'Caixa Físico')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {t.source_type}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center text-slate-400">
                      <ArrowLeftRight className="w-3.5 h-3.5 mx-auto" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                        {t.target_type === 'BANK' ? (
                          <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span>
                          {t.target_name ||
                            (t.target_type === 'BANK'
                              ? bankAccounts.find((b) => b.id === t.target_id)?.bank_name || 'Conta Bancária'
                              : registers.find((r) => r.id === t.target_id)?.name || 'Caixa Físico')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {t.target_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      <KzAmount value={t.amount} />
                    </td>
                    <td className="py-3 px-3 text-right text-rose-600 font-medium">
                      {Number(t.fee_amount) > 0 ? <KzAmount value={t.fee_amount} /> : '0 Kz'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {t.notes || '-'}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap text-[11px] text-slate-500">
                      <div>{new Date(t.transferred_at).toLocaleString('pt-AO')}</div>
                      <div className="text-[10px] text-slate-400">{t.operator_user_id}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        Concluída
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modal: Nova Transferência Interna */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                <span>Nova Transferência entre Contas Próprias</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amt = Number(form.amount);
                if (amt <= 0) {
                  toast.error('Informe um montante válido para transferência.');
                  return;
                }
                if (form.source_type === form.target_type && form.source_id === form.target_id) {
                  toast.error('A conta de origem e destino não podem ser as mesmas.');
                  return;
                }
                transferMutation.mutate(form);
              }}
              className="space-y-4 mt-4 text-xs"
            >
              {/* Origem */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                  1. Origem dos Fundos (Débito)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        source_type: 'REGISTER',
                        source_id: registers[0]?.id || '',
                      });
                    }}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      form.source_type === 'REGISTER'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Caixa Físico</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        source_type: 'BANK',
                        source_id: bankAccounts[0]?.id || '',
                      });
                    }}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      form.source_type === 'BANK'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Conta Bancária</span>
                  </button>
                </div>

                {form.source_type === 'REGISTER' ? (
                  <select
                    value={form.source_id}
                    onChange={(e) => setForm({ ...form, source_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800"
                  >
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={form.source_id}
                    onChange={(e) => setForm({ ...form, source_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.currency}) — Saldo: {Number(b.current_balance).toLocaleString('pt-AO')}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Destino */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                  2. Destino dos Fundos (Crédito)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        target_type: 'BANK',
                        target_id: bankAccounts[0]?.id || '',
                      });
                    }}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      form.target_type === 'BANK'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Conta Bancária</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        ...form,
                        target_type: 'REGISTER',
                        target_id: registers[0]?.id || '',
                      });
                    }}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      form.target_type === 'REGISTER'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Caixa Físico</span>
                  </button>
                </div>

                {form.target_type === 'BANK' ? (
                  <select
                    value={form.target_id}
                    onChange={(e) => setForm({ ...form, target_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800"
                  >
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} ({b.currency}) — Saldo: {Number(b.current_balance).toLocaleString('pt-AO')}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={form.target_id}
                    onChange={(e) => setForm({ ...form, target_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800"
                  >
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Valores */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Montante a Transferir (Kz) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.amount || ''}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-bold text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Comissão / Taxa STC (Kz)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 350.00"
                    value={form.fee_amount || ''}
                    onChange={(e) =>
                      setForm({ ...form, fee_amount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Observações / Justificativo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Depósito de sangria de caixa no balcão do BAI"
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {transferMutation.isPending ? 'A transferir...' : 'Confirmar Transferência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
