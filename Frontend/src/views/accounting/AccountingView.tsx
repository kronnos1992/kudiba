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
  Pencil,
  Printer,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Lock,
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
  UpdateEntryPayload,
} from '../../api/accounting';

type AccountingTab =
  | 'trial_balance'
  | 'entries'
  | 'ledger'
  | 'financial_statements'
  | 'vat_settlement'
  | 'chart'
  | 'journals_years'
  | 'revaluation';

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

  // Livro Razão filters
  const [selectedLedgerAccountCode, setSelectedLedgerAccountCode] = useState<string>('11.2');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Demonstrações Financeiras filters
  const [financialSubTab, setFinancialSubTab] = useState<'balance_sheet' | 'income_statement'>('balance_sheet');

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
  const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
  const [isNewFiscalYearModalOpen, setIsNewFiscalYearModalOpen] = useState(false);
  const [newFiscalYearCode, setNewFiscalYearCode] = useState<number>(new Date().getFullYear() + 1);
  const [isCloseFiscalYearModalOpen, setIsCloseFiscalYearModalOpen] = useState(false);
  const [yearToClose, setYearToClose] = useState<number | null>(null);

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
        limit: 250,
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

  const openFiscalYearMutation = useMutation({
    mutationFn: (year: number) => accountingApi.openFiscalYear({ year_code: year }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_fiscal_years'] });
      setIsNewFiscalYearModalOpen(false);
    },
  });

  const closeFiscalYearMutation = useMutation({
    mutationFn: (year: number) => accountingApi.closeFiscalYear(year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_fiscal_years'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_trial_balance'] });
      setIsCloseFiscalYearModalOpen(false);
      setYearToClose(null);
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

  // Edição de Lançamento Form State
  const [editEntryForm, setEditEntryForm] = useState<{
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
    transaction_date: new Date().toISOString().split('T')[0],
    period: new Date().getMonth() + 1,
    description: '',
    lines: [
      { account_code: '', description: '', debit_amount: '', credit_amount: '' },
      { account_code: '', description: '', debit_amount: '', credit_amount: '' },
    ],
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateEntryPayload }) =>
      accountingApi.updateEntry(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['accounting_entries'] });
      queryClient.invalidateQueries({ queryKey: ['accounting_trial_balance'] });
      setIsEditEntryModalOpen(false);
      setSelectedEntry(updated);
    },
  });

  const openEntryEdit = (entry: JournalEntryResponse) => {
    setEditEntryForm({
      transaction_date: entry.transaction_date,
      period: entry.period,
      description: entry.description,
      lines: entry.lines.map((l) => ({
        account_code: l.account_code,
        description: l.description || '',
        debit_amount:
          parseFloat(String(l.debit_amount)) > 0 ? String(l.debit_amount) : '',
        credit_amount:
          parseFloat(String(l.credit_amount)) > 0 ? String(l.credit_amount) : '',
      })),
    });
    setSelectedEntry(entry);
    setIsEditEntryModalOpen(true);
  };

  const calculatedEditTotals = useMemo(() => {
    let deb = 0;
    let cred = 0;
    editEntryForm.lines.forEach((l) => {
      const d = parseFloat(l.debit_amount) || 0;
      const c = parseFloat(l.credit_amount) || 0;
      deb += d;
      cred += c;
    });
    const diff = Math.abs(deb - cred);
    const isBalanced = deb > 0 && diff < 0.0001;
    return { deb, cred, diff, isBalanced };
  }, [editEntryForm.lines]);

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

  // Helper de download CSV UTF-8 com BOM
  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

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

  // Imprimir
  const handlePrint = () => {
    window.print();
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

  // Navegar para o Livro Razão com uma conta específica
  const openAccountLedger = (accountCode: string) => {
    setSelectedLedgerAccountCode(accountCode);
    setActiveTab('ledger');
  };

  // Exportação CSV do Balancete
  const handleExportTrialBalanceCsv = () => {
    if (!trialBalance?.rows) return;
    const is6Col = trialBalanceColumns === 6;
    const header = is6Col
      ? 'Código;Designação da Conta;Tipo;S. Inicial Débito (Kz);S. Inicial Crédito (Kz);Mov. Débito (Kz);Mov. Crédito (Kz);Saldo Final Devedor (Kz);Saldo Final Credor (Kz)'
      : 'Código;Designação da Conta;Tipo;Mov. Débito (Kz);Mov. Crédito (Kz);Saldo Final Devedor (Kz);Saldo Final Credor (Kz)';

    const lines = filteredTrialBalanceRows.map((r) => {
      const isAnalytical = r.is_analytical ? 'Analítica' : 'Sintética';
      const cleanName = `"${r.account_name.replace(/"/g, '""')}"`;
      if (is6Col) {
        return `${r.account_code};${cleanName};${isAnalytical};${r.opening_debit};${r.opening_credit};${r.period_debit};${r.period_credit};${r.closing_debit};${r.closing_credit}`;
      }
      return `${r.account_code};${cleanName};${isAnalytical};${r.period_debit};${r.period_credit};${r.closing_debit};${r.closing_credit}`;
    });

    const totalLine = is6Col
      ? `TOTAIS;Totais Gerais do Balancete;;${trialBalance.total_opening_debit};${trialBalance.total_opening_credit};${trialBalance.total_period_debit};${trialBalance.total_period_credit};${trialBalance.total_closing_debit};${trialBalance.total_closing_credit}`
      : `TOTAIS;Totais Gerais do Balancete;;${trialBalance.total_period_debit};${trialBalance.total_period_credit};${trialBalance.total_closing_debit};${trialBalance.total_closing_credit}`;

    const csv = [header, ...lines, totalLine].join('\r\n');
    downloadCsv(`balancete_verificacao_${activeYear?.year_code || new Date().getFullYear()}.csv`, csv);
  };

  // Exportação CSV do Diário
  const handleExportEntriesCsv = () => {
    const header = 'Nº Lançamento;Data;Período;Origem;Documento Ref;Histórico;Total Débito (Kz);Total Crédito (Kz);Estado';
    const lines = filteredEntries.map((e) => {
      const cleanDesc = `"${e.description.replace(/"/g, '""')}"`;
      return `${e.entry_number};${e.transaction_date};${e.period};${e.source_service || 'MANUAL'};${e.source_document_ref || '-'};${cleanDesc};${e.total_debit};${e.total_credit};${e.status}`;
    });
    const csv = [header, ...lines].join('\r\n');
    downloadCsv(`livro_diario_${activeYear?.year_code || new Date().getFullYear()}.csv`, csv);
  };

  // Conta selecionada no Razão
  const selectedLedgerAccount = useMemo(() => {
    const foundInChart = chart.find((a) => a.account_code === selectedLedgerAccountCode);
    const foundInTB = trialBalance?.rows.find((r) => r.account_code === selectedLedgerAccountCode);
    return {
      code: selectedLedgerAccountCode,
      name: foundInChart?.account_name || foundInTB?.account_name || `Conta ${selectedLedgerAccountCode}`,
      nature: foundInChart?.account_nature || 'DEBIT',
      is_analytical: foundInChart ? foundInChart.is_analytical : true,
      opening_debit: parseFloat(String(foundInTB?.opening_debit || 0)),
      opening_credit: parseFloat(String(foundInTB?.opening_credit || 0)),
      period_debit: parseFloat(String(foundInTB?.period_debit || 0)),
      period_credit: parseFloat(String(foundInTB?.period_credit || 0)),
      closing_debit: parseFloat(String(foundInTB?.closing_debit || 0)),
      closing_credit: parseFloat(String(foundInTB?.closing_credit || 0)),
    };
  }, [chart, trialBalance, selectedLedgerAccountCode]);

  // Linhas cronológicas do Razão da conta selecionada
  const ledgerEntries = useMemo(() => {
    if (!selectedLedgerAccountCode) return [];
    const isDebitNature = selectedLedgerAccount.nature === 'DEBIT';

    let initialBalance = isDebitNature
      ? selectedLedgerAccount.opening_debit - selectedLedgerAccount.opening_credit
      : selectedLedgerAccount.opening_credit - selectedLedgerAccount.opening_debit;

    const sorted = [...entries].sort((a, b) => {
      const c = a.transaction_date.localeCompare(b.transaction_date);
      if (c !== 0) return c;
      return a.entry_number - b.entry_number;
    });

    let currentBalance = initialBalance;
    const lines: Array<{
      id: string;
      entryId: string;
      entry_number: number;
      date: string;
      period: number;
      journal: string;
      description: string;
      debit: number;
      credit: number;
      runningBalance: number;
      rawEntry: JournalEntryResponse;
    }> = [];

    for (const ent of sorted) {
      for (const line of ent.lines) {
        if (
          line.account_code === selectedLedgerAccountCode ||
          line.account_code.startsWith(selectedLedgerAccountCode + '.')
        ) {
          const deb = parseFloat(String(line.debit_amount || 0));
          const cred = parseFloat(String(line.credit_amount || 0));

          if (isDebitNature) {
            currentBalance += deb - cred;
          } else {
            currentBalance += cred - deb;
          }

          lines.push({
            id: line.id,
            entryId: ent.id,
            entry_number: ent.entry_number,
            date: ent.transaction_date,
            period: ent.period,
            journal: ent.source_service || 'MANUAL',
            description: line.description || ent.description,
            debit: deb,
            credit: cred,
            runningBalance: currentBalance,
            rawEntry: ent,
          });
        }
      }
    }

    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      return lines.filter(
        (l) =>
          l.description.toLowerCase().includes(q) ||
          String(l.entry_number).includes(q) ||
          l.journal.toLowerCase().includes(q)
      );
    }

    return lines;
  }, [entries, selectedLedgerAccountCode, selectedLedgerAccount, ledgerSearch]);

  // Exportação CSV do Razão
  const handleExportLedgerCsv = () => {
    const header = `Extrato de Conta PGC: ${selectedLedgerAccount.code} - ${selectedLedgerAccount.name}\r\nData;Nº Lançamento;Diário;Histórico;Débito (Kz);Crédito (Kz);Saldo Acumulado (Kz);Sentido`;
    const lines = ledgerEntries.map((r) => {
      const cleanDesc = `"${r.description.replace(/"/g, '""')}"`;
      const sentido = r.runningBalance >= 0 ? 'Devedor' : 'Credor';
      return `${r.date};#${r.entry_number};${r.journal};${cleanDesc};${r.debit};${r.credit};${Math.abs(r.runningBalance)};${sentido}`;
    });
    const csv = [header, ...lines].join('\r\n');
    downloadCsv(`extrato_conta_${selectedLedgerAccount.code}.csv`, csv);
  };

  // Demonstrações Financeiras PGC (Balanço & DRE)
  const financialStatements = useMemo(() => {
    const rows = trialBalance?.rows || [];

    const sumNet = (prefix: string, defaultNature: 'DEBIT' | 'CREDIT') => {
      let total = 0;
      rows.forEach((r) => {
        if (r.account_code === prefix || r.account_code.startsWith(prefix + '.')) {
          if (r.is_analytical) {
            const deb = parseFloat(String(r.closing_debit || 0));
            const cred = parseFloat(String(r.closing_credit || 0));
            if (defaultNature === 'DEBIT') {
              total += deb - cred;
            } else {
              total += cred - deb;
            }
          }
        }
      });
      return total;
    };

    const sumPeriod = (prefix: string, nature: 'DEBIT' | 'CREDIT') => {
      let total = 0;
      rows.forEach((r) => {
        if (r.account_code === prefix || r.account_code.startsWith(prefix + '.')) {
          if (r.is_analytical) {
            const deb = parseFloat(String(r.period_debit || 0));
            const cred = parseFloat(String(r.period_credit || 0));
            if (nature === 'DEBIT') {
              total += deb - cred;
            } else {
              total += cred - deb;
            }
          }
        }
      });
      return Math.max(0, total);
    };

    // --- DRE (Demonstração de Resultados por Natureza) ---
    const vendas = sumPeriod('71', 'CREDIT');
    const servicos = sumPeriod('72', 'CREDIT');
    const outrosProveitos = sumPeriod('73', 'CREDIT') + sumPeriod('74', 'CREDIT');
    const totalProveitosOperacionais = vendas + servicos + outrosProveitos;

    const cmvmc = sumPeriod('61', 'DEBIT');
    const margemBruta = totalProveitosOperacionais - cmvmc;

    const fse = sumPeriod('62', 'DEBIT');
    const pessoal = sumPeriod('63', 'DEBIT');
    const amortizacoes = sumPeriod('64', 'DEBIT');
    const outrosCustosOperacionais = sumPeriod('65', 'DEBIT');
    const totalCustosOperacionais = cmvmc + fse + pessoal + amortizacoes + outrosCustosOperacionais;

    const resultadoOperacional = totalProveitosOperacionais - totalCustosOperacionais;

    const proveitosFinanceiros = sumPeriod('75', 'CREDIT');
    const custosFinanceiros = sumPeriod('66', 'DEBIT');
    const resultadoFinanceiro = proveitosFinanceiros - custosFinanceiros;

    const rai = resultadoOperacional + resultadoFinanceiro;
    const impostoEstimado = sumPeriod('87', 'DEBIT') > 0 ? sumPeriod('87', 'DEBIT') : Math.max(0, rai * 0.25);
    const resultadoLiquido = rai - impostoEstimado;

    // --- Balanço Patrimonial PGC ---
    const imobCorporeas = sumNet('41', 'DEBIT');
    const imobIncorporeas = sumNet('42', 'DEBIT');
    const amortAcumuladas = Math.abs(sumNet('43', 'CREDIT'));
    const totalAtivoNaoCorrente = Math.max(0, imobCorporeas + imobIncorporeas - amortAcumuladas);

    const existencias = Math.max(0, sumNet('2', 'DEBIT'));
    const clientes = Math.max(0, sumNet('31', 'DEBIT'));
    const estadoDevedor = Math.max(
      0,
      sumNet('34.2.1', 'DEBIT') + sumNet('34.5.1', 'DEBIT') + sumNet('34.5.2', 'DEBIT')
    );
    const outrosDevedores = Math.max(0, sumNet('37', 'DEBIT'));
    const meiosFinanceiros = Math.max(
      0,
      sumNet('11', 'DEBIT') + sumNet('12', 'DEBIT') + sumNet('13', 'DEBIT') + sumNet('14', 'DEBIT')
    );
    const totalAtivoCorrente = existencias + clientes + estadoDevedor + outrosDevedores + meiosFinanceiros;
    const totalAtivo = totalAtivoNaoCorrente + totalAtivoCorrente;

    const capitalSocial = Math.max(0, sumNet('51', 'CREDIT'));
    const reservas = Math.max(0, sumNet('55', 'CREDIT'));
    const resultadosTransitados = sumNet('56', 'CREDIT');
    const resultadoPeriodo = resultadoLiquido;
    const totalCapitalProprio = capitalSocial + reservas + resultadosTransitados + resultadoPeriodo;

    const fornecedores = Math.max(0, sumNet('32', 'CREDIT'));
    const estadoCredor = Math.max(
      0,
      sumNet('34.1', 'CREDIT') +
        sumNet('34.2.2', 'CREDIT') +
        sumNet('34.3', 'CREDIT') +
        sumNet('34.5.3', 'CREDIT') +
        sumNet('34.5.7', 'CREDIT') +
        sumNet('34.6', 'CREDIT')
    );
    const remuneracoesPagar = Math.max(0, sumNet('36', 'CREDIT'));
    const outrosCredores = Math.max(0, sumNet('37', 'CREDIT'));
    const totalPassivo = fornecedores + estadoCredor + remuneracoesPagar + outrosCredores;

    const totalPassivoCapitalProprio = totalCapitalProprio + totalPassivo;
    const balancoDiff = Math.abs(totalAtivo - totalPassivoCapitalProprio);

    return {
      dre: {
        vendas,
        servicos,
        outrosProveitos,
        totalProveitosOperacionais,
        cmvmc,
        margemBruta,
        fse,
        pessoal,
        amortizacoes,
        outrosCustosOperacionais,
        totalCustosOperacionais,
        resultadoOperacional,
        proveitosFinanceiros,
        custosFinanceiros,
        resultadoFinanceiro,
        rai,
        impostoEstimado,
        resultadoLiquido,
      },
      balanco: {
        imobCorporeas,
        imobIncorporeas,
        amortAcumuladas,
        totalAtivoNaoCorrente,
        existencias,
        clientes,
        estadoDevedor,
        outrosDevedores,
        meiosFinanceiros,
        totalAtivoCorrente,
        totalAtivo,
        capitalSocial,
        reservas,
        resultadosTransitados,
        resultadoPeriodo,
        totalCapitalProprio,
        fornecedores,
        estadoCredor,
        remuneracoesPagar,
        outrosCredores,
        totalPassivo,
        totalPassivoCapitalProprio,
        balancoDiff,
        isBalanced: balancoDiff < 1.0,
      },
    };
  }, [trialBalance]);

  // Apuramento Periódico de IVA (Modelo 7 AGT)
  const vatSettlement = useMemo(() => {
    const rows = trialBalance?.rows || [];
    const getCred = (code: string) => {
      const r = rows.find((x) => x.account_code === code);
      return parseFloat(String(r?.period_credit || 0));
    };
    const getDeb = (code: string) => {
      const r = rows.find((x) => x.account_code === code);
      return parseFloat(String(r?.period_debit || 0));
    };

    const ivaLiquidado14 = getCred('34.5.3.1');
    const ivaLiquidado5 = getCred('34.5.3.2');
    const totalIvaLiquidado = ivaLiquidado14 + ivaLiquidado5;

    const ivaSuportado = getDeb('34.5.1');
    const ivaDedutivel = getDeb('34.5.2');
    const totalIvaDedutivel = ivaSuportado + ivaDedutivel;

    const ivaRegularizarDeb = getDeb('34.5.5');
    const ivaRegularizarCred = getCred('34.5.5');
    const ivaRegularizarNet = ivaRegularizarDeb - ivaRegularizarCred;

    const saldoIva = totalIvaLiquidado - totalIvaDedutivel + ivaRegularizarNet;
    const isPayable = saldoIva >= 0;

    return {
      ivaLiquidado14,
      ivaLiquidado5,
      totalIvaLiquidado,
      ivaSuportado,
      ivaDedutivel,
      totalIvaDedutivel,
      ivaRegularizarNet,
      saldoIva: Math.abs(saldoIva),
      isPayable,
    };
  }, [trialBalance]);

  // Abertura do lançamento pré-configurado de Apuramento de IVA
  const handleOpenVatSettlementEntry = () => {
    const lines: Array<{
      account_code: string;
      description: string;
      debit_amount: string;
      credit_amount: string;
    }> = [];

    if (vatSettlement.totalIvaLiquidado > 0) {
      lines.push({
        account_code: vatSettlement.ivaLiquidado14 > 0 ? '34.5.3.1' : '34.5.3',
        description: 'Zeração IVA Liquidado no Período para Apuramento',
        debit_amount: vatSettlement.totalIvaLiquidado.toFixed(2),
        credit_amount: '',
      });
    }

    if (vatSettlement.totalIvaDedutivel > 0) {
      lines.push({
        account_code: '34.5.2',
        description: 'Zeração IVA Dedutível no Período para Apuramento',
        debit_amount: '',
        credit_amount: vatSettlement.totalIvaDedutivel.toFixed(2),
      });
    }

    if (vatSettlement.isPayable) {
      lines.push({
        account_code: '34.5.7',
        description: 'Registo de IVA a Pagar à AGT (Modelo 7)',
        debit_amount: '',
        credit_amount: vatSettlement.saldoIva.toFixed(2),
      });
    } else {
      lines.push({
        account_code: '34.5.8',
        description: 'Registo de Crédito de IVA a Recuperar (Modelo 7)',
        debit_amount: vatSettlement.saldoIva.toFixed(2),
        credit_amount: '',
      });
    }

    setManualEntryForm({
      fiscal_year: activeYear?.year_code || new Date().getFullYear(),
      journal_code: 'OD',
      transaction_date: new Date().toISOString().split('T')[0],
      period: new Date().getMonth() + 1,
      description: `Apuramento Periódico de IVA - Mês ${new Date().getMonth() + 1}/${activeYear?.year_code || new Date().getFullYear()} (Modelo 7 AGT)`,
      lines,
    });
    setIsPostEntryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
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

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm transition"
            title="Imprimir relatório contabilístico"
          >
            <Printer className="w-4 h-4" />
            Imprimir
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GlassCard className="p-4 flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
            <Scale className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
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

        <GlassCard className="p-4 flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              Total Débitos (Período)
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white block truncate">
              <KzAmount value={parseFloat(String(trialBalance?.total_period_debit || 0))} />
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
              Total Créditos (Período)
            </span>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white block truncate">
              <KzAmount value={parseFloat(String(trialBalance?.total_period_credit || 0))} />
            </span>
          </div>
        </GlassCard>

        <GlassCard className="p-4 flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block truncate">
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
        <nav className="flex space-x-6 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
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
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'entries'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Livro Diário de Lançamentos ({entries.length})
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'ledger'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            Livro Razão (Extrato de Conta)
          </button>

          <button
            onClick={() => setActiveTab('financial_statements')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'financial_statements'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Demonstrações Financeiras (Balanço &amp; DRE)
          </button>

          <button
            onClick={() => setActiveTab('vat_settlement')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
              activeTab === 'vat_settlement'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Apuramento de IVA (Modelo 7)
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
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
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
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
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap shrink-0 ${
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

            <div className="flex flex-wrap items-center gap-3">
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

              <button
                onClick={handleExportTrialBalanceCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                title="Exportar balancete em CSV compatível com Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar CSV
              </button>
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
                    <th className="p-3 text-center w-20">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                  {isLoadingTrialBalance ? (
                    <tr>
                      <td
                        colSpan={trialBalanceColumns === 6 ? 9 : 7}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        A carregar balancete de verificação...
                      </td>
                    </tr>
                  ) : filteredTrialBalanceRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={trialBalanceColumns === 6 ? 9 : 7}
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
                          <td className="p-2.5 font-bold">
                            <button
                              type="button"
                              onClick={() => openAccountLedger(r.account_code)}
                              className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-mono"
                              title="Ver movimentos no Livro Razão"
                            >
                              {r.account_code}
                            </button>
                          </td>
                          <td className="p-2.5 font-sans font-medium">
                            <div className="flex items-center gap-2">
                              <span>{r.account_name}</span>
                              {!r.is_analytical && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                  Mãe
                                </span>
                              )}
                            </div>
                          </td>
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
                          <td className="p-2.5 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => openAccountLedger(r.account_code)}
                              className="px-2 py-1 rounded-md text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition inline-flex items-center gap-1"
                              title="Consultar Livro Razão desta conta"
                            >
                              <BookOpen className="w-3 h-3" />
                              Razão
                            </button>
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
                    <td></td>
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

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mostrando <span className="font-bold">{filteredEntries.length}</span> lançamentos
              </span>
              <button
                onClick={handleExportEntriesCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                title="Exportar livro diário em CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar CSV
              </button>
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
                          {e.status !== 'REVERSED' && (
                            <button
                              type="button"
                              onClick={() => openEntryEdit(e)}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600"
                              title="Editar Lançamento"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
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

      {/* TAB 3: LIVRO RAZÃO (EXTRATO DE CONTA) */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="w-full sm:w-80">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Selecionar Conta PGC:
                </label>
                <select
                  value={selectedLedgerAccountCode}
                  onChange={(e) => setSelectedLedgerAccountCode(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {chart.map((a) => (
                    <option key={a.id} value={a.account_code}>
                      {a.account_code} - {a.account_name} ({a.is_analytical ? 'Analítica' : 'Sintética'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative flex-1 sm:max-w-xs mt-auto">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar neste extrato..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportLedgerCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
                title="Exportar extrato da conta em CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar Extrato (CSV)
              </button>
            </div>
          </GlassCard>

          {/* Account Header Summary Card */}
          <GlassCard className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-900 border-blue-200 dark:border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Conta Analítica</span>
              <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {selectedLedgerAccount.code}
              </div>
              <div className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                {selectedLedgerAccount.name}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Natureza / Tipo</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedLedgerAccount.nature === 'DEBIT'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                  }`}
                >
                  {selectedLedgerAccount.nature === 'DEBIT' ? 'DEVEDORA' : 'CREDORA'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {selectedLedgerAccount.is_analytical ? 'Analítica' : 'Sintética'}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Débito do Período</span>
              <div className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
                <KzAmount value={selectedLedgerAccount.period_debit} />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Crédito do Período</span>
              <div className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                <KzAmount value={selectedLedgerAccount.period_credit} />
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase">Saldo Final da Conta</span>
              <div className="text-sm font-mono font-black mt-1">
                {selectedLedgerAccount.closing_debit > 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    <KzAmount value={selectedLedgerAccount.closing_debit} /> (Devedor)
                  </span>
                ) : selectedLedgerAccount.closing_credit > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">
                    <KzAmount value={selectedLedgerAccount.closing_credit} /> (Credor)
                  </span>
                ) : (
                  <span className="text-slate-500">0,00 Kz (Saldo Nulo)</span>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Table of Ledger Entries */}
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="p-3 w-28">Data</th>
                    <th className="p-3 w-20">Lanç.</th>
                    <th className="p-3 w-32">Diário</th>
                    <th className="p-3">Histórico / Descrição</th>
                    <th className="p-3 text-right text-blue-700 dark:text-blue-400 w-36">
                      Débito (Kz)
                    </th>
                    <th className="p-3 text-right text-indigo-700 dark:text-indigo-400 w-36">
                      Crédito (Kz)
                    </th>
                    <th className="p-3 text-right text-slate-900 dark:text-white font-extrabold w-44">
                      Saldo Progressivo
                    </th>
                    <th className="p-3 text-center w-16">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-xs">
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 font-sans">
                        Nenhum movimento contabilístico registado para a conta{' '}
                        <span className="font-bold">{selectedLedgerAccount.code}</span> no período selecionado.
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((l) => (
                      <tr
                        key={l.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="p-3 text-slate-600 dark:text-slate-300 font-sans">
                          {l.date}
                        </td>
                        <td className="p-3 font-bold text-blue-600 dark:text-blue-400">
                          #{l.entry_number}
                        </td>
                        <td className="p-3 font-sans">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {l.journal}
                          </span>
                        </td>
                        <td className="p-3 font-sans font-medium text-slate-800 dark:text-slate-200">
                          {l.description}
                        </td>
                        <td className="p-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                          {l.debit > 0 ? <KzAmount value={l.debit} /> : '-'}
                        </td>
                        <td className="p-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                          {l.credit > 0 ? <KzAmount value={l.credit} /> : '-'}
                        </td>
                        <td className="p-3 text-right font-bold">
                          <span
                            className={
                              l.runningBalance >= 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-amber-700 dark:text-amber-400'
                            }
                          >
                            <KzAmount value={Math.abs(l.runningBalance)} />{' '}
                            <span className="text-[10px] font-normal">
                              ({l.runningBalance >= 0 ? 'D' : 'C'})
                            </span>
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedEntry(l.rawEntry)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-blue-600"
                            title="Ver lançamento em partidas dobradas"
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

      {/* TAB 4: DEMONSTRAÇÕES FINANCEIRAS PGC (BALANÇO & DRE) */}
      {activeTab === 'financial_statements' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setFinancialSubTab('balance_sheet')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  financialSubTab === 'balance_sheet'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Balanço Patrimonial PGC
              </button>
              <button
                type="button"
                onClick={() => setFinancialSubTab('income_statement')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                  financialSubTab === 'income_statement'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Demonstração de Resultados por Natureza (DRE)
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Exercício Fiscal: <span className="font-bold text-slate-800 dark:text-slate-200">{activeYear?.year_code || 2026}</span> (Angola - PGC Classes 1 a 8)
            </div>
          </GlassCard>

          {/* Subtab 4.1: Balanço Patrimonial */}
          {financialSubTab === 'balance_sheet' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Ativo */}
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      ATIVO (Classes 1, 2, 3, 4)
                    </h3>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                      <KzAmount value={financialStatements.balanco.totalAtivo} />
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Ativo Não Corrente (Classe 4)
                      </span>
                      <div className="space-y-1.5 pl-2 border-l-2 border-blue-200 dark:border-blue-900">
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">41. Imobilizações Corpóreas</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.imobCorporeas} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">42. Imobilizações Incorpóreas</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.imobIncorporeas} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1 text-slate-500">
                          <span>(-) 43. Amortizações Acumuladas</span>
                          <span className="font-mono font-semibold">
                            (<KzAmount value={financialStatements.balanco.amortAcumuladas} />)
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold border-t border-slate-200 dark:border-slate-800">
                          <span>Subtotal Ativo Não Corrente</span>
                          <span className="font-mono text-blue-600">
                            <KzAmount value={financialStatements.balanco.totalAtivoNaoCorrente} />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Ativo Corrente (Classes 1, 2, 3)
                      </span>
                      <div className="space-y-1.5 pl-2 border-l-2 border-emerald-200 dark:border-emerald-900">
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">Classe 2. Existências (Armazém / Mercadorias)</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.existencias} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">31. Clientes (Nacionais e Estrangeiros)</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.clientes} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">34. Estado Devedor (IVA Dedutível, Retenções 6,5%)</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.estadoDevedor} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">37. Outros Devedores</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.outrosDevedores} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-slate-900 dark:text-white">
                          <span>Classe 1. Meios Financeiros Líquidos (Caixa e Bancos)</span>
                          <span className="font-mono font-bold text-emerald-600">
                            <KzAmount value={financialStatements.balanco.meiosFinanceiros} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold border-t border-slate-200 dark:border-slate-800">
                          <span>Subtotal Ativo Corrente</span>
                          <span className="font-mono text-emerald-600">
                            <KzAmount value={financialStatements.balanco.totalAtivoCorrente} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-slate-300 dark:border-slate-700 flex justify-between items-center text-sm font-black">
                    <span className="uppercase">TOTAL DO ATIVO</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 text-base">
                      <KzAmount value={financialStatements.balanco.totalAtivo} />
                    </span>
                  </div>
                </GlassCard>

                {/* Passivo e Capital Próprio */}
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                      CAPITAL PRÓPRIO E PASSIVO (Classes 3, 5, 8)
                    </h3>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                      <KzAmount value={financialStatements.balanco.totalPassivoCapitalProprio} />
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Capital Próprio (Classes 5 e 8)
                      </span>
                      <div className="space-y-1.5 pl-2 border-l-2 border-indigo-200 dark:border-indigo-900">
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">51. Capital Social</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.capitalSocial} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">55. Reservas</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.reservas} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">56. Resultados Transitados</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.resultadosTransitados} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold text-indigo-600 dark:text-indigo-400">
                          <span>88. Resultado Líquido do Exercício (Apurado)</span>
                          <span className="font-mono font-bold">
                            <KzAmount value={financialStatements.balanco.resultadoPeriodo} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold border-t border-slate-200 dark:border-slate-800">
                          <span>Subtotal Capital Próprio</span>
                          <span className="font-mono text-indigo-600">
                            <KzAmount value={financialStatements.balanco.totalCapitalProprio} />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="font-bold text-slate-500 uppercase tracking-wide block mb-1">
                        Passivo Corrente &amp; Não Corrente (Classe 3)
                      </span>
                      <div className="space-y-1.5 pl-2 border-l-2 border-amber-200 dark:border-amber-900">
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">32. Fornecedores Nacionais e Estrangeiros</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.fornecedores} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">34. Estado Credor (IVA Liquidado/a Pagar, Retenções, INSS)</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.estadoCredor} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">36. Remunerações a Pagar ao Pessoal</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.remuneracoesPagar} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-600 dark:text-slate-300">37. Outros Credores</span>
                          <span className="font-mono font-semibold">
                            <KzAmount value={financialStatements.balanco.outrosCredores} />
                          </span>
                        </div>
                        <div className="flex justify-between py-1 font-bold border-t border-slate-200 dark:border-slate-800">
                          <span>Subtotal Passivo</span>
                          <span className="font-mono text-amber-600">
                            <KzAmount value={financialStatements.balanco.totalPassivo} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-slate-300 dark:border-slate-700 flex justify-between items-center text-sm font-black">
                    <span className="uppercase">TOTAL PASSIVO + CAPITAL PRÓPRIO</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 text-base">
                      <KzAmount value={financialStatements.balanco.totalPassivoCapitalProprio} />
                    </span>
                  </div>
                </GlassCard>
              </div>

              {/* Equilíbrio Patrimonial Alert Card */}
              <GlassCard
                className={`p-4 flex items-center justify-between text-xs font-bold ${
                  financialStatements.balanco.isBalanced
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 border-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {financialStatements.balanco.isBalanced ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  )}
                  <span>
                    {financialStatements.balanco.isBalanced
                      ? 'Equação Fundamental do Balanço Equilibrada: Ativo = Capital Próprio + Passivo'
                      : `Ajuste Transitório de Fecho: Diferença de ${financialStatements.balanco.balancoDiff.toFixed(
                          2
                        )} Kz até apuramento final de fim de ano`}
                  </span>
                </div>
                <span className="font-mono">
                  Δ = {financialStatements.balanco.balancoDiff.toFixed(2)} Kz
                </span>
              </GlassCard>
            </div>
          )}

          {/* Subtab 4.2: DRE (Demonstração de Resultados por Natureza) */}
          {financialSubTab === 'income_statement' && (
            <GlassCard className="p-6 max-w-4xl mx-auto space-y-4">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Demonstração de Resultados por Natureza (PGC Angola - Classes 6, 7 e 8)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Apuramento económico dos proveitos e custos operacionais, financeiros e determinação do Resultado Líquido
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                {/* 1. Proveitos Operacionais */}
                <div className="py-2.5 flex justify-between font-sans font-bold text-slate-800 dark:text-slate-200">
                  <span>1. Vendas de Mercadorias (Conta 71)</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    <KzAmount value={financialStatements.dre.vendas} />
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans font-bold text-slate-800 dark:text-slate-200">
                  <span>2. Prestação de Serviços (Conta 72)</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    <KzAmount value={financialStatements.dre.servicos} />
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans text-slate-600 dark:text-slate-400">
                  <span>3. Outros Proveitos Operacionais (Contas 73 / 74)</span>
                  <span className="font-mono font-semibold">
                    <KzAmount value={financialStatements.dre.outrosProveitos} />
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans font-black bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 px-2 rounded-lg">
                  <span>TOTAL DOS PROVEITOS OPERACIONAIS</span>
                  <span className="font-mono">
                    <KzAmount value={financialStatements.dre.totalProveitosOperacionais} />
                  </span>
                </div>

                {/* 2. Custos Operacionais */}
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>4. Custo das Mercadorias Vendidas e Matérias Consumidas - CMVMC (Conta 61)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.cmvmc} />)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans font-black bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 px-2 rounded-lg">
                  <span>MARGEM BRUTA DAS VENDAS</span>
                  <span className="font-mono">
                    <KzAmount value={financialStatements.dre.margemBruta} />
                  </span>
                </div>

                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>5. Fornecimentos e Serviços Externos - FSE (Conta 62: Água, Luz, Rendas, Internet)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.fse} />)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>6. Custos com o Pessoal (Conta 63: Remunerações e INSS Patronal)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.pessoal} />)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>7. Amortizações do Exercício (Conta 64)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.amortizacoes} />)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>8. Outros Custos e Perdas Operacionais / Tributos (Conta 65)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.outrosCustosOperacionais} />)
                  </span>
                </div>

                {/* Resultado Operacional */}
                <div className="py-3 flex justify-between font-sans font-black bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 px-3 rounded-xl text-sm">
                  <span>= RESULTADO OPERACIONAL (EBIT)</span>
                  <span className="font-mono">
                    <KzAmount value={financialStatements.dre.resultadoOperacional} />
                  </span>
                </div>

                {/* 3. Resultados Financeiros */}
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>(+) Proveitos e Ganhos Financeiros (Conta 75: Juros e Ganhos Cambiais 75.3)</span>
                  <span className="font-mono font-semibold text-emerald-600">
                    <KzAmount value={financialStatements.dre.proveitosFinanceiros} />
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>(-) Custos e Perdas Financeiras (Conta 66: Juros, Perdas Cambiais 66.3, Despesas Bancárias)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.custosFinanceiros} />)
                  </span>
                </div>
                <div className="py-2.5 flex justify-between font-sans font-bold text-slate-800 dark:text-slate-200">
                  <span>= RESULTADO FINANCEIRO (Conta 82)</span>
                  <span className="font-mono">
                    <KzAmount value={financialStatements.dre.resultadoFinanceiro} />
                  </span>
                </div>

                {/* RAI */}
                <div className="py-2.5 flex justify-between font-sans font-bold text-slate-900 dark:text-white">
                  <span>= RESULTADO ANTES DE IMPOSTOS (RAI / EBT)</span>
                  <span className="font-mono font-bold">
                    <KzAmount value={financialStatements.dre.rai} />
                  </span>
                </div>

                {/* Imposto */}
                <div className="py-2.5 flex justify-between font-sans text-slate-700 dark:text-slate-300">
                  <span>(-) Imposto Industrial Estimado (Conta 87)</span>
                  <span className="font-mono font-semibold text-red-600">
                    (<KzAmount value={financialStatements.dre.impostoEstimado} />)
                  </span>
                </div>

                {/* Resultado Líquido */}
                <div
                  className={`py-3.5 flex justify-between font-sans font-black px-3 rounded-xl text-base ${
                    financialStatements.dre.resultadoLiquido >= 0
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200'
                  }`}
                >
                  <span>= RESULTADO LÍQUIDO DO EXERCÍCIO (Conta 88)</span>
                  <span className="font-mono">
                    <KzAmount value={financialStatements.dre.resultadoLiquido} />
                  </span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* TAB 5: APURAMENTO DE IVA (MODELO 7 AGT) */}
      {activeTab === 'vat_settlement' && (
        <div className="space-y-6">
          <GlassCard className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  Quadro Sinóptico de Apuramento Periódico de IVA
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Em cumprimento do Código do IVA de Angola (AGT) e Declaração Periódica Modelo 7
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenVatSettlementEntry}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
              >
                <PlusCircle className="w-4 h-4" />
                Gerar Lançamento de Apuramento (Conta 34.5.6)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  IVA Liquidado (Vendas)
                </span>
                <div className="text-lg font-black text-blue-700 dark:text-blue-400 font-mono mt-1">
                  <KzAmount value={vatSettlement.totalIvaLiquidado} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Taxa Geral 14% (34.5.3.1):</span>
                    <span className="font-mono font-bold">
                      <KzAmount value={vatSettlement.ivaLiquidado14} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxa Reduzida 5% (34.5.3.2):</span>
                    <span className="font-mono font-bold">
                      <KzAmount value={vatSettlement.ivaLiquidado5} />
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  IVA Dedutível (Compras)
                </span>
                <div className="text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono mt-1">
                  <KzAmount value={vatSettlement.totalIvaDedutivel} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500 space-y-0.5">
                  <div className="flex justify-between">
                    <span>IVA Suportado (34.5.1):</span>
                    <span className="font-mono font-bold">
                      <KzAmount value={vatSettlement.ivaSuportado} />
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>IVA Dedutível (34.5.2):</span>
                    <span className="font-mono font-bold">
                      <KzAmount value={vatSettlement.ivaDedutivel} />
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  vatSettlement.isPayable
                    ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
                    : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900'
                }`}
              >
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                  {vatSettlement.isPayable ? 'IVA a Pagar à AGT' : 'Crédito de IVA a Recuperar'}
                </span>
                <div
                  className={`text-lg font-black font-mono mt-1 ${
                    vatSettlement.isPayable ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  <KzAmount value={vatSettlement.saldoIva} />
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  {vatSettlement.isPayable
                    ? 'Conta PGC: 34.5.7 (IVA a Pagar)'
                    : 'Conta PGC: 34.5.8 (IVA a Recuperar)'}
                </div>
              </div>
            </div>

            {/* Reconciliation table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-800 font-bold font-sans">
                  <tr>
                    <th className="p-3">Campo do Modelo 7</th>
                    <th className="p-3">Conta PGC</th>
                    <th className="p-3 text-right">Valor Apurado (Kz)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  <tr>
                    <td className="p-3">Total do IVA Liquidado às taxas de 14% e 5%</td>
                    <td className="p-3 font-mono font-bold text-blue-600">34.5.3</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <KzAmount value={vatSettlement.totalIvaLiquidado} />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3">Total do IVA Dedutível (Existências, Imobilizado e FSE)</td>
                    <td className="p-3 font-mono font-bold text-indigo-600">34.5.2</td>
                    <td className="p-3 text-right font-mono font-bold">
                      (<KzAmount value={vatSettlement.totalIvaDedutivel} />)
                    </td>
                  </tr>
                  <tr>
                    <td className="p-3">Regularizações de IVA a favor do Estado / Sujeito Passivo</td>
                    <td className="p-3 font-mono font-bold text-slate-600">34.5.5</td>
                    <td className="p-3 text-right font-mono font-bold">
                      <KzAmount value={vatSettlement.ivaRegularizarNet} />
                    </td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-900 font-bold">
                    <td className="p-3 uppercase">
                      Posição Líquida Final do Período ({vatSettlement.isPayable ? 'A Pagar' : 'A Recuperar'})
                    </td>
                    <td className="p-3 font-mono">
                      {vatSettlement.isPayable ? '34.5.7' : '34.5.8'}
                    </td>
                    <td className="p-3 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                      <KzAmount value={vatSettlement.saldoIva} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 6: PLANO GERAL DE CONTAS (PGC) */}
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
                    <th className="p-3 w-24 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoadingChart ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        A carregar Plano Geral de Contabilidade...
                      </td>
                    </tr>
                  ) : filteredChartAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
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
                          <button
                            type="button"
                            onClick={() => openAccountLedger(a.account_code)}
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            title="Ver no Livro Razão"
                          >
                            {a.account_code}
                          </button>
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
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => openAccountLedger(a.account_code)}
                            className="px-2 py-1 rounded text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition inline-flex items-center gap-1"
                            title="Ver movimentos no Razão"
                          >
                            <BookOpen className="w-3 h-3" />
                            Razão
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

      {/* TAB 7: DIÁRIOS & EXERCÍCIOS FISCAIS */}
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
              <button
                onClick={() => setIsNewFiscalYearModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Novo Exercício
              </button>
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        fy.status === 'OPEN'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {fy.status === 'OPEN' ? 'ABERTO' : 'ENCERRADO'}
                    </span>
                    {fy.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setYearToClose(fy.year_code);
                          setIsCloseFiscalYearModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold transition flex items-center gap-1"
                        title="Encerrar exercício fiscal e gerar lançamento de fecho na Classe 8"
                      >
                        <Lock className="w-3 h-3" />
                        Encerrar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 8: REAVALIAÇÃO CAMBIAL */}
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

      {/* MODAL: NOVO EXERCÍCIO FISCAL */}
      {isNewFiscalYearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Novo Exercício Fiscal
              </h3>
              <button
                onClick={() => setIsNewFiscalYearModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ano Fiscal (Ex.: {new Date().getFullYear() + 1})
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2050"
                  value={newFiscalYearCode}
                  onChange={(e) => setNewFiscalYearCode(parseInt(e.target.value) || 2027)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
                />
              </div>
              <p className="text-xs text-slate-500">
                O exercício fiscal será criado com início a 1 de Janeiro e término a 31 de Dezembro, pronto para acolher lançamentos contabilísticos e apuramentos.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewFiscalYearModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={openFiscalYearMutation.isPending || !newFiscalYearCode}
                onClick={() => openFiscalYearMutation.mutate(newFiscalYearCode)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
              >
                {openFiscalYearMutation.isPending ? 'A criar...' : 'Abrir Exercício'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR FECHO DE EXERCÍCIO FISCAL */}
      {isCloseFiscalYearModalOpen && yearToClose && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-amber-600">
              <Lock className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Encerrar Exercício Fiscal {yearToClose}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              O encerramento do exercício fiscal {yearToClose} irá executar automaticamente o apuramento de contas de fim de ano:
            </p>

            <ul className="text-xs text-slate-500 space-y-1 list-disc pl-5">
              <li>Zera todos os saldos devedores de Custos (Classe 6) contra a Conta 81 (Resultados Operacionais)</li>
              <li>Zera todos os saldos credores de Proveitos (Classe 7) contra a Conta 81 (Resultados Operacionais)</li>
              <li>Transfere os Resultados Financeiros (Conta 82) e apura o Resultado Líquido do Exercício na Conta 88</li>
              <li>Gera o lote no Diário oficial de <span className="font-mono font-bold">FECHO</span></li>
              <li>Tranca o exercício contra alterações retroativas não auditadas</li>
            </ul>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsCloseFiscalYearModalOpen(false);
                  setYearToClose(null);
                }}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={closeFiscalYearMutation.isPending}
                onClick={() => closeFiscalYearMutation.mutate(yearToClose)}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md transition"
              >
                {closeFiscalYearMutation.isPending ? 'A processar fecho...' : 'Confirmar Encerramento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETALHES DE LANÇAMENTO E PARTIDAS DOBRADAS */}
      {selectedEntry && !isEditEntryModalOpen && (
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
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEntry(null);
                            openAccountLedger(l.account_code);
                          }}
                          className="text-blue-600 hover:underline"
                          title="Ver Extrato no Razão"
                        >
                          {l.account_code}
                        </button>
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
              {selectedEntry.status !== 'REVERSED' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEntryEdit(selectedEntry)}
                    className="px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar Lançamento
                  </button>
                  {selectedEntry.status === 'POSTED' && (
                    <button
                      type="button"
                      onClick={() => setIsReverseModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Estornar Lançamento (Reverse)
                    </button>
                  )}
                </div>
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

      {/* MODAL: EDITAR LANÇAMENTO (PARTIDAS DOBRADAS) */}
      {isEditEntryModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Editar Lançamento #{selectedEntry.entry_number}
                </h3>
                <p className="text-xs text-slate-500">
                  Ajuste de valores ou classificação contabilística (ex.: IVA liquidado a 100% →
                  50% pago / 50% a regularizar). As partidas dobradas têm de permanecer
                  equilibradas.
                </p>
              </div>
              <button
                onClick={() => setIsEditEntryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Data Transação
                </label>
                <input
                  type="date"
                  value={editEntryForm.transaction_date}
                  onChange={(e) =>
                    setEditEntryForm({ ...editEntryForm, transaction_date: e.target.value })
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
                  value={editEntryForm.period}
                  onChange={(e) =>
                    setEditEntryForm({
                      ...editEntryForm,
                      period: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Origem / Documento
                </label>
                <input
                  type="text"
                  disabled
                  value={
                    selectedEntry.source_document_ref ||
                    selectedEntry.source_service ||
                    'MANUAL'
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Descrição Geral / Histórico da Operação
              </label>
              <input
                type="text"
                placeholder="Ex.: Fatura FT... - IVA liquidado a 50%, restante a regularizar"
                value={editEntryForm.description}
                onChange={(e) =>
                  setEditEntryForm({ ...editEntryForm, description: e.target.value })
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
                    setEditEntryForm({
                      ...editEntryForm,
                      lines: [
                        ...editEntryForm.lines,
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
                    {editEntryForm.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={l.account_code}
                            onChange={(e) => {
                              const newLines = [...editEntryForm.lines];
                              newLines[idx].account_code = e.target.value;
                              setEditEntryForm({ ...editEntryForm, lines: newLines });
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
                              const newLines = [...editEntryForm.lines];
                              newLines[idx].description = e.target.value;
                              setEditEntryForm({ ...editEntryForm, lines: newLines });
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
                              const newLines = [...editEntryForm.lines];
                              newLines[idx].debit_amount = e.target.value;
                              if (e.target.value) newLines[idx].credit_amount = '';
                              setEditEntryForm({ ...editEntryForm, lines: newLines });
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
                              const newLines = [...editEntryForm.lines];
                              newLines[idx].credit_amount = e.target.value;
                              if (e.target.value) newLines[idx].debit_amount = '';
                              setEditEntryForm({ ...editEntryForm, lines: newLines });
                            }}
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-right"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {editEntryForm.lines.length > 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newLines = editEntryForm.lines.filter((_, i) => i !== idx);
                                setEditEntryForm({ ...editEntryForm, lines: newLines });
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
                        <KzAmount value={calculatedEditTotals.deb} />
                      </td>
                      <td className="p-2.5 text-right text-indigo-600">
                        <KzAmount value={calculatedEditTotals.cred} />
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
                calculatedEditTotals.isBalanced
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {calculatedEditTotals.isBalanced ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>
                  {calculatedEditTotals.isBalanced
                    ? 'Partidas dobradas perfeitamente equilibradas!'
                    : `Lançamento Desequilibrado: Diferença de ${calculatedEditTotals.diff.toFixed(
                        2
                      )} Kz entre Débitos e Créditos`}
                </span>
              </div>
              <span className="font-mono">Δ = {calculatedEditTotals.diff.toFixed(2)} Kz</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditEntryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !calculatedEditTotals.isBalanced ||
                  !editEntryForm.description.trim() ||
                  editEntryForm.lines.filter((l) => l.account_code).length < 2 ||
                  updateEntryMutation.isPending
                }
                onClick={() => {
                  const payload: UpdateEntryPayload = {
                    transaction_date: editEntryForm.transaction_date,
                    period: editEntryForm.period,
                    description: editEntryForm.description,
                    lines: editEntryForm.lines
                      .filter((l) => l.account_code)
                      .map((l) => ({
                        account_code: l.account_code,
                        description: l.description || editEntryForm.description,
                        debit_amount: l.debit_amount ? parseFloat(l.debit_amount) : 0,
                        credit_amount: l.credit_amount ? parseFloat(l.credit_amount) : 0,
                      })),
                  };
                  updateEntryMutation.mutate({ id: selectedEntry.id, payload });
                }}
                className={`px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md transition ${
                  calculatedEditTotals.isBalanced &&
                  editEntryForm.description.trim() &&
                  editEntryForm.lines.filter((l) => l.account_code).length >= 2
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                {updateEntryMutation.isPending ? 'A gravar...' : 'Guardar Alterações'}
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
