import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Scale,
  Calendar,
  Layers,
  PlusCircle,
  Download,
  Search,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRightLeft,
  X,
  FileText,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  accountingApi,
  JournalEntryResponse,
  PostManualEntryPayload,
  CreateAccountPayload,
  CreateJournalPayload,
  CurrencyRevaluationPayload,
} from '../../api/accounting';

type AccountingTab = 'trial_balance' | 'entries' | 'chart' | 'journals_years' | 'revaluation';

const PGC_CLASSES: { id: string; name: string; prefix: string; desc: string }[] = [
  { id: 'all', name: 'Todas as Classes', prefix: '', desc: 'Todas as contas' },
  { id: '1', name: 'Classe 1', prefix: '1', desc: 'Meios Financeiros Líquidos (Caixa, Bancos)' },
  { id: '2', name: 'Classe 2', prefix: '2', desc: 'Existências (Mercadorias, Matérias-Primas)' },
  { id: '3', name: 'Classe 3', prefix: '3', desc: 'Terceiros (Clientes, Fornecedores, Estado, Pessoal)' },
  { id: '4', name: 'Classe 4', prefix: '4', desc: 'Meios Fixos e Investimentos (Ativos Não Correntes)' },
  { id: '5', name: 'Classe 5', prefix: '5', desc: 'Capital e Reservas (Património Líquido)' },
  { id: '6', name: 'Classe 6', prefix: '6', desc: 'Custos e Perdas por Natureza (Despesas)' },
  { id: '7', name: 'Classe 7', prefix: '7', desc: 'Proveitos e Ganhos por Natureza (Receitas)' },
  { id: '8', name: 'Classe 8', prefix: '8', desc: 'Resultados (Apuramento e Resultado Líquido)' },
];

