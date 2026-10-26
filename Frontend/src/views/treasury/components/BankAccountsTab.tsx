import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  X,
  ShieldCheck,
} from 'lucide-react';
import { GlassCard } from '../../../components/common/GlassCard';
import {
  treasuryApi,
  BankAccount,
  CreateBankAccountPayload,
  BankStatement,
  BankStatementLine,
  CreateBankStatementPayload,
  ReconcileLinePayload,
} from '../../../api/treasury';
import { toast } from '../../../stores/toastStore';

interface BankAccountsTabProps {
  tenantId?: string;
  bankAccounts: BankAccount[];
}

export const BankAccountsTab: React.FC<BankAccountsTabProps> = ({ tenantId: _tenantId, bankAccounts }) => {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(bankAccounts[0]?.id || '');
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

  // Modais
  const [showCreateBankModal, setShowCreateBankModal] = useState(false);
  const [showCreateStmtModal, setShowCreateStmtModal] = useState(false);
  const [reconcileTargetLine, setReconcileTargetLine] = useState<BankStatementLine | null>(null);
  const [reconcileType, setReconcileType] = useState<string>('RECEIPT');

  // Form Conta Bancária
  const [bankForm, setBankForm] = useState<CreateBankAccountPayload>({
    bank_name: 'Banco Angolano de Investimentos (BAI)',
    account_number: '',
    iban: 'AO06',
    currency: 'AOA',
    initial_balance: '0.00',
  });

  // Form Extrato
  const [stmtForm, setStmtForm] = useState<CreateBankStatementPayload>({
    reference_period: new Date().toISOString().slice(0, 7),
    start_balance: 0,
    end_balance: 0,
    statement_date: new Date().toISOString().split('T')[0],
    file_name: 'Extrato_Bancario.pdf',
  });

  // Queries
  const { data: statements = [] } = useQuery<BankStatement[]>({
    queryKey: ['treasury_statements', selectedAccountId],
    queryFn: () => (selectedAccountId ? treasuryApi.listBankStatements(selectedAccountId) : []),
    enabled: Boolean(selectedAccountId),
  });

  // Auto-selecionar primeiro extrato se houver
  React.useEffect(() => {
    if (statements.length > 0 && !selectedStatementId) {
      setSelectedStatementId(statements[0].id);
    }
  }, [statements, selectedStatementId]);

  const { data: statementLines = [], isLoading: linesLoading } = useQuery<BankStatementLine[]>({
    queryKey: ['treasury_statement_lines', selectedStatementId],
    queryFn: () => (selectedStatementId ? treasuryApi.listStatementLines(selectedStatementId) : []),
    enabled: Boolean(selectedStatementId),
  });

  // Mutations
  const createBankMutation = useMutation({
    mutationFn: (payload: CreateBankAccountPayload) => treasuryApi.createBankAccount(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_bank_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_cash_flow'] });
      setShowCreateBankModal(false);
      setBankForm({
        bank_name: 'Banco Angolano de Investimentos (BAI)',
        account_number: '',
        iban: 'AO06',
        currency: 'AOA',
        initial_balance: '0.00',
      });
      toast.success('Conta bancária registada com sucesso.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Erro ao criar conta bancária.');
    },
  });

  const createStmtMutation = useMutation({
    mutationFn: (payload: CreateBankStatementPayload) =>
      treasuryApi.createBankStatement(selectedAccountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_statements', selectedAccountId] });
      setShowCreateStmtModal(false);
      toast.success('Extrato bancário registado.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Erro ao registar extrato bancário.');
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: ({ lineId, payload }: { lineId: string; payload: ReconcileLinePayload }) =>
      treasuryApi.reconcileLine(lineId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury_statement_lines', selectedStatementId] });
      queryClient.invalidateQueries({ queryKey: ['treasury_bank_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['treasury_cash_flow'] });
      setReconcileTargetLine(null);
      toast.success('Movimento bancário conciliado com sucesso.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Erro ao conciliar movimento.');
    },
  });

  const selectedAccount = bankAccounts.find((b) => b.id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* Barra de Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            <span>Contas Bancárias &amp; Conciliação</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão de contas autorizadas (IBAN AO06), extratos bancários periódicos e conferência contábil de saldos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateBankModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Adicionar Conta Bancária</span>
          </button>
        </div>
      </div>

      {/* Cartões das Contas Bancárias */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {bankAccounts.map((account) => {
          const isSelected = account.id === selectedAccountId;

          return (
            <div
              key={account.id}
              onClick={() => {
                setSelectedAccountId(account.id);
                setSelectedStatementId(null);
              }}
              className={`cursor-pointer rounded-2xl p-4 border transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-md ring-2 ring-emerald-500'
                  : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:border-emerald-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold truncate max-w-[170px]">{account.bank_name}</span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {account.currency}
                </span>
              </div>

              <div className="mt-3">
                <span
                  className={`text-[11px] font-medium block ${
                    isSelected ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Saldo Atual
                </span>
                <div className="text-xl font-black mt-0.5">
                  {Number(account.current_balance).toLocaleString('pt-AO', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  {account.currency}
                </div>
              </div>

              <div
                className={`mt-3 pt-2.5 border-t text-[11px] flex items-center justify-between font-mono ${
                  isSelected
                    ? 'border-white/10 dark:border-slate-900/10 text-slate-300 dark:text-slate-600'
                    : 'border-slate-100 dark:border-slate-800 text-slate-400'
                }`}
              >
                <span>IBAN:</span>
                <span className="truncate max-w-[130px]">{account.iban}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel do Extrato & Conciliação da Conta Selecionada */}
      {selectedAccount && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Extratos Bancários — {selectedAccount.bank_name}</span>
              </h4>
              <p className="text-xs text-slate-500">
                IBAN: <strong className="font-mono text-slate-700 dark:text-slate-300">{selectedAccount.iban}</strong> • Moeda: <strong>{selectedAccount.currency}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {statements.length > 0 && (
                <select
                  value={selectedStatementId || ''}
                  onChange={(e) => setSelectedStatementId(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none"
                >
                  {statements.map((s) => (
                    <option key={s.id} value={s.id}>
                      Período {s.reference_period} ({s.statement_date})
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => setShowCreateStmtModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Importar / Registar Extrato</span>
              </button>
            </div>
          </div>

          {/* Tabela de Linhas do Extrato */}
          <GlassCard className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-3 text-left">Data</th>
                    <th className="py-3 px-3 text-left">Descrição do Movimento</th>
                    <th className="py-3 px-3 text-left">Referência / Documento</th>
                    <th className="py-3 px-3 text-right">Montante</th>
                    <th className="py-3 px-3 text-right">Saldo Contabilístico</th>
                    <th className="py-3 px-3 text-center">Reconciliação</th>
                    <th className="py-3 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {linesLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        A carregar movimentos do extrato...
                      </td>
                    </tr>
                  ) : statementLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum extrato bancário ou movimento registado para esta conta.
                      </td>
                    </tr>
                  ) : (
                    statementLines.map((line) => {
                      const isCredit = line.movement_type === 'CREDIT' || Number(line.amount) > 0;

                      return (
                        <tr
                          key={line.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                            {line.line_date}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white max-w-xs truncate">
                            {line.description}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {line.document_ref || '-'}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-bold whitespace-nowrap ${
                              isCredit ? 'text-teal-600 dark:text-teal-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isCredit ? '+' : ''}
                            {Number(line.amount).toLocaleString('pt-AO', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            {selectedAccount.currency}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {Number(line.balance_after).toLocaleString('pt-AO', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            {selectedAccount.currency}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {line.is_reconciled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Conciliado ({line.matched_type || 'CONFERIDO'})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                <Clock className="w-3 h-3" />
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {!line.is_reconciled && (
                              <button
                                onClick={() => setReconcileTargetLine(line)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition-colors"
                              >
                                Conciliar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modal: Adicionar Conta Bancária */}
      {showCreateBankModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                <span>Adicionar Conta Bancária</span>
              </h3>
              <button
                onClick={() => setShowCreateBankModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBankMutation.mutate(bankForm);
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Banco *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Banco de Fomento Angola (BFA)"
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Número de Conta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="0006-0000-XXXX-XXXX-XX"
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  IBAN Angolano (AO06...) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="AO0600060000XXXXXXXXXXXXX"
                  value={bankForm.iban}
                  onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Moeda
                  </label>
                  <select
                    value={bankForm.currency}
                    onChange={(e) => setBankForm({ ...bankForm, currency: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                  >
                    <option value="AOA">AOA (Kwanza)</option>
                    <option value="USD">USD (Dólar)</option>
                    <option value="EUR">EUR (Euro)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Saldo Inicial
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bankForm.initial_balance}
                    onChange={(e) => setBankForm({ ...bankForm, initial_balance: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateBankModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createBankMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {createBankMutation.isPending ? 'A registar...' : 'Guardar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Registar Extrato */}
      {showCreateStmtModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Registar Extrato Bancário</span>
              </h3>
              <button
                onClick={() => setShowCreateStmtModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createStmtMutation.mutate(stmtForm);
              }}
              className="space-y-4 mt-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Período de Referência *
                </label>
                <input
                  type="text"
                  required
                  placeholder="YYYY-MM (e.g. 2026-10)"
                  value={stmtForm.reference_period}
                  onChange={(e) => setStmtForm({ ...stmtForm, reference_period: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Saldo Inicial Extrato
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={stmtForm.start_balance}
                    onChange={(e) =>
                      setStmtForm({ ...stmtForm, start_balance: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Saldo Final Extrato
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={stmtForm.end_balance}
                    onChange={(e) =>
                      setStmtForm({ ...stmtForm, end_balance: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Data de Emissão do Extrato
                </label>
                <input
                  type="date"
                  required
                  value={stmtForm.statement_date}
                  onChange={(e) => setStmtForm({ ...stmtForm, statement_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateStmtModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createStmtMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                >
                  {createStmtMutation.isPending ? 'A criar...' : 'Confirmar Extrato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Conciliar Linha */}
      {reconcileTargetLine && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Conciliar Movimento Bancário</span>
              </h3>
              <button
                onClick={() => setReconcileTargetLine(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
              <div>
                Descrição: <strong>{reconcileTargetLine.description}</strong>
              </div>
              <div>
                Montante:{' '}
                <strong className="text-emerald-600">
                  {Number(reconcileTargetLine.amount).toLocaleString('pt-AO', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  Kz
                </strong>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Natureza da Conciliação
              </label>
              <select
                value={reconcileType}
                onChange={(e) => setReconcileType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800"
              >
                <option value="RECEIPT">Recibo de Quitação (RC) / Venda</option>
                <option value="PAYABLE">Pagamento a Fornecedor</option>
                <option value="TRANSFER">Transferência Interna entre Contas</option>
                <option value="COMMISSION">Comissão Bancária / TPA EMIS</option>
                <option value="OTHER">Outro Débito/Crédito Autorizado</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReconcileTargetLine(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={reconcileMutation.isPending}
                onClick={() => {
                  reconcileMutation.mutate({
                    lineId: reconcileTargetLine.id,
                    payload: { matched_type: reconcileType },
                  });
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm"
              >
                {reconcileMutation.isPending ? 'A conciliar...' : 'Marcar como Conciliado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