export const AccountingView: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AccountingTab>('trial_balance');

  // Balancete filters
  const [trialBalanceColumns, setTrialBalanceColumns] = useState<4 | 6>(6);
  const [trialBalanceFilterClass, setTrialBalanceFilterClass] = useState<string>('all');
  const [trialBalanceSearch, setTrialBalanceSearch] = useState('');
  const [onlyMovedAccounts, setOnlyMovedAccounts] = useState(false);

  // Livro Diário filters
  const [entriesJournalFilter, setEntriesJournalFilter] = useState<string>('all');
  const [entriesSearch, setEntriesSearch] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryResponse | null>(null);

  // PGC Chart filters
  const [chartClassFilter, setChartClassFilter] = useState<string>('all');
  const [chartSearch, setChartSearch] = useState('');
  const [onlyAnalytical, setOnlyAnalytical] = useState(false);

  // Modals state
  const [isPostEntryModalOpen, setIsPostEntryModalOpen] = useState(false);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [isCreateJournalModalOpen, setIsCreateJournalModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState('');

  // Queries
  const { data: chart = [], isLoading: isLoadingChart } = useQuery({
    queryKey: ['accounting_chart'],
    queryFn: accountingApi.getChart,
  });

  const { data: trialBalance, isLoading: isLoadingTrialBalance } = useQuery({
    queryKey: ['accounting_trial_balance'],
    queryFn: () => accountingApi.getTrialBalance(),
  });

  const { data: entries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ['accounting_entries', entriesJournalFilter],
    queryFn: () =>
      accountingApi.listEntries({
        journal_id: entriesJournalFilter === 'all' ? undefined : entriesJournalFilter,
        limit: 100,
      }),
  });

  const { data: journals = [] } = useQuery({
    queryKey: ['accounting_journals'],
    queryFn: accountingApi.listJournals,
  });

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ['accounting_fiscal_years'],
    queryFn: accountingApi.listFiscalYears,
  });

  // Mutations
  const seedPgcMutation = useMutation({
    mutationFn: accountingApi.seedStandardPgc,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_chart'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_journals'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_trial_balance'] });
    },
  });

  const reverseEntryMutation = useMutation({
    mutationFn: accountingApi.reverseEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_trial_balance'] });
      setIsReverseModalOpen(false);
      setSelectedEntry(null);
      setReverseReason('');
    },
  });

  // Novo Lançamento Form State
  const [manualEntryForm, setManualEntryForm] = useState<{
    fiscal_year: number;
    journal_code: string;
    transaction_date: string;
    period: number;
    description: string;
    lines: Array<{
      account_code: string;
      description: string;
      debit_amount: string;
      credit_amount: string;
    }>;
  }>({
    fiscal_year: new Date().getFullYear(),
    journal_code: 'OD',
    transaction_date: new Date().toISOString().split('T')[0],
    period: new Date().getMonth() + 1,
    description: '',
    lines: [
      { account_code: '', description: '', debit_amount: '', credit_amount: '' },
      { account_code: '', description: '', debit_amount: '', credit_amount: '' },
    ],
  });

  const postEntryMutation = useMutation({
    mutationFn: accountingApi.postManualEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_trial_balance'] });
      setIsPostEntryModalOpen(false);
      setManualEntryForm({
        fiscal_year: new Date().getFullYear(),
        journal_code: 'OD',
        transaction_date: new Date().toISOString().split('T')[0],
        period: new Date().getMonth() + 1,
        description: '',
        lines: [
          { account_code: '', description: '', debit_amount: '', credit_amount: '' },
          { account_code: '', description: '', debit_amount: '', credit_amount: '' },
        ],
      });
    },
  });

  // Nova Conta Form State
  const [newAccountForm, setNewAccountForm] = useState<CreateAccountPayload>({
    account_code: '',
    parent_account_code: '',
    account_name: '',
    account_nature: 'DEBIT',
    is_analytical: true,
    saft_grouping_code: '',
  });

  const createAccountMutation = useMutation({
    mutationFn: accountingApi.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_chart'] });
      setIsCreateAccountModalOpen(false);
      setNewAccountForm({
        account_code: '',
        parent_account_code: '',
        account_name: '',
        account_nature: 'DEBIT',
        is_analytical: true,
        saft_grouping_code: '',
      });
    },
  });

  // Novo Diário Form State
  const [newJournalForm, setNewJournalForm] = useState<CreateJournalPayload>({
    code: '',
    name: '',
    journal_type: 'OPERATIONS',
  });

  const createJournalMutation = useMutation({
    mutationFn: accountingApi.createJournal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_journals'] });
      setIsCreateJournalModalOpen(false);
      setNewJournalForm({ code: '', name: '', journal_type: 'OPERATIONS' });
    },
  });

  // Reavaliação Cambial Form State
  const [revalForm, setRevalForm] = useState<CurrencyRevaluationPayload>({
    fiscal_year: new Date().getFullYear(),
    period: new Date().getMonth() + 1,
    revaluation_date: new Date().toISOString().split('T')[0],
    target_account_code: '12.2',
    currency: 'USD',
    foreign_balance: 1000,
    new_exchange_rate: 935.5,
    previous_book_value_kz: 900000,
    notes: 'Ajuste Cambial Fim do Mês',
  });

  const revaluationMutation = useMutation({
    mutationFn: accountingApi.revalueCurrency,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_trial_balance'] });
    },
  });

  // Download SAF-T Accounting XML
  const handleDownloadSaft = async () => {
    try {
      const blob = await accountingApi.downloadSaftXml({ year: new Date().getFullYear() });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAFT_AO_Accounting_${new Date().getFullYear()}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Falha ao exportar SAF-T de contabilidade', err);
    }
  };

  // Calculations for manual entry validation
  const calculatedEntryTotals = useMemo(() => {
    let deb = 0;
    let cred = 0;
    manualEntryForm.lines.forEach((l) => {
      const d = parseFloat(l.debit_amount) || 0;
      const c = parseFloat(l.credit_amount) || 0;
      deb += d;
      cred += c;
    });
    const diff = Math.abs(deb - cred);
    const isBalanced = deb > 0 && diff < 0.0001;
    return { deb, cred, diff, isBalanced };
  }, [manualEntryForm.lines]);

  // Analytical accounts for dropdown
  const analyticalAccounts = useMemo(() => {
    return chart.filter((a) => a.is_analytical);
  }, [chart]);

  // Filtered trial balance rows
  const filteredTrialBalanceRows = useMemo(() => {
    if (!trialBalance?.rows) return [];
    return trialBalance.rows.filter((row) => {
      if (trialBalanceFilterClass !== 'all' && !row.account_code.startsWith(trialBalanceFilterClass)) {
        return false;
      }
      if (onlyMovedAccounts) {
        const pd = parseFloat(String(row.period_debit)) || 0;
        const pc = parseFloat(String(row.period_credit)) || 0;
        const od = parseFloat(String(row.opening_debit)) || 0;
        const oc = parseFloat(String(row.opening_credit)) || 0;
        if (pd === 0 && pc === 0 && od === 0 && oc === 0) return false;
      }
      if (trialBalanceSearch) {
        const q = trialBalanceSearch.toLowerCase();
        return (
          row.account_code.toLowerCase().includes(q) ||
          row.account_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [trialBalance, trialBalanceFilterClass, onlyMovedAccounts, trialBalanceSearch]);

  // Filtered accounts for Chart of Accounts tab
  const filteredChartAccounts = useMemo(() => {
    return chart.filter((a) => {
      if (chartClassFilter !== 'all' && !a.account_code.startsWith(chartClassFilter)) {
        return false;
      }
      if (onlyAnalytical && !a.is_analytical) {
        return false;
      }
      if (chartSearch) {
        const q = chartSearch.toLowerCase();
        return (
          a.account_code.toLowerCase().includes(q) ||
          a.account_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [chart, chartClassFilter, onlyAnalytical, chartSearch]);

  // Filtered entries for General Ledger tab
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (entriesSearch) {
        const q = entriesSearch.toLowerCase();
        return (
          e.description.toLowerCase().includes(q) ||
          (e.source_document_ref && e.source_document_ref.toLowerCase().includes(q)) ||
          String(e.entry_number).includes(q)
        );
      }
      return true;
    });
  }, [entries, entriesSearch]);

  const activeYear = fiscalYears.find((y) => y.status === 'OPEN') || fiscalYears[0];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Contabilidade Geral &amp; PGC Angolano
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              Classes 1 a 8
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Plano Geral de Contabilidade de Angola, lançamentos em partidas dobradas, balancetes de 4 e 6 colunas e exportação SAF-T AO
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsPostEntryModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Lançamento
          </button>

          <button
            onClick={handleDownloadSaft}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition"
            title="Descarregar ficheiro oficial SAF-T AO Accounting em XML"
          >
            <Download className="w-4 h-4" />
            SAF-T AO (XML)
          </button>

          {chart.length === 0 && (
            <button
              onClick={() => seedPgcMutation.mutate()}
              disabled={seedPgcMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm transition"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              {seedPgcMutation.isPending ? 'A inicializar...' : 'Inicializar PGC'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Equilíbrio Contabilístico
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              {trialBalance?.is_balanced !== false ? (
                <StatusBadge status="ok" label="Partidas Equilibradas" />
              ) : (
                <StatusBadge status="critico" label="Desequilíbrio Detetado" />
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Débitos (Período)
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              <KzAmount value={parseFloat(String(trialBalance?.total_period_debit || 0))} />
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Créditos (Período)
            </span>
            <span className="text-lg font-bold text-slate-900 dark:text-white">
              <KzAmount value={parseFloat(String(trialBalance?.total_period_credit || 0))} />
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Exercício Fiscal
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {activeYear?.year_code || new Date().getFullYear()}
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {activeYear?.status === 'OPEN' ? 'ABERTO' : 'ENCERRADO'}
              </span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'trial_balance'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Scale className="w-4 h-4" />
            Balancete de Verificação
          </button>

          <button
            onClick={() => setActiveTab('entries')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'entries'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Livro Diário de Lançamentos ({entries.length})
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'chart'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Layers className="w-4 h-4" />
            Plano de Contas PGC ({chart.length})
          </button>

          <button
            onClick={() => setActiveTab('journals_years')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'journals_years'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Diários &amp; Exercícios
          </button>

          <button
            onClick={() => setActiveTab('revaluation')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'revaluation'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Reavaliação Cambial
          </button>
        </nav>
      </div>

      {/* TAB 1: BALANCETE DE VERIFICAÇÃO */}
      {activeTab === 'trial_balance' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar por código ou conta..."
                  value={trialBalanceSearch}
                  onChange={(e) => setTrialBalanceSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={trialBalanceFilterClass}
                onChange={(e) => setTrialBalanceFilterClass(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PGC_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.prefix ? `(${c.prefix})` : ''}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyMovedAccounts}
                  onChange={(e) => setOnlyMovedAccounts(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Apenas com movimento
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Modelo:</span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setTrialBalanceColumns(4)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    trialBalanceColumns === 4
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  4 Colunas
                </button>
                <button
                  type="button"
                  onClick={() => setTrialBalanceColumns(6)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    trialBalanceColumns === 6
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  6 Colunas (Completo)
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Table */}
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="p-3 w-28">Código</th>
                    <th className="p-3">Designação da Conta</th>
                    {trialBalanceColumns === 6 && (
                      <>
                        <th className="p-3 text-right bg-slate-100/50 dark:bg-slate-800/50">
                          S. Inicial Déb.
                        </th>
                        <th className="p-3 text-right bg-slate-100/50 dark:bg-slate-800/50">
                          S. Inicial Créd.
                        </th>
                      </>
                    )}
                    <th className="p-3 text-right text-blue-700 dark:text-blue-400">
                      Mov. Débito
                    </th>
                    <th className="p-3 text-right text-indigo-700 dark:text-indigo-400">
                      Mov. Crédito
                    </th>
                    <th className="p-3 text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-extrabold">
                      Saldo Devedor
                    </th>
                    <th className="p-3 text-right bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-extrabold">
                      Saldo Credor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                  {isLoadingTrialBalance ? (
                    <tr>
                      <td
                        colSpan={trialBalanceColumns === 6 ? 8 : 6}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        A carregar balancete de verificação...
                      </td>
                    </tr>
                  ) : filteredTrialBalanceRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={trialBalanceColumns === 6 ? 8 : 6}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        Nenhuma conta encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTrialBalanceRows.map((r) => {
                      const isSynthetic = !r.is_analytical;
                      return (
                        <tr
                          key={r.account_code}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                            isSynthetic
                              ? 'bg-slate-50/40 dark:bg-slate-800/20 font-bold text-slate-900 dark:text-white'
                              : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <td className="p-2.5 font-bold">{r.account_code}</td>
                          <td className="p-2.5 font-sans font-medium">{r.account_name}</td>
                          {trialBalanceColumns === 6 && (
                            <>
                              <td className="p-2.5 text-right text-slate-500">
                                {parseFloat(String(r.opening_debit)) > 0 ? (
                                  <KzAmount value={parseFloat(String(r.opening_debit))} />
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="p-2.5 text-right text-slate-500">
                                {parseFloat(String(r.opening_credit)) > 0 ? (
                                  <KzAmount value={parseFloat(String(r.opening_credit))} />
                                ) : (
                                  '-'
                                )}
                              </td>
                            </>
                          )}
                          <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                            {parseFloat(String(r.period_debit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.period_debit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                            {parseFloat(String(r.period_credit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.period_credit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                            {parseFloat(String(r.closing_debit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.closing_debit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-2.5 text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10">
                            {parseFloat(String(r.closing_credit)) > 0 ? (
                              <KzAmount value={parseFloat(String(r.closing_credit))} />
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 font-mono font-black text-xs text-slate-900 dark:text-white">
                    <td colSpan={2} className="p-3 font-sans uppercase">
                      Totais de Verificação (Balancete)
                    </td>
                    {trialBalanceColumns === 6 && (
                      <>
                        <td className="p-3 text-right">
                          <KzAmount
                            value={parseFloat(String(trialBalance?.total_opening_debit || 0))}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <KzAmount
                            value={parseFloat(String(trialBalance?.total_opening_credit || 0))}
                          />
                        </td>
                      </>
                    )}
                    <td className="p-3 text-right text-blue-600 dark:text-blue-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_period_debit || 0))}
                      />
                    </td>
                    <td className="p-3 text-right text-indigo-600 dark:text-indigo-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_period_credit || 0))}
                      />
                    </td>
                    <td className="p-3 text-right text-emerald-700 dark:text-emerald-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_closing_debit || 0))}
                      />
                    </td>
                    <td className="p-3 text-right text-amber-700 dark:text-amber-400">
                      <KzAmount
                        value={parseFloat(String(trialBalance?.total_closing_credit || 0))}
                      />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 2: LIVRO DIÁRIO DE LANÇAMENTOS */}
      {activeTab === 'entries' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por histórico, documento..."
                  value={entriesSearch}
                  onChange={(e) => setEntriesSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={entriesJournalFilter}
                onChange={(e) => setEntriesJournalFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os Diários</option>
                {journals.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} - {j.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              Mostrando <span className="font-bold">{filteredEntries.length}</span> lançamentos
            </div>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="p-3 w-16">Nº</th>
                    <th className="p-3 w-28">Data</th>
                    <th className="p-3 w-20">Período</th>
                    <th className="p-3">Descrição / Histórico</th>
                    <th className="p-3 w-32">Origem</th>
                    <th className="p-3 text-right">Total Débito</th>
                    <th className="p-3 text-right">Total Crédito</th>
                    <th className="p-3 text-center w-28">Estado</th>
                    <th className="p-3 text-center w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoadingEntries ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        A carregar lançamentos contabilísticos...
                      </td>
                    </tr>
                  ) : filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Nenhum lançamento contabilístico registado.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e) => (
                      <tr
                        key={e.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition cursor-pointer"
                        onClick={() => setSelectedEntry(e)}
                      >
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          #{e.entry_number}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {e.transaction_date}
                        </td>
                        <td className="p-3 font-semibold text-slate-500">Mês {e.period}</td>
                        <td className="p-3 font-medium text-slate-900 dark:text-white">
                          <div>{e.description}</div>
                          {e.source_document_ref && (
                            <span className="text-[11px] text-slate-500 block">
                              Ref: {e.source_document_ref}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {e.source_service || 'MANUAL'}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          <KzAmount value={parseFloat(String(e.total_debit))} />
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          <KzAmount value={parseFloat(String(e.total_credit))} />
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              e.status === 'POSTED'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : e.status === 'REVERSED'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="p-3 text-center" onClick={(ev) => ev.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(e)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600"
                            title="Ver Partidas Dobradas"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 3: PLANO GERAL DE CONTAS (PGC) */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar conta por código ou nome..."
                  value={chartSearch}
                  onChange={(e) => setChartSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={chartClassFilter}
                onChange={(e) => setChartClassFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PGC_CLASSES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.prefix ? `(${c.prefix})` : ''}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyAnalytical}
                  onChange={(e) => setOnlyAnalytical(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Apenas Contas Analíticas (Lançáveis)
              </label>
            </div>

            <button
              onClick={() => setIsCreateAccountModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              Nova Conta Analítica
            </button>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="p-3 w-32">Código</th>
                    <th className="p-3">Designação da Conta</th>
                    <th className="p-3 w-36">Natureza</th>
                    <th className="p-3 w-36">Tipo</th>
                    <th className="p-3 w-32">SAF-T Grupo</th>
                    <th className="p-3 w-32 text-center">Reservada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoadingChart ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        A carregar Plano Geral de Contabilidade...
                      </td>
                    </tr>
                  ) : filteredChartAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Nenhuma conta encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredChartAccounts.map((a) => (
                      <tr
                        key={a.id}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                          !a.is_analytical ? 'bg-slate-50/30 dark:bg-slate-800/10 font-bold' : ''
                        }`}
                      >
                        <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                          {a.account_code}
                        </td>
                        <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                          {a.account_name}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.account_nature === 'DEBIT'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                            }`}
                          >
                            {a.account_nature === 'DEBIT' ? 'DEVEDORA' : 'CREDORA'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.is_analytical
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {a.is_analytical ? 'Analítica (Movimentável)' : 'Sintética (Mãe)'}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {a.saft_grouping_code || '-'}
                        </td>
                        <td className="p-3 text-center">
                          {a.is_system_reserved ? (
                            <span className="text-[10px] text-amber-600 font-bold">Oficial PGC</span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Personalizada</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 4: DIÁRIOS & EXERCÍCIOS FISCAIS */}
      {activeTab === 'journals_years' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Diários Card */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Diários Contabilísticos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Subdivisões do Livro Diário com numeração sequencial independente
                </p>
              </div>
              <button
                onClick={() => setIsCreateJournalModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Novo Diário
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {journals.map((j) => (
                <div key={j.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-mono font-black text-sm flex items-center justify-center">
                      {j.code}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {j.name}
                      </h4>
                      <span className="text-xs text-slate-500">Tipo: {j.journal_type}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {j.is_active ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Exercícios Fiscais Card */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Exercícios Fiscais
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Anos fiscais de tributação e prestação de contas à AGT
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {fiscalYears.map((fy) => (
                <div key={fy.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-mono font-black text-sm flex items-center justify-center">
                      {fy.year_code}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Exercício Fiscal {fy.year_code}
                      </h4>
                      <span className="text-xs text-slate-500">
                        {fy.start_date} a {fy.end_date}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      fy.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {fy.status === 'OPEN' ? 'ABERTO' : 'ENCERRADO'}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 5: REAVALIAÇÃO CAMBIAL */}
      {activeTab === 'revaluation' && (
        <div className="space-y-4">
          <GlassCard className="p-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reavaliação Cambial Automática (Decreto AGT)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Atualização de saldos de contas em divisas (USD / EUR) face ao Kwanza com registo automático nas contas 75.3 (Ganhos) ou 66.3 (Perdas)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Conta a Reavaliar
                  </label>
                  <select
                    value={revalForm.target_account_code}
                    onChange={(e) =>
                      setRevalForm({ ...revalForm, target_account_code: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  >
                    <option value="12.2">12.2 - Bancos D.O. Moeda Estrangeira</option>
                    <option value="11.1">11.1 - Caixa Moeda Estrangeira</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Moeda
                  </label>
                  <select
                    value={revalForm.currency}
                    onChange={(e) =>
                      setRevalForm({ ...revalForm, currency: e.target.value as 'USD' | 'EUR' })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  >
                    <option value="USD">USD - Dólar Americano</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Saldo em Moeda Externa
                  </label>
                  <input
                    type="number"
                    value={revalForm.foreign_balance}
                    onChange={(e) =>
                      setRevalForm({ ...revalForm, foreign_balance: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nova Taxa Câmbio (Kz)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={revalForm.new_exchange_rate}
                    onChange={(e) =>
                      setRevalForm({
                        ...revalForm,
                        new_exchange_rate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Valor Contábil Atual (Kz)
                  </label>
                  <input
                    type="number"
                    value={revalForm.previous_book_value_kz}
                    onChange={(e) =>
                      setRevalForm({
                        ...revalForm,
                        previous_book_value_kz: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Live Preview */}
              {(() => {
                const newTotalKz = revalForm.foreign_balance * revalForm.new_exchange_rate;
                const diff = newTotalKz - revalForm.previous_book_value_kz;
                const isGain = diff >= 0;
                return (
                  <div
                    className={`p-4 rounded-xl border ${
                      isGain
                        ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Novo Saldo Reavaliado:
                      </span>
                      <span className="text-sm font-mono font-bold">
                        <KzAmount value={newTotalKz} />
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Diferença de Câmbio:
                      </span>
                      <span
                        className={`text-sm font-mono font-bold ${
                          isGain ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {isGain ? '+' : ''}
                        <KzAmount value={diff} /> ({isGain ? 'Ganho Cambial - 75.3' : 'Perda Cambial - 66.3'})
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="button"
                onClick={() => revaluationMutation.mutate(revalForm)}
                disabled={revaluationMutation.isPending}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition shadow-md"
              >
                {revaluationMutation.isPending
                  ? 'A processar reavaliação...'
                  : 'Executar Reavaliação e Gerar Lançamento'}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL: NOVO LANÇAMENTO MANUAL (PARTIDAS DOBRADAS) */}
      {isPostEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Novo Lançamento Manual (Partidas Dobradas)
                </h3>
                <p className="text-xs text-slate-500">
                  Registo em estrito cumprimento com o princípio das partidas dobradas (Débito = Crédito)
                </p>
              </div>
              <button
                onClick={() => setIsPostEntryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Diário
                </label>
                <select
                  value={manualEntryForm.journal_code}
                  onChange={(e) =>
                    setManualEntryForm({ ...manualEntryForm, journal_code: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  {journals.map((j) => (
                    <option key={j.id} value={j.code}>
                      {j.code} - {j.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Data Transação
                </label>
                <input
                  type="date"
                  value={manualEntryForm.transaction_date}
                  onChange={(e) =>
                    setManualEntryForm({ ...manualEntryForm, transaction_date: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Período (Mês)
                </label>
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={manualEntryForm.period}
                  onChange={(e) =>
                    setManualEntryForm({
                      ...manualEntryForm,
                      period: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Exercício
                </label>
                <input
                  type="number"
                  value={manualEntryForm.fiscal_year}
                  onChange={(e) =>
                    setManualEntryForm({
                      ...manualEntryForm,
                      fiscal_year: parseInt(e.target.value) || 2026,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Descrição Geral / Histórico da Operação
              </label>
              <input
                type="text"
                placeholder="Ex.: Pagamento de serviços de consultoria técnica conforme fatura FT..."
                value={manualEntryForm.description}
                onChange={(e) =>
                  setManualEntryForm({ ...manualEntryForm, description: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              />
            </div>

            {/* Lines Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Linhas do Lançamento
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setManualEntryForm({
                      ...manualEntryForm,
                      lines: [
                        ...manualEntryForm.lines,
                        { account_code: '', description: '', debit_amount: '', credit_amount: '' },
                      ],
                    })
                  }
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Adicionar Linha
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5 w-72">Conta Analítica PGC</th>
                      <th className="p-2.5">Histórico da Linha</th>
                      <th className="p-2.5 w-36 text-right">Débito (Kz)</th>
                      <th className="p-2.5 w-36 text-right">Crédito (Kz)</th>
                      <th className="p-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {manualEntryForm.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={l.account_code}
                            onChange={(e) => {
                              const newLines = [...manualEntryForm.lines];
                              newLines[idx].account_code = e.target.value;
                              setManualEntryForm({ ...manualEntryForm, lines: newLines });
                            }}
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                          >
                            <option value="">Selecione a conta analítica...</option>
                            {analyticalAccounts.map((acc) => (
                              <option key={acc.id} value={acc.account_code}>
                                {acc.account_code} - {acc.account_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder="Histórico opcional..."
                            value={l.description}
                            onChange={(e) => {
                              const newLines = [...manualEntryForm.lines];
                              newLines[idx].description = e.target.value;
                              setManualEntryForm({ ...manualEntryForm, lines: newLines });
                            }}
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={l.debit_amount}
                            onChange={(e) => {
                              const newLines = [...manualEntryForm.lines];
                              newLines[idx].debit_amount = e.target.value;
                              if (e.target.value) newLines[idx].credit_amount = '';
                              setManualEntryForm({ ...manualEntryForm, lines: newLines });
                            }}
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-right"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={l.credit_amount}
                            onChange={(e) => {
                              const newLines = [...manualEntryForm.lines];
                              newLines[idx].credit_amount = e.target.value;
                              if (e.target.value) newLines[idx].debit_amount = '';
                              setManualEntryForm({ ...manualEntryForm, lines: newLines });
                            }}
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-right"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {manualEntryForm.lines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newLines = manualEntryForm.lines.filter((_, i) => i !== idx);
                                setManualEntryForm({ ...manualEntryForm, lines: newLines });
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 dark:bg-slate-900 font-mono font-bold text-xs">
                      <td colSpan={2} className="p-2.5 text-right font-sans">
                        Totais:
                      </td>
                      <td className="p-2.5 text-right text-blue-600">
                        <KzAmount value={calculatedEntryTotals.deb} />
                      </td>
                      <td className="p-2.5 text-right text-indigo-600">
                        <KzAmount value={calculatedEntryTotals.cred} />
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Balancing validation alert */}
            <div
              className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
                calculatedEntryTotals.isBalanced
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {calculatedEntryTotals.isBalanced ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>
                  {calculatedEntryTotals.isBalanced
                    ? 'Partidas dobradas perfeitamente equilibradas!'
                    : `Lançamento Desequilibrado: Diferença de ${calculatedEntryTotals.diff.toFixed(
                        2
                      )} Kz entre Débitos e Créditos`}
                </span>
              </div>
              <span className="font-mono">
                Δ = {calculatedEntryTotals.diff.toFixed(2)} Kz
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPostEntryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !calculatedEntryTotals.isBalanced ||
                  !manualEntryForm.description.trim() ||
                  postEntryMutation.isPending
                }
                onClick={() => {
                  const payload: PostManualEntryPayload = {
                    fiscal_year: manualEntryForm.fiscal_year,
                    journal_code: manualEntryForm.journal_code,
                    transaction_date: manualEntryForm.transaction_date,
                    period: manualEntryForm.period,
                    description: manualEntryForm.description,
                    lines: manualEntryForm.lines
                      .filter((l) => l.account_code)
                      .map((l) => ({
                        account_code: l.account_code,
                        description: l.description || manualEntryForm.description,
                        debit_amount: l.debit_amount ? parseFloat(l.debit_amount) : 0,
                        credit_amount: l.credit_amount ? parseFloat(l.credit_amount) : 0,
                      })),
                  };
                  postEntryMutation.mutate(payload);
                }}
                className={`px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md transition ${
                  calculatedEntryTotals.isBalanced && manualEntryForm.description.trim()
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                {postEntryMutation.isPending ? 'A gravar...' : 'Gravar Lançamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA CONTA ANALÍTICA */}
      {isCreateAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nova Conta Analítica (PGC)
              </h3>
              <button
                onClick={() => setIsCreateAccountModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Código da Conta (Ex.: 12.1.2)
                </label>
                <input
                  type="text"
                  placeholder="12.1.2"
                  value={newAccountForm.account_code}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, account_code: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Conta Mãe (Sintética)
                </label>
                <input
                  type="text"
                  placeholder="12.1"
                  value={newAccountForm.parent_account_code || ''}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, parent_account_code: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Designação da Conta
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Banco BAI - Moeda Nacional AOA"
                  value={newAccountForm.account_name}
                  onChange={(e) =>
                    setNewAccountForm({ ...newAccountForm, account_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Natureza Contabilística
                </label>
                <select
                  value={newAccountForm.account_nature}
                  onChange={(e) =>
                    setNewAccountForm({
                      ...newAccountForm,
                      account_nature: e.target.value as 'DEBIT' | 'CREDIT',
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="DEBIT">Devedora (Ativos, Custos)</option>
                  <option value="CREDIT">Credora (Passivos, Capitais, Proveitos)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateAccountModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newAccountForm.account_code || !newAccountForm.account_name}
                onClick={() => createAccountMutation.mutate(newAccountForm)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
              >
                Criar Conta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO DIÁRIO */}
      {isCreateJournalModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Novo Diário Contabilístico
              </h3>
              <button
                onClick={() => setIsCreateJournalModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Código do Diário (2 a 4 caracteres)
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="Ex.: DIV"
                  value={newJournalForm.code}
                  onChange={(e) =>
                    setNewJournalForm({ ...newJournalForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome do Diário
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Diário de Operações Diversas"
                  value={newJournalForm.name}
                  onChange={(e) => setNewJournalForm({ ...newJournalForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Tipo de Diário
                </label>
                <select
                  value={newJournalForm.journal_type}
                  onChange={(e) =>
                    setNewJournalForm({
                      ...newJournalForm,
                      journal_type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="OPERATIONS">Operações Diversas (OPERATIONS)</option>
                  <option value="SALES">Vendas (SALES)</option>
                  <option value="PURCHASES">Compras (PURCHASES)</option>
                  <option value="CASH">Caixa (CASH)</option>
                  <option value="BANK">Bancos (BANK)</option>
                  <option value="CLOSING">Fecho de Exercício (CLOSING)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateJournalModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newJournalForm.code || !newJournalForm.name}
                onClick={() => createJournalMutation.mutate(newJournalForm)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
              >
                Gravar Diário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DE LANÇAMENTO E PARTIDAS DOBRADAS */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Lançamento Contabilístico #{selectedEntry.entry_number}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedEntry.status === 'POSTED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedEntry.status}
                  </span>
                </h3>
                <span className="text-xs text-slate-500">
                  Data: {selectedEntry.transaction_date} | Período: Mês {selectedEntry.period}
                </span>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold block mb-0.5 text-slate-900 dark:text-white">
                Histórico / Descrição:
              </span>
              {selectedEntry.description}
              {selectedEntry.source_document_ref && (
                <div className="mt-1 text-slate-500">
                  Documento de Origem: {selectedEntry.source_document_ref} (Serviço:{' '}
                  {selectedEntry.source_service})
                </div>
              )}
            </div>

            {/* Lines */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300 font-sans">
                  <tr>
                    <th className="p-2.5">Linha</th>
                    <th className="p-2.5">Conta PGC</th>
                    <th className="p-2.5">Descrição</th>
                    <th className="p-2.5 text-right">Débito (Kz)</th>
                    <th className="p-2.5 text-right">Crédito (Kz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedEntry.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2.5 text-slate-500 font-sans">#{l.line_number}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {l.account_code}
                      </td>
                      <td className="p-2.5 font-sans text-slate-700 dark:text-slate-300">
                        {l.description || '-'}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                        {parseFloat(String(l.debit_amount)) > 0 ? (
                          <KzAmount value={parseFloat(String(l.debit_amount))} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-2.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                        {parseFloat(String(l.credit_amount)) > 0 ? (
                          <KzAmount value={parseFloat(String(l.credit_amount))} />
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-900 font-bold">
                    <td colSpan={3} className="p-2.5 font-sans text-right">
                      Totais Partidas Dobradas:
                    </td>
                    <td className="p-2.5 text-right text-blue-600">
                      <KzAmount value={parseFloat(String(selectedEntry.total_debit))} />
                    </td>
                    <td className="p-2.5 text-right text-indigo-600">
                      <KzAmount value={parseFloat(String(selectedEntry.total_credit))} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
              {selectedEntry.status === 'POSTED' ? (
                <button
                  type="button"
                  onClick={() => setIsReverseModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Estornar Lançamento (Reverse)
                </button>
              ) : (
                <span className="text-xs text-red-600 font-semibold">
                  Este lançamento já foi estornado.
                </span>
              )}

              <button
                type="button"
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESTORNO DE LANÇAMENTO */}
      {isReverseModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirmar Estorno do Lançamento #{selectedEntry.entry_number}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              O estorno cria um novo registo contabilístico com o sentido inverso dos débitos e créditos, garantindo trilha de auditoria estrita.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Motivo / Justificação do Estorno (Obrigatório)
              </label>
              <textarea
                rows={3}
                placeholder="Ex.: Lançamento incorreto de fatura duplicada..."
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReverseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reverseReason.trim() || reverseEntryMutation.isPending}
                onClick={() =>
                  reverseEntryMutation.mutate({
                    entry_id: selectedEntry.id,
                    reversal_date: new Date().toISOString().split('T')[0],
                    period: selectedEntry.period,
                    reason: reverseReason,
                  })
                }
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition"
              >
                {reverseEntryMutation.isPending ? 'A estornar...' : 'Confirmar Estorno'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
