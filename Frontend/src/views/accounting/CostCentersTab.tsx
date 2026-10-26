import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Building2,
  PlusCircle,
  AlertTriangle,
  TrendingUp,
  PieChart,
  Sliders,
  ShieldAlert,
  Download,
  Truck,
  FolderGit2,
  UserCheck,
  Edit3,
  X,
  ArrowRight,
  Info,
  FileText,
  ShoppingBag,
  CreditCard,
  BookOpen,
  Tag,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRightLeft,
  Laptop,
  Package,
  Search,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { KzAmount } from '../../components/common/KzAmount';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  accountingApi,
  CostCenterItem,
  CreateCostCenterPayload,
  UpdateCostCenterPayload,
  CreateAllocationRulePayload,
  AllocateExpensePayload,
  CostAllocationRecord,
  ReclassifyCostAllocationPayload,
} from '../../api/accounting';

type CostCenterSubTab =
  | 'overview'
  | 'hierarchy'
  | 'allocations'
  | 'budgets'
  | 'governance';

const num = (v: number | string | undefined | null): number =>
  typeof v === 'number' ? v : parseFloat(String(v || 0)) || 0;

export const CostCentersTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<CostCenterSubTab>('overview');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [selectedCenterFilter, setSelectedCenterFilter] = useState<string>('ALL');

  // Modais
  const [isCreateCenterOpen, setIsCreateCenterOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenterItem | null>(null);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['accounting_cost_centers_dashboard'],
    queryFn: accountingApi.getCostCentersDashboard,
  });

  const centers = dashboard?.centers || [];
  const activeOperationalCenters = useMemo(
    () => centers.filter((c) => c.is_active && c.center_type !== 'SHARED_SERVICE'),
    [centers]
  );

  // Form Novo Centro de Custos
  const [newCenterForm, setNewCenterForm] = useState<CreateCostCenterPayload>({
    code: 'CC-LOG-002',
    name: '',
    description: '',
    parent_cost_center_id: '',
    center_type: 'COST_CENTER',
    branch_name: 'Sede - Luanda',
    department_name: 'Operações',
    responsible_name: '',
    valid_from: '2026-01-01',
    valid_to: '',
    monthly_budget: 1000000,
    alert_threshold_pct: 80,
  });

  // Form Editar Centro
  const [editCenterForm, setEditCenterForm] = useState<UpdateCostCenterPayload>({
    name: '',
    description: '',
    parent_cost_center_id: undefined,
    center_type: 'COST_CENTER',
    branch_name: 'Sede - Luanda',
    department_name: '',
    responsible_name: '',
    valid_from: '2026-01-01',
    valid_to: undefined,
    monthly_budget: 0,
    alert_threshold_pct: 80,
    is_active: true,
    committed_amount: 0,
  });

  // Form Nova Regra de Repartição
  const [newRuleForm, setNewRuleForm] = useState<CreateAllocationRulePayload>({
    code: 'REG-AGUA-01',
    name: 'Repartição de Consumo de Água (EPAL)',
    description: 'Critério baseado no efectivo de colaboradores por departamento',
    allocation_basis: 'NUM_COLABORADORES',
    default_account_code: '75.2.11',
    lines: [],
  });

  // Form Imputação / Distribuição Analítica de Documento
  const [allocForm, setAllocForm] = useState<AllocateExpensePayload>({
    source_module: 'TESOURARIA',
    source_document_ref: 'FT ENDE-2026/11500',
    allocation_date: new Date().toISOString().split('T')[0],
    account_code: '75.2.11',
    account_name: 'Água e Electricidade (FSE)',
    is_capex: false,
    total_amount: 600000,
    allocation_rule_id: undefined,
    allocation_criterion: 'Repartição por potência instalada e área ocupada (100%)',
    project_code: '',
    vehicle_or_asset: '',
    notes: 'Distribuição analítica da fatura mensal partilhada',
    lines: [],
  });

  const createCenterMutation = useMutation({
    mutationFn: accountingApi.createCostCenter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_cost_centers_dashboard'] });
      setIsCreateCenterOpen(false);
    },
  });

  const updateCenterMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCostCenterPayload }) =>
      accountingApi.updateCostCenter(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_cost_centers_dashboard'] });
      setEditingCenter(null);
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: accountingApi.createAllocationRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_cost_centers_dashboard'] });
      setIsCreateRuleOpen(false);
    },
  });

  const allocateExpenseMutation = useMutation({
    mutationFn: accountingApi.allocateExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_cost_centers_dashboard'] });
      setIsAllocateModalOpen(false);
    },
  });

  // Cadeias de Rastreabilidade (Trace Chains) & Reclassificação
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  const [traceSearch, setTraceSearch] = useState<string>('');

  const [isReclassModalOpen, setIsReclassModalOpen] = useState(false);
  const [selectedAllocationForReclass, setSelectedAllocationForReclass] = useState<CostAllocationRecord | null>(null);
  const [reclassForm, setReclassForm] = useState<ReclassifyCostAllocationPayload>({
    allocation_id: '',
    to_cost_center_id: '',
    transferred_amount: 0,
    transferred_units: 1,
    asset_tags_moved: '',
    reason: '',
    performed_by: 'Dr. António Manuel (Contabilista Chefe OCPCA)',
  });

  const reclassifyMutation = useMutation({
    mutationFn: accountingApi.reclassifyAllocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounting_cost_centers_dashboard'] });
      setIsReclassModalOpen(false);
      setSelectedAllocationForReclass(null);
    },
  });

  // Auto-expandir a primeira cadeia ao carregar os dados
  useEffect(() => {
    if (dashboard?.trace_chains && dashboard.trace_chains.length > 0 && expandedChains.size === 0) {
      setExpandedChains(new Set([dashboard.trace_chains[0].batch_id]));
    }
  }, [dashboard?.trace_chains]);

  const toggleChainExpansion = (batchId: string) => {
    setExpandedChains((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const expandAllChains = () => {
    if (dashboard?.trace_chains) {
      setExpandedChains(new Set(dashboard.trace_chains.map((c) => c.batch_id)));
    }
  };

  const collapseAllChains = () => {
    setExpandedChains(new Set());
  };

  const openReclassifyModal = (alloc: CostAllocationRecord) => {
    setSelectedAllocationForReclass(alloc);
    const maxUnits = num(alloc.allocated_units) || 1;
    const maxAmount = num(alloc.allocated_amount);
    const unitPrice = maxUnits > 0 ? maxAmount / maxUnits : maxAmount;
    const defaultTransferredUnits = Math.min(1, maxUnits);
    const otherCenter = activeOperationalCenters.find((c) => c.id !== alloc.cost_center_id) || activeOperationalCenters[0];

    setReclassForm({
      allocation_id: alloc.id,
      to_cost_center_id: otherCenter?.id || '',
      transferred_amount: unitPrice * defaultTransferredUnits,
      transferred_units: defaultTransferredUnits,
      asset_tags_moved: alloc.asset_tags ? alloc.asset_tags.split(',')[0].trim() : '',
      reason: `Transferência de equipamento para reforço operacional em ${otherCenter?.name || 'novo centro'}`,
      performed_by: 'Dr. António Manuel (Contabilista Chefe OCPCA)',
    });
    setIsReclassModalOpen(true);
  };

  const openEditModal = (c: CostCenterItem) => {
    setEditingCenter(c);
    setEditCenterForm({
      name: c.name,
      description: c.description || '',
      parent_cost_center_id: c.parent_cost_center_id || undefined,
      center_type: c.center_type,
      branch_name: c.branch_name,
      department_name: c.department_name || '',
      responsible_name: c.responsible_name || '',
      valid_from: c.valid_from,
      valid_to: c.valid_to || undefined,
      monthly_budget: num(c.monthly_budget),
      alert_threshold_pct: num(c.alert_threshold_pct) || 80,
      is_active: c.is_active,
      committed_amount: num(c.committed_amount),
    });
  };

  // Pré-carregar um dos 4 Casos Práticos (A, B, C, D) no modal de distribuição
  const openPracticalCase = (caseId: 'A' | 'B' | 'C' | 'D') => {
    const ti = centers.find((c) => c.code === 'CC-TI-001') || activeOperationalCenters[0];
    const rh = centers.find((c) => c.code === 'CC-RH-001') || activeOperationalCenters[1];
    const vnd = centers.find((c) => c.code === 'CC-VND-001') || activeOperationalCenters[2];
    const ops = centers.find((c) => c.code === 'CC-OPS-001') || activeOperationalCenters[3];
    const fin = centers.find((c) => c.code === 'CC-FIN-001') || activeOperationalCenters[4];
    const endeRule = dashboard?.allocation_rules.find((r) => r.code === 'REG-ENDE-01');

    if (caseId === 'A' && ti && rh && vnd) {
      setAllocForm({
        source_module: 'COMPRAS',
        source_document_ref: 'FT SISTEC-2026/00501',
        supplier_name: 'SISTEC Angola, S.A.',
        purchase_order_ref: 'OC 2026/00142',
        receipt_delivery_ref: 'GR 2026/00089 (10 Computadores)',
        payment_settlement_ref: 'RC 2026/00310 (BAI)',
        journal_entry_ref: 'COMP #2026/0045',
        allocation_date: new Date().toISOString().split('T')[0],
        account_code: '11.5',
        account_name: 'Equipamento Administrativo e Informático (Ativo Imobilizado)',
        is_capex: true,
        total_amount: 5000000,
        total_units: 10,
        unit_measure: 'Computadores',
        useful_life_months: 48,
        allocation_rule_id: undefined,
        allocation_criterion: 'Distribuição Física por Termo de Entrega de Equipamentos (10 Unidades = Kz 5.000.000)',
        project_code: 'PRJ-RENOV-PARQUE-26',
        vehicle_or_asset: 'Lote 10 Computadores Dell Latitude 5540',
        notes:
          'Caso A: Compra de 10 computadores reconhecida como Ativo Imobilizado (Conta 11.5). Não consome o orçamento operacional mensal de uma só vez; quota mensal de amortização de Kz 104.166,67 amortizada ao longo de 48 meses.',
        lines: [
          {
            cost_center_id: ti.id,
            percentage: 40,
            allocated_units: 4,
            asset_tags: 'PAT-TI-001, PAT-TI-002, PAT-TI-003, PAT-TI-004',
            recipient_responsible: 'Eng.º Osvaldo Neto',
            notes: '4 portáteis afetos à equipa de TI e desenvolvimento',
          },
          {
            cost_center_id: rh.id,
            percentage: 30,
            allocated_units: 3,
            asset_tags: 'PAT-RH-001, PAT-RH-002, PAT-RH-003',
            recipient_responsible: 'Dra. Helena Sebastião',
            notes: '3 portáteis para processamento de salários e atendimento RH',
          },
          {
            cost_center_id: vnd.id,
            percentage: 30,
            allocated_units: 3,
            asset_tags: 'PAT-VND-001, PAT-VND-002, PAT-VND-003',
            recipient_responsible: 'Paulo Cassule',
            notes: '3 portáteis para a equipa comercial externa',
          },
        ],
      });
    } else if (caseId === 'B' && ti && rh && vnd && fin) {
      setAllocForm({
        source_module: 'TESOURARIA',
        source_document_ref: 'FT ENDE-2026/11900',
        allocation_date: new Date().toISOString().split('T')[0],
        account_code: '75.2.11',
        account_name: 'Água e Electricidade (FSE)',
        is_capex: false,
        total_amount: 600000,
        allocation_rule_id: endeRule?.id,
        allocation_criterion: 'Regra REG-ENDE-01: Potência instalada e área ocupada (TI 30%, RH 20%, Vendas 35%, Finanças 15%)',
        project_code: '',
        vehicle_or_asset: '',
        notes: 'Caso B: Fatura mensal de eletricidade partilhada distribuída por 4 centros (Total = 100%).',
        lines: [
          { cost_center_id: ti.id, percentage: 30, notes: 'Servidores e climatização TI' },
          { cost_center_id: rh.id, percentage: 20, notes: 'Área administrativa RH' },
          { cost_center_id: vnd.id, percentage: 35, notes: 'Showroom comercial Vendas' },
          { cost_center_id: fin.id, percentage: 15, notes: 'Gabinetes Finanças' },
        ],
      });
    } else if (caseId === 'C' && ops) {
      setAllocForm({
        source_module: 'INVENTARIO',
        source_document_ref: 'FR SONANGOL-2026/9104',
        allocation_date: new Date().toISOString().split('T')[0],
        account_code: '75.2.13',
        account_name: 'Combustíveis e Lubrificantes (Frota)',
        is_capex: false,
        total_amount: 350000,
        allocation_rule_id: undefined,
        allocation_criterion: 'Imputação por Guia de Abastecimento e Viatura',
        project_code: 'PRJ-ROTA-BENGUELA',
        vehicle_or_asset: 'Viatura LD-44-82-IA (Toyota Hilux)',
        notes: 'Caso C: Combustível atribuído ao centro de Logística, à viatura e à operação que originou a deslocação.',
        lines: [{ cost_center_id: ops.id, percentage: 100 }],
      });
    } else if (caseId === 'D' && ti) {
      setAllocForm({
        source_module: 'COMPRAS',
        source_document_ref: 'FT DATACENTER-2026/0112',
        allocation_date: new Date().toISOString().split('T')[0],
        account_code: '75.2.20',
        account_name: 'Serviços Técnicos Especializados e Comunicações',
        is_capex: false,
        total_amount: 350000,
        allocation_rule_id: undefined,
        allocation_criterion: 'Folha de horas e fatura afeta ao projeto',
        project_code: 'PRJ-MODERNIZACAO-DC',
        vehicle_or_asset: 'Bastidor Principal Luanda',
        notes: 'Caso D: Acompanhamento dos custos do projeto sem confundir o projeto com o centro de custos responsável.',
        lines: [{ cost_center_id: ti.id, percentage: 100 }],
      });
    }
    setIsAllocateModalOpen(true);
  };

  const applyRuleToAllocationForm = (ruleId: string) => {
    const rule = dashboard?.allocation_rules.find((r) => r.id === ruleId);
    if (!rule) return;
    setAllocForm((prev) => ({
      ...prev,
      allocation_rule_id: rule.id,
      account_code: rule.default_account_code || prev.account_code,
      allocation_criterion: `${rule.code} - ${rule.name} (${rule.allocation_basis})`,
      lines: rule.lines.map((l) => ({
        cost_center_id: l.cost_center_id,
        percentage: num(l.percentage),
        notes: l.justification || '',
      })),
    }));
  };

  const allocTotalPct = useMemo(
    () => allocForm.lines.reduce((acc, l) => acc + (Number(l.percentage) || 0), 0),
    [allocForm.lines]
  );

  const ruleTotalPct = useMemo(
    () => newRuleForm.lines.reduce((acc, l) => acc + (Number(l.percentage) || 0), 0),
    [newRuleForm.lines]
  );

  const filteredCenters = useMemo(() => {
    return centers.filter((c) => {
      if (branchFilter !== 'ALL' && c.branch_name !== branchFilter) return false;
      return true;
    });
  }, [centers, branchFilter]);

  const filteredAllocations = useMemo(() => {
    const list = dashboard?.recent_allocations || [];
    return list.filter((a) => {
      if (branchFilter !== 'ALL' && a.branch_name !== branchFilter) return false;
      if (selectedCenterFilter !== 'ALL' && a.cost_center_id !== selectedCenterFilter) return false;
      return true;
    });
  }, [dashboard, branchFilter, selectedCenterFilter]);

  const filteredTraceChains = useMemo(() => {
    const list = dashboard?.trace_chains || [];
    return list.filter((chain) => {
      if (branchFilter !== 'ALL') {
        const matchesBranch = chain.splits.some((s) => s.branch_name === branchFilter);
        if (!matchesBranch) return false;
      }
      if (selectedCenterFilter !== 'ALL') {
        const matchesCenter = chain.splits.some((s) => s.cost_center_id === selectedCenterFilter);
        if (!matchesCenter) return false;
      }
      if (traceSearch.trim()) {
        const q = traceSearch.toLowerCase();
        const matchesDoc = chain.source_document_ref.toLowerCase().includes(q);
        const matchesSupplier = (chain.supplier_name || '').toLowerCase().includes(q);
        const matchesPo = (chain.purchase_order_ref || '').toLowerCase().includes(q);
        const matchesGr = (chain.receipt_delivery_ref || '').toLowerCase().includes(q);
        const matchesAcct =
          chain.account_code.includes(q) || chain.account_name.toLowerCase().includes(q);
        const matchesSplits = chain.splits.some(
          (s) =>
            s.cost_center_name.toLowerCase().includes(q) ||
            s.cost_center_code.toLowerCase().includes(q) ||
            (s.asset_tags || '').toLowerCase().includes(q) ||
            (s.recipient_responsible || '').toLowerCase().includes(q)
        );
        return (
          matchesDoc ||
          matchesSupplier ||
          matchesPo ||
          matchesGr ||
          matchesAcct ||
          matchesSplits
        );
      }
      return true;
    });
  }, [dashboard, branchFilter, selectedCenterFilter, traceSearch]);

  const handleExportCostCentersCsv = () => {
    if (!dashboard) return;
    const header =
      'Código;Centro de Custos;Tipo;Filial / Estabelecimento;Departamento;Responsável;Estado;Orçamento Mensal (Kz);Custo Realizado OPEX (Kz);Compromissos (Kz);Saldo Orçamental (Kz);Execução (%);Investimento CAPEX (Kz)';
    const rows = dashboard.centers.map((c) =>
      [
        c.code,
        `"${c.name}"`,
        c.center_type,
        `"${c.branch_name}"`,
        `"${c.department_name || '-'}"`,
        `"${c.responsible_name || 'Sem Responsável'}"`,
        c.is_active ? 'Ativo' : 'Inativo',
        num(c.monthly_budget).toFixed(2),
        num(c.realized_opex).toFixed(2),
        num(c.committed_amount).toFixed(2),
        num(c.available_budget).toFixed(2),
        num(c.utilization_pct).toFixed(2) + '%',
        num(c.realized_capex).toFixed(2),
      ].join(';')
    );
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mapa_Centros_Custos_Orcamento_2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !dashboard) {
    return (
      <GlassCard className="p-8 text-center text-slate-500">
        A carregar estrutura de Centros de Custos, Regras de Rateio e Controlo Orçamental...
      </GlassCard>
    );
  }

  const maxDeptCost = Math.max(
    1,
    ...dashboard.by_department.map((d) => Math.max(num(d.realized_opex), num(d.budget_amount)))
  );

  return (
    <div className="space-y-6">
      {/* Top Sub-Navigation & Actions */}
      <GlassCard className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex rounded-xl border border-slate-300 dark:border-slate-700 p-1 bg-slate-100 dark:bg-slate-800 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSubTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'overview'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            1. Mapa de Custos &amp; Dashboard
          </button>
          <button
            type="button"
            onClick={() => setSubTab('hierarchy')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'hierarchy'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            2. Hierarquia &amp; Cadastro ({centers.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('allocations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'allocations'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            3. Repartição de Despesas (Casos A-D)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('budgets')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'budgets'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            4. Orçamento &amp; Desvios (80/90/100%)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('governance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
              subTab === 'governance'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            5. Relatórios &amp; Governação
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
          >
            <option value="ALL">Todas as Filiais (Luanda + Benguela)</option>
            <option value="Sede - Luanda">Filial: Sede - Luanda</option>
            <option value="Filial - Benguela">Filial: Benguela</option>
          </select>

          <button
            type="button"
            onClick={() => openPracticalCase('B')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5" />
            Distribuir Despesa
          </button>

          <button
            type="button"
            onClick={() => setIsCreateCenterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Novo Centro de Custos
          </button>

          <button
            type="button"
            onClick={handleExportCostCentersCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Mapa CSV
          </button>
        </div>
      </GlassCard>

      {/* KPIs Executivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <GlassCard className="p-4 border-l-4 border-l-blue-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Custos Reconhecidos (OPEX)
          </span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
            <KzAmount value={num(dashboard.total_realized_opex)} />
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Execução global: <b>{num(dashboard.overall_utilization_pct).toFixed(1)}%</b> do orçamento
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-indigo-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Orçamento Mensal Aprovado
          </span>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
            <KzAmount value={num(dashboard.total_budget_monthly)} />
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {dashboard.active_centers_count} centros ativos em vigor
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Compromissos Assumidos
          </span>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
            <KzAmount value={num(dashboard.total_committed)} />
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Encomendas e obrigações em curso
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Saldo Orçamental Disponível
          </span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
            <KzAmount value={num(dashboard.total_available_budget)} />
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Orçamento − (Realizado + Compromissos)
          </span>
        </GlassCard>

        <GlassCard className="p-4 border-l-4 border-l-purple-600">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Investimento Ativos (CAPEX)
          </span>
          <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-1">
            <KzAmount value={num(dashboard.total_realized_capex)} />
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Imobilizado (Classe 1) separado do OPEX
          </span>
        </GlassCard>
      </div>

      {/* SUBTAB 1: MAPA DE CUSTOS & DASHBOARD */}
      {subTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gráfico Horizontal: Mapa de Custos Mensal por Departamento */}
            <GlassCard className="p-6 lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Mapa de Custos Mensal por Departamento (AOA · Kz)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Onde os recursos estão a ser consumidos face ao orçamento autorizado de cada área
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                  Total OPEX: <KzAmount value={num(dashboard.total_realized_opex)} />
                </span>
              </div>

              <div className="space-y-4 pt-1">
                {dashboard.by_department.map((dept) => {
                  const opex = num(dept.realized_opex);
                  const budget = num(dept.budget_amount);
                  const pctBar = Math.min(100, (opex / maxDeptCost) * 100);
                  const utilPct = num(dept.utilization_pct);
                  return (
                    <div key={`${dept.branch_name}-${dept.department_name}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {dept.department_name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {dept.branch_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-slate-500 text-[11px]">
                            Orç.: <KzAmount value={budget} />
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">
                            <KzAmount value={opex} />
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              utilPct >= 100
                                ? 'bg-red-100 text-red-700'
                                : utilPct >= 80
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {utilPct.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            utilPct >= 100
                              ? 'bg-red-600'
                              : utilPct >= 80
                              ? 'bg-amber-500'
                              : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.max(4, pctBar)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* Comparativo por Filial / Estabelecimento + Evolução Mensal */}
            <div className="lg:col-span-5 space-y-6">
              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Custos por Filial / Estabelecimento
                </h3>
                <p className="text-xs text-slate-500">
                  A filial e o centro de custos são dimensões independentes: cada filial agrega os seus departamentos locais.
                </p>
                <div className="space-y-3 pt-1">
                  {dashboard.by_branch.map((b) => (
                    <div
                      key={b.branch_name}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {b.branch_name}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            ({b.centers_count} unidades operacionais)
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          <KzAmount value={num(b.realized_opex)} />
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                        <div>
                          Orçamento: <b className="text-slate-700 dark:text-slate-200"><KzAmount value={num(b.total_budget)} /></b>
                        </div>
                        <div>
                          Compromisso: <b className="text-amber-600"><KzAmount value={num(b.committed_amount)} /></b>
                        </div>
                        <div>
                          CAPEX: <b className="text-purple-600"><KzAmount value={num(b.realized_capex)} /></b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Evolução Mensal dos Custos (2026)
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {dashboard.monthly_trend.map((m) => (
                    <div key={m.period_month} className="py-2 flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {m.month_label}
                      </span>
                      <div className="flex items-center gap-4 font-mono">
                        <span className="text-slate-900 dark:text-white font-bold">
                          OPEX: <KzAmount value={num(m.realized_opex)} />
                        </span>
                        {num(m.realized_capex) > 0 && (
                          <span className="text-purple-600 text-[11px]">
                            CAPEX: <KzAmount value={num(m.realized_capex)} />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Matriz Conceptual: Conta PGC vs Centro de Custos vs Projeto vs Filial */}
          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Arquitetura Multidimensional: Conta Contabilística ≠ Centro de Custos ≠ Projeto ≠ Filial
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-blue-600 block">1. Conta PGC</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">Que tipo de gasto?</strong>
                <span className="text-slate-500 text-[11px]">Ex.: 75.2.11 Eletricidade</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-emerald-600 block">2. Centro de Custos</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">Que área suporta?</strong>
                <span className="text-slate-500 text-[11px]">Ex.: CC-TI-001 (Dept. TI)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-indigo-600 block">3. Centro de Lucros</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">Que unidade gera resultado?</strong>
                <span className="text-slate-500 text-[11px]">Ex.: CC-VND-001 (Comercial)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-purple-600 block">4. Projeto / Viatura</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">A que iniciativa/ativo?</strong>
                <span className="text-slate-500 text-[11px]">Ex.: PRJ-DATACENTER-26</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-amber-600 block">5. Filial</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">Em que estabelecimento?</strong>
                <span className="text-slate-500 text-[11px]">Ex.: Sede Luanda / Benguela</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase text-rose-600 block">6. Orçamento</span>
                <strong className="text-slate-900 dark:text-white block mt-0.5">Quanto foi autorizado?</strong>
                <span className="text-slate-500 text-[11px]">Ex.: Kz 1.500.000 / mês</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* SUBTAB 2: HIERARQUIA & CADASTRO DE CENTROS DE CUSTOS */}
      {subTab === 'hierarchy' && (
        <GlassCard className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Estrutura Hierárquica de Centros de Custos e Lucros
              </h3>
              <p className="text-xs text-slate-500">
                Códigos únicos por empresa, vínculo hierárquico, responsável, vigência e proteção contra uso de centros inativos
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-separate border-spacing-0">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-bold">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Centro de Custos / Hierarquia</th>
                  <th className="p-3">Filial</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Vigência</th>
                  <th className="p-3 text-right">Orçamento Mensal</th>
                  <th className="p-3 text-right">Custo Realizado</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCenters.map((c) => {
                  const isChild = Boolean(c.parent_cost_center_id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        !isChild ? 'bg-slate-50/60 dark:bg-slate-900/40 font-bold' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {isChild ? `↳ ${c.code}` : c.code}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                        {c.parent_code && (
                          <div className="text-[11px] text-slate-400">
                            Superior: {c.parent_code} — {c.parent_name}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                          {c.branch_name}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.center_type === 'PROFIT_CENTER'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : c.center_type === 'SHARED_SERVICE'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                        >
                          {c.center_type === 'PROFIT_CENTER'
                            ? 'Centro de Lucros'
                            : c.center_type === 'SHARED_SERVICE'
                            ? 'Unidade Agregadora'
                            : c.center_type === 'PROJECT_UNIT'
                            ? 'Unidade de Projeto'
                            : 'Centro de Custos'}
                        </span>
                      </td>
                      <td className="p-3">
                        {c.responsible_name ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            {c.responsible_name}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold">Não atribuído</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {c.valid_from} {c.valid_to ? `até ${c.valid_to}` : '→ Em vigor'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">
                        <KzAmount value={num(c.monthly_budget)} />
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        <KzAmount value={num(c.realized_opex)} />
                      </td>
                      <td className="p-3 text-center">
                        <StatusBadge
                          status={c.is_active ? 'ok' : 'critico'}
                          label={c.is_active ? 'Ativo' : 'Inativo'}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* SUBTAB 3: REPARTIÇÃO DE DESPESAS & CASOS PRÁTICOS A, B, C, D */}
      {subTab === 'allocations' && (
        <div className="space-y-6">
          {/* Atalhos para os 4 Casos Práticos da Especificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <GlassCard className="p-4 flex flex-col justify-between border border-purple-200 dark:border-purple-900/50">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                  Caso A — Compra de Ativo (CAPEX)
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  Compra de Computadores (Kz 2.000.000)
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Reconhecido como Ativo Imobilizado (Conta 11.5) no Centro TI + Projeto Renovação, sem distorcer o OPEX mensal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPracticalCase('A')}
                className="mt-3 w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center justify-center gap-1"
              >
                Simular Caso A <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between border border-emerald-200 dark:border-emerald-900/50">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Caso B — Despesa Partilhada (100%)
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  Fatura Eletricidade ENDE (Kz 600.000)
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Repartição automática: TI 30% (180k), RH 20% (120k), Vendas 35% (210k) e Finanças 15% (90k) = 100%.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPracticalCase('B')}
                className="mt-3 w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1"
              >
                Simular Caso B <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between border border-amber-200 dark:border-amber-900/50">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                  Caso C — Viatura &amp; Logística
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  Combustível de Viatura Operacional
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Atribuído ao Centro de Operações/Logística, à viatura específica (LD-44-82-IA) e à rota/projeto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPracticalCase('C')}
                className="mt-3 w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1"
              >
                Simular Caso C <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between border border-blue-200 dark:border-blue-900/50">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  Caso D — Projeto vs Centro de Custo
                </span>
                <h4 className="text-sm font-black text-slate-900 dark:text-white mt-2">
                  Modernização do Datacenter / ERP
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Acompanha os custos do projeto (PRJ-DATACENTER-26) mantendo o Centro de Custos TI responsável.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openPracticalCase('D')}
                className="mt-3 w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center justify-center gap-1"
              >
                Simular Caso D <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </GlassCard>
          </div>

          {/* Regras de Repartição Configuradas */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Regras de Repartição de Custos Partilhados (Critérios Documentados = 100%)
                </h3>
                <p className="text-xs text-slate-500">
                  Evita percentagens arbitrárias: cada regra documenta a base de rateio (consumo, área m², efetivo)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewRuleForm({
                    code: `REG-PART-${(dashboard.allocation_rules.length + 1).toString().padStart(2, '0')}`,
                    name: '',
                    description: '',
                    allocation_basis: 'AREA_OCUPADA_M2',
                    default_account_code: '75.2.21',
                    lines: activeOperationalCenters.slice(0, 2).map((c) => ({
                      cost_center_id: c.id,
                      percentage: 50,
                      justification: '50% área ocupada',
                    })),
                  });
                  setIsCreateRuleOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Nova Regra de Rateio
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {dashboard.allocation_rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {rule.code}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Total: {num(rule.total_percentage).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {rule.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{rule.description}</p>
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                    {rule.lines.map((l) => (
                      <div key={l.id} className="flex items-center justify-between">
                        <span className="text-slate-700 dark:text-slate-300 truncate">
                          <b>{l.cost_center_code}</b> — {l.cost_center_name}
                        </span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {num(l.percentage).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* CADEIA DE RASTREABILIDADE DOCUMENTAL COMPLETA (TRACE CHAINS) */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Cadeias de Rastreabilidade Documental Completa (Origem → Atribuição → Equipamentos &amp; Tags → Depreciação)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                    {filteredTraceChains.length} operações
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Acompanha a compra original, ordens de compra, guias de remessa, pagamentos, equipamentos físicos entregues aos colaboradores e a distinção entre CAPEX e depreciação
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar documento, fornecedor, tag patrimonial..."
                    value={traceSearch}
                    onChange={(e) => setTraceSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs w-64"
                  />
                  {traceSearch && (
                    <button
                      type="button"
                      onClick={() => setTraceSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={expandAllChains}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Expandir Todos
                </button>
                <button
                  type="button"
                  onClick={collapseAllChains}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Recolher Todos
                </button>
              </div>
            </div>

            {/* Lista de Cadeias de Rastreabilidade */}
            <div className="space-y-4">
              {filteredTraceChains.map((chain) => {
                const isExpanded = expandedChains.has(chain.batch_id);
                return (
                  <div
                    key={chain.batch_id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      chain.is_capex
                        ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/20 dark:bg-purple-950/10'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40'
                    }`}
                  >
                    {/* Cabeçalho do Card da Operação */}
                    <div
                      onClick={() => toggleChainExpansion(chain.batch_id)}
                      className="p-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                    >
                      <div className="flex items-start md:items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            chain.is_capex
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                          }`}
                        >
                          {chain.is_capex ? <Laptop className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                              {chain.source_document_ref}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                chain.is_capex
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              }`}
                            >
                              {chain.is_capex ? 'Ativo Imobilizado (CAPEX)' : 'Despesa Operacional (OPEX)'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {chain.allocation_date} · {chain.source_module}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1.5 mt-0.5">
                            <span>Fornecedor: <b>{chain.supplier_name || 'Despesa Geral'}</b></span>
                            <span>•</span>
                            <span className="font-mono">{chain.account_code} — {chain.account_name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-center">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            Montante Total
                          </span>
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                            <KzAmount value={num(chain.total_document_amount)} />
                          </span>
                          {chain.is_capex && num(chain.total_monthly_depreciation) > 0 && (
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 block">
                              Quota: <KzAmount value={num(chain.total_monthly_depreciation)} />/mês
                            </span>
                          )}
                        </div>
                        <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo Expansível: Trilha Documental + Ativos + Splits */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/40 dark:bg-slate-950/20">
                        {/* 1. Trilha Documental Integrada (5 Elos) */}
                        <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                            Rastreabilidade Documental Ponta a Ponta (Documentos Relacionados)
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                              <span className="text-[10px] font-bold text-slate-400 block flex items-center gap-1">
                                <FileText className="w-3 h-3 text-blue-500" /> 1. Fatura de Fornecedor
                              </span>
                              <strong className="font-mono text-slate-900 dark:text-white block truncate">
                                {chain.source_document_ref}
                              </strong>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                              <span className="text-[10px] font-bold text-slate-400 block flex items-center gap-1">
                                <ShoppingBag className="w-3 h-3 text-amber-500" /> 2. Ordem de Compra (PO)
                              </span>
                              <strong className="font-mono text-slate-900 dark:text-white block truncate">
                                {chain.purchase_order_ref || 'Não especificada'}
                              </strong>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                              <span className="text-[10px] font-bold text-slate-400 block flex items-center gap-1">
                                <Truck className="w-3 h-3 text-emerald-500" /> 3. Guia de Remessa / Recepção
                              </span>
                              <strong className="font-mono text-slate-900 dark:text-white block truncate">
                                {chain.receipt_delivery_ref || 'Não especificada'}
                              </strong>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                              <span className="text-[10px] font-bold text-slate-400 block flex items-center gap-1">
                                <CreditCard className="w-3 h-3 text-indigo-500" /> 4. Pagamento / Liquidação
                              </span>
                              <strong className="font-mono text-slate-900 dark:text-white block truncate">
                                {chain.payment_settlement_ref || 'Não especificado'}
                              </strong>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                              <span className="text-[10px] font-bold text-slate-400 block flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-purple-500" /> 5. Diário Contabilístico
                              </span>
                              <strong className="font-mono text-slate-900 dark:text-white block truncate">
                                {chain.journal_entry_ref || 'Lançamento Automático'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* 2. Nota Contabilística se for Ativo Imobilizado (CAPEX) */}
                        {chain.is_capex && (
                          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex items-start gap-3">
                            <Info className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-purple-900 dark:text-purple-200">
                              <strong>Princípio Contabilístico de Ativos Fixos (Decreto PGC):</strong> A aquisição de{' '}
                              <b>{chain.total_units ? `${num(chain.total_units)} ${chain.unit_measure || 'unidades'}` : 'equipamentos'}</b> no valor total de{' '}
                              <b><KzAmount value={num(chain.total_document_amount)} /></b> foi reconhecida na <b>Conta 11.5 (Ativo Imobilizado)</b>.
                              Este valor <u>não é lançado como despesa integral imediata</u> dos departamentos no momento da compra, protegendo o orçamento mensal (OPEX).
                              O impacto operacional mensal corresponde à quota de depreciação de <b><KzAmount value={num(chain.total_monthly_depreciation)} />/mês</b> ao longo de <b>{chain.useful_life_months || 48} meses</b> (Conta 73.1).
                            </div>
                          </div>
                        )}

                        {/* 3. Tabela de Atribuição aos Departamentos, Equipamentos Físicos e Responsáveis */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              Distribuição por Departamentos, Equipamentos Entregues &amp; Responsáveis
                            </span>
                            <span className="text-slate-400">
                              Critério: <b>{chain.allocation_criterion || 'Atribuição Direta'}</b>
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <table className="w-full text-left text-xs border-separate border-spacing-0">
                              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-bold">
                                <tr>
                                  <th className="p-2.5">Centro de Custos &amp; Departamento</th>
                                  <th className="p-2.5">Equipamentos Entregues</th>
                                  <th className="p-2.5">Etiquetas Patrimoniais / N.º Série</th>
                                  <th className="p-2.5">Responsável pelo Recebimento</th>
                                  <th className="p-2.5 text-right">Quota / Valor Atribuído</th>
                                  <th className="p-2.5 text-right">Amortização Mensal</th>
                                  <th className="p-2.5 text-center">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {chain.splits.map((split) => (
                                  <tr key={split.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                                    <td className="p-2.5">
                                      <div className="font-bold text-slate-900 dark:text-white">
                                        {split.cost_center_code} — {split.cost_center_name}
                                      </div>
                                      <div className="text-[11px] text-slate-400">{split.branch_name}</div>
                                    </td>
                                    <td className="p-2.5 font-medium">
                                      {split.allocated_units ? (
                                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                                          <Package className="w-3.5 h-3.5 text-blue-500" />
                                          {num(split.allocated_units)} {chain.unit_measure || 'unid.'}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="p-2.5">
                                      {split.asset_tags ? (
                                        <div className="inline-flex items-center gap-1 font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded text-[11px]">
                                          <Tag className="w-3 h-3" />
                                          {split.asset_tags}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="p-2.5">
                                      {split.recipient_responsible ? (
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1">
                                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                          {split.recipient_responsible}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">—</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-right">
                                      <div className="font-mono font-black text-slate-900 dark:text-white">
                                        <KzAmount value={num(split.allocated_amount)} />
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-bold">
                                        {num(split.percentage).toFixed(0)}% da compra
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                                      {num(split.monthly_depreciation) > 0 ? (
                                        <KzAmount value={num(split.monthly_depreciation)} />
                                      ) : (
                                        <span className="text-slate-400 text-xs">—</span>
                                      )}
                                    </td>
                                    <td className="p-2.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() => openReclassifyModal(split)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition border border-indigo-200 dark:border-indigo-800"
                                      >
                                        <ArrowRightLeft className="w-3 h-3" />
                                        Transferir
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* HISTÓRICO DE RECLASSIFICAÇÕES E TRANSFERÊNCIAS ENTRE CENTROS */}
          {dashboard.reclassifications && dashboard.reclassifications.length > 0 && (
            <GlassCard className="p-5 space-y-3 border-l-4 border-l-indigo-600">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Histórico Auditável de Transferências &amp; Reclassificações entre Centros
                  </h3>
                </div>
                <span className="text-xs text-slate-400">
                  {dashboard.reclassifications.length} movimentação(ões) registada(s)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-bold">
                    <tr>
                      <th className="p-2.5">Data / Hora</th>
                      <th className="p-2.5">Documento</th>
                      <th className="p-2.5">Origem → Destino</th>
                      <th className="p-2.5">Unidades &amp; Tags Movimentadas</th>
                      <th className="p-2.5 text-right">Valor Transferido</th>
                      <th className="p-2.5">Motivo &amp; Responsável</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dashboard.reclassifications.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono text-slate-500">
                          {new Date(rec.created_at).toLocaleString('pt-AO')}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {rec.source_document_ref}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1 font-bold">
                            <span className="text-rose-600">{rec.from_cost_center_code}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-emerald-600">{rec.to_cost_center_code}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {rec.from_cost_center_name} → {rec.to_cost_center_name}
                          </div>
                        </td>
                        <td className="p-2.5">
                          {rec.transferred_units && (
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              {num(rec.transferred_units)} unid.
                            </span>
                          )}
                          {rec.asset_tags_moved && (
                            <span className="font-mono text-xs text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                              {rec.asset_tags_moved}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <KzAmount value={num(rec.transferred_amount)} />
                        </td>
                        <td className="p-2.5">
                          <p className="text-slate-700 dark:text-slate-300 italic">{rec.reason}</p>
                          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                            Autorizado por: {rec.performed_by}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* Tabela Rastreável de Documentos e Linhas de Distribuição */}
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Rastreabilidade de Documentos e Linhas de Distribuição Analítica
                </h3>
                <p className="text-xs text-slate-500">
                  Drill-down desde o centro de custos até à fatura original sem duplicar despesas
                </p>
              </div>
              <select
                value={selectedCenterFilter}
                onChange={(e) => setSelectedCenterFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
              >
                <option value="ALL">Filtrar por Centro de Custos (Todos)</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="p-3">Data / Origem</th>
                    <th className="p-3">Documento Original</th>
                    <th className="p-3">Conta PGC</th>
                    <th className="p-3">Centro de Custos &amp; Filial</th>
                    <th className="p-3">Projeto / Viatura</th>
                    <th className="p-3 text-right">Quota (%)</th>
                    <th className="p-3 text-right">Valor Imputado</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAllocations.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="p-3">
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {a.allocation_date}
                        </div>
                        <span className="text-[10px] font-bold uppercase text-slate-400">
                          {a.source_module}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                          {a.source_document_ref}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Doc Total: <KzAmount value={num(a.total_document_amount)} />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {a.account_code} — {a.account_name}
                        </div>
                        <span
                          className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            a.is_capex
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {a.is_capex ? 'CAPEX (Ativo Classe 1)' : 'OPEX (Custo Classe 7)'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {a.cost_center_code} — {a.cost_center_name}
                        </div>
                        <div className="text-[11px] text-slate-500">{a.branch_name}</div>
                      </td>
                      <td className="p-3 text-[11px]">
                        {a.project_code && (
                          <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                            Projeto: {a.project_code}
                          </div>
                        )}
                        {a.vehicle_or_asset && (
                          <div className="text-slate-600 dark:text-slate-300">
                            Ativo/Viatura: {a.vehicle_or_asset}
                          </div>
                        )}
                        {!a.project_code && !a.vehicle_or_asset && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold">
                        {num(a.percentage).toFixed(1)}%
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">
                        <KzAmount value={num(a.allocated_amount)} />
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => openReclassifyModal(a)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition border border-indigo-200 dark:border-indigo-800"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          Transferir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* SUBTAB 4: ORÇAMENTO, COMPROMISSOS E DESVIOS (80%, 90%, 100%) */}
      {subTab === 'budgets' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCenters
              .filter((c) => c.center_type !== 'SHARED_SERVICE')
              .map((c) => {
                const budget = num(c.monthly_budget);
                const opex = num(c.realized_opex);
                const committed = num(c.committed_amount);
                const avail = num(c.available_budget);
                const utilPct = num(c.utilization_pct);
                const availPct = Math.max(0, 100 - utilPct);

                return (
                  <GlassCard key={c.id} className="p-5 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {c.code} · {c.branch_name}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.budget_status === 'EXCEDIDO_100'
                              ? 'bg-red-100 text-red-800'
                              : c.budget_status === 'CRITICO_90'
                              ? 'bg-orange-100 text-orange-800'
                              : c.budget_status === 'ALERTA_80'
                              ? 'bg-amber-100 text-amber-800'
                              : c.budget_status === 'SEM_ORCAMENTO'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.budget_status === 'EXCEDIDO_100'
                            ? 'Alerta > 100% (Excedido)'
                            : c.budget_status === 'CRITICO_90'
                            ? 'Alerta ≥ 90% (Crítico)'
                            : c.budget_status === 'ALERTA_80'
                            ? 'Alerta ≥ 80% Consumido'
                            : c.budget_status === 'SEM_ORCAMENTO'
                            ? 'Sem Orçamento Definido'
                            : 'Dentro do Orçamento'}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-slate-900 dark:text-white mt-1.5">
                        Centro de custos: {c.department_name || c.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Responsável: <b>{c.responsible_name || 'Não atribuído'}</b>
                      </p>

                      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-slate-500 block">Orçamento mensal</span>
                          <strong className="font-mono text-sm text-slate-900 dark:text-white">
                            <KzAmount value={budget} />
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Custos registados (OPEX)</span>
                          <strong className="font-mono text-sm text-blue-600 dark:text-blue-400">
                            <KzAmount value={opex} />
                          </strong>
                        </div>
                      </div>

                      {/* Barra de Consumo Orçamental */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-slate-700 dark:text-slate-300">
                            {utilPct.toFixed(0)}% utilizado
                          </span>
                          <span className="text-emerald-600">
                            {availPct.toFixed(0)}% disponível
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              utilPct >= 100
                                ? 'bg-red-600'
                                : utilPct >= 80
                                ? 'bg-amber-500'
                                : 'bg-emerald-600'
                            }`}
                            style={{ width: `${Math.min(100, utilPct)}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <div>
                          <span className="text-slate-500 block">Compromissos em curso</span>
                          <strong className="font-mono text-amber-600">
                            <KzAmount value={committed} />
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Saldo orçamental líquido</span>
                          <strong
                            className={`font-mono ${
                              avail >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            <KzAmount value={avail} />
                          </strong>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="w-full py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
                    >
                      Ajustar Orçamento / Compromissos
                    </button>
                  </GlassCard>
                );
              })}
          </div>
        </div>
      )}

      {/* SUBTAB 5: GOVERNAÇÃO, PROJETOS, VIATURAS E AUDITORIA (RELATÓRIOS 5 A 10) */}
      {subTab === 'governance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Relatórios 5 e 6: Custos por Projeto, Viatura ou Equipamento */}
            <GlassCard className="p-5 space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-indigo-600" />
                Custos por Projeto, Viatura ou Equipamento
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {dashboard.by_project_and_asset.map((item) => (
                  <div key={`${item.dimension_type}-${item.code}`} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.dimension_type === 'PROJETO' ? (
                        <FolderGit2 className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Truck className="w-4 h-4 text-amber-600" />
                      )}
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{item.code}</div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          {item.dimension_type} · {item.documents_count} doc(s)
                        </span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      {num(item.total_opex) > 0 && (
                        <div className="font-bold text-slate-900 dark:text-white">
                          OPEX: <KzAmount value={num(item.total_opex)} />
                        </div>
                      )}
                      {num(item.total_capex) > 0 && (
                        <div className="font-bold text-purple-600">
                          CAPEX: <KzAmount value={num(item.total_capex)} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Relatórios 7 e 8: Centros sem responsável/orçamento e Despesas sem centro */}
            <GlassCard className="p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Controlo de Governação: Centros sem Orçamento/Responsável &amp; Despesas sem Centro
              </h3>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                  Centros sem Responsável ou sem Orçamento Aprovado:
                </span>
                {centers
                  .filter(
                    (c) =>
                      c.parent_cost_center_id &&
                      (!c.responsible_name || num(c.monthly_budget) <= 0)
                  )
                  .map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <strong className="text-amber-900 dark:text-amber-200">
                          {c.code} — {c.name}
                        </strong>
                        <div className="text-[11px] text-amber-700 dark:text-amber-300">
                          Responsável: {c.responsible_name || 'NÃO DEFINIDO'} | Orçamento:{' '}
                          <KzAmount value={num(c.monthly_budget)} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditModal(c)}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold text-[11px]"
                      >
                        Regularizar
                      </button>
                    </div>
                  ))}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                  Despesas no Livro Diário sem Centro de Custos Atribuído ({dashboard.unassigned_expenses_count}):
                </span>
                {dashboard.unassigned_expenses.length === 0 ? (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    Todas as despesas operacionais possuem classificação analítica atribuída.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {dashboard.unassigned_expenses.slice(0, 6).map((u) => (
                      <div key={`${u.entry_id}-${u.account_code}`} className="py-2 flex justify-between">
                        <div>
                          <span className="font-mono font-bold text-blue-600">
                            #{u.entry_number} ({u.account_code})
                          </span>{' '}
                          — {u.description}
                        </div>
                        <span className="font-mono font-bold">
                          <KzAmount value={num(u.amount)} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          {/* Relatório 9: Histórico Auditável de Alterações de Classificação */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Histórico Auditável de Classificações, Regras e Orçamentos
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {dashboard.audit_logs.map((log) => (
                <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 mr-2">
                      {log.action}
                    </span>
                    <strong className="text-slate-900 dark:text-white">{log.entity_ref}:</strong>{' '}
                    <span className="text-slate-600 dark:text-slate-300">{log.details}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 whitespace-nowrap font-mono">
                    {log.performed_by} · {new Date(log.created_at).toLocaleString('pt-AO')}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* MODAL: CRIAR NOVO CENTRO DE CUSTOS */}
      {isCreateCenterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Novo Centro de Custos / Unidade Analítica
              </h3>
              <button onClick={() => setIsCreateCenterOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Código Único *</label>
                <input
                  type="text"
                  value={newCenterForm.code}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, code: e.target.value })}
                  placeholder="Ex: CC-TI-001"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Tipo de Unidade</label>
                <select
                  value={newCenterForm.center_type}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, center_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="COST_CENTER">Centro de Custos</option>
                  <option value="PROFIT_CENTER">Centro de Lucros</option>
                  <option value="PROJECT_UNIT">Unidade de Projeto</option>
                  <option value="SHARED_SERVICE">Unidade Agregadora</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="font-bold block mb-1">Nome do Centro de Custos *</label>
                <input
                  type="text"
                  value={newCenterForm.name}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, name: e.target.value })}
                  placeholder="Ex: Logística & Frota Regional Benguela"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Filial / Estabelecimento</label>
                <input
                  type="text"
                  value={newCenterForm.branch_name}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, branch_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Centro Superior (Hierarquia)</label>
                <select
                  value={newCenterForm.parent_cost_center_id || ''}
                  onChange={(e) =>
                    setNewCenterForm({
                      ...newCenterForm,
                      parent_cost_center_id: e.target.value || undefined,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="">Raiz (Sem Centro Superior)</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1">Departamento</label>
                <input
                  type="text"
                  value={newCenterForm.department_name}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, department_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Responsável Nomeado</label>
                <input
                  type="text"
                  value={newCenterForm.responsible_name}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, responsible_name: e.target.value })}
                  placeholder="Nome do gestor responsável"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Orçamento Mensal Autorizado (Kz)</label>
                <input
                  type="number"
                  value={newCenterForm.monthly_budget}
                  onChange={(e) =>
                    setNewCenterForm({
                      ...newCenterForm,
                      monthly_budget: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Início de Vigência</label>
                <input
                  type="date"
                  value={newCenterForm.valid_from}
                  onChange={(e) => setNewCenterForm({ ...newCenterForm, valid_from: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateCenterOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!newCenterForm.code || !newCenterForm.name || createCenterMutation.isPending}
                onClick={() =>
                  createCenterMutation.mutate({
                    ...newCenterForm,
                    parent_cost_center_id: newCenterForm.parent_cost_center_id || undefined,
                    valid_to: newCenterForm.valid_to || undefined,
                  })
                }
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {createCenterMutation.isPending ? 'A criar...' : 'Criar Centro de Custos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR CENTRO DE CUSTOS / ORÇAMENTO / COMPROMISSOS */}
      {editingCenter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Editar Centro: {editingCenter.code}
              </h3>
              <button onClick={() => setEditingCenter(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="font-bold block mb-1">Designação</label>
                <input
                  type="text"
                  value={editCenterForm.name}
                  onChange={(e) => setEditCenterForm({ ...editCenterForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Responsável</label>
                <input
                  type="text"
                  value={editCenterForm.responsible_name || ''}
                  onChange={(e) =>
                    setEditCenterForm({ ...editCenterForm, responsible_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Filial / Estabelecimento</label>
                <input
                  type="text"
                  value={editCenterForm.branch_name || ''}
                  onChange={(e) =>
                    setEditCenterForm({ ...editCenterForm, branch_name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Orçamento Mensal Aprovado (Kz)</label>
                <input
                  type="number"
                  value={editCenterForm.monthly_budget || 0}
                  onChange={(e) =>
                    setEditCenterForm({
                      ...editCenterForm,
                      monthly_budget: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Compromissos Assumidos (Kz)</label>
                <input
                  type="number"
                  value={editCenterForm.committed_amount || 0}
                  onChange={(e) =>
                    setEditCenterForm({
                      ...editCenterForm,
                      committed_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div className="col-span-2 flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cc_active_toggle"
                  checked={editCenterForm.is_active}
                  onChange={(e) =>
                    setEditCenterForm({ ...editCenterForm, is_active: e.target.checked })
                  }
                />
                <label htmlFor="cc_active_toggle" className="font-bold">
                  Centro de Custos Ativo (Se desativado, fica bloqueado para novos movimentos preservando histórico)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingCenter(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updateCenterMutation.isPending}
                onClick={() =>
                  updateCenterMutation.mutate({
                    id: editingCenter.id,
                    payload: editCenterForm,
                  })
                }
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
              >
                {updateCenterMutation.isPending ? 'A guardar...' : 'Guardar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DISTRIBUIR DESPESA / DOCUMENTO POR CENTROS DE CUSTOS */}
      {isAllocateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Imputação e Distribuição Analítica de Documento (Soma = 100%)
                </h3>
                <p className="text-xs text-slate-500">
                  Associe a fatura ou movimento a um ou vários centros de custos, projeto e viatura sem duplicar o documento original
                </p>
              </div>
              <button onClick={() => setIsAllocateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Módulo de Origem</label>
                <select
                  value={allocForm.source_module}
                  onChange={(e) => setAllocForm({ ...allocForm, source_module: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="COMPRAS">Compras &amp; Fornecedores</option>
                  <option value="TESOURARIA">Tesouraria &amp; Pagamentos</option>
                  <option value="RH">Recursos Humanos (Salários)</option>
                  <option value="INVENTARIO">Inventário &amp; Frota</option>
                  <option value="CONTABILIDADE">Contabilidade Geral</option>
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1">Ref. Documento Original *</label>
                <input
                  type="text"
                  value={allocForm.source_document_ref}
                  onChange={(e) =>
                    setAllocForm({ ...allocForm, source_document_ref: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Valor Total Documento (Kz) *</label>
                <input
                  type="number"
                  value={allocForm.total_amount}
                  onChange={(e) =>
                    setAllocForm({
                      ...allocForm,
                      total_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Conta Contabilística PGC</label>
                <input
                  type="text"
                  value={allocForm.account_code}
                  onChange={(e) => setAllocForm({ ...allocForm, account_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Designação da Conta PGC</label>
                <input
                  type="text"
                  value={allocForm.account_name}
                  onChange={(e) => setAllocForm({ ...allocForm, account_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Natureza (OPEX vs CAPEX)</label>
                <select
                  value={allocForm.is_capex ? 'CAPEX' : 'OPEX'}
                  onChange={(e) =>
                    setAllocForm({ ...allocForm, is_capex: e.target.value === 'CAPEX' })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                >
                  <option value="OPEX">Despesa Operacional (OPEX - Classe 7)</option>
                  <option value="CAPEX">Ativo Imobilizado (CAPEX - Classe 1)</option>
                </select>
              </div>

              <div>
                <label className="font-bold block mb-1">Aplicar Regra de Rateio Pré-definida</label>
                <select
                  value={allocForm.allocation_rule_id || ''}
                  onChange={(e) => applyRuleToAllocationForm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="">Distribuição Manual / Personalizada</option>
                  {dashboard.allocation_rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold block mb-1">Projeto Associado (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: PRJ-DATACENTER-26"
                  value={allocForm.project_code || ''}
                  onChange={(e) => setAllocForm({ ...allocForm, project_code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Viatura / Equipamento (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: LD-44-82-IA"
                  value={allocForm.vehicle_or_asset || ''}
                  onChange={(e) =>
                    setAllocForm({ ...allocForm, vehicle_or_asset: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Linhas de Distribuição */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                  Linhas de Distribuição por Centro de Custos
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const first = activeOperationalCenters[0];
                    if (!first) return;
                    setAllocForm({
                      ...allocForm,
                      lines: [
                        ...allocForm.lines,
                        { cost_center_id: first.id, percentage: Math.max(0, 100 - allocTotalPct) },
                      ],
                    });
                  }}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  + Adicionar Centro de Custos
                </button>
              </div>

              {allocForm.lines.map((line, idx) => {
                const lineVal = ((allocForm.total_amount || 0) * (line.percentage || 0)) / 100;
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <div className="col-span-6">
                      <select
                        value={line.cost_center_id}
                        onChange={(e) => {
                          const next = [...allocForm.lines];
                          next[idx] = { ...next[idx], cost_center_id: e.target.value };
                          setAllocForm({ ...allocForm, lines: next });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        {activeOperationalCenters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name} ({c.branch_name})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        value={line.percentage}
                        onChange={(e) => {
                          const next = [...allocForm.lines];
                          next[idx] = {
                            ...next[idx],
                            percentage: parseFloat(e.target.value) || 0,
                          };
                          setAllocForm({ ...allocForm, lines: next });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-right"
                      />
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold">
                      <KzAmount value={lineVal} />
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setAllocForm({
                            ...allocForm,
                            lines: allocForm.lines.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div
                className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold ${
                  Math.abs(allocTotalPct - 100) < 0.01
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                <span>
                  Validação de Soma Analítica:{' '}
                  {Math.abs(allocTotalPct - 100) < 0.01
                    ? '100,00% Validado'
                    : `Soma atual = ${allocTotalPct.toFixed(2)}% (Deve totalizar 100,00%)`}
                </span>
                <span className="font-mono">
                  Total Distribuído:{' '}
                  <KzAmount value={((allocForm.total_amount || 0) * allocTotalPct) / 100} />
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  Math.abs(allocTotalPct - 100) > 0.01 ||
                  allocForm.total_amount <= 0 ||
                  allocateExpenseMutation.isPending
                }
                onClick={() => allocateExpenseMutation.mutate(allocForm)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {allocateExpenseMutation.isPending
                  ? 'A registar distribuição...'
                  : 'Confirmar Imputação Analítica (100%)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA REGRA DE REPARTIÇÃO */}
      {isCreateRuleOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Nova Regra de Repartição de Custos Partilhados
              </h3>
              <button onClick={() => setIsCreateRuleOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Código da Regra *</label>
                <input
                  type="text"
                  value={newRuleForm.code}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Critério Mensurável de Base *</label>
                <select
                  value={newRuleForm.allocation_basis}
                  onChange={(e) =>
                    setNewRuleForm({ ...newRuleForm, allocation_basis: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="AREA_OCUPADA_M2">Área Ocupada (m²)</option>
                  <option value="CONSUMO_POTENCIA_E_AREA">Consumo / Potência Instalada</option>
                  <option value="NUM_COLABORADORES">Número de Colaboradores</option>
                  <option value="UTILIZACAO_EFETIVA">Utilização Efetiva Medida</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="font-bold block mb-1">Nome da Regra *</label>
                <input
                  type="text"
                  value={newRuleForm.name}
                  onChange={(e) => setNewRuleForm({ ...newRuleForm, name: e.target.value })}
                  placeholder="Ex: Repartição de Segurança e Limpeza Sede Luanda"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">Quotas por Centro de Custos (Total: {ruleTotalPct.toFixed(1)}%)</span>
                <button
                  type="button"
                  onClick={() => {
                    const first = activeOperationalCenters[0];
                    if (!first) return;
                    setNewRuleForm({
                      ...newRuleForm,
                      lines: [
                        ...newRuleForm.lines,
                        {
                          cost_center_id: first.id,
                          percentage: Math.max(0, 100 - ruleTotalPct),
                          justification: 'Critério técnico',
                        },
                      ],
                    });
                  }}
                  className="font-bold text-blue-600 hover:underline"
                >
                  + Adicionar Linha
                </button>
              </div>

              {newRuleForm.lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <select
                      value={l.cost_center_id}
                      onChange={(e) => {
                        const next = [...newRuleForm.lines];
                        next[idx] = { ...next[idx], cost_center_id: e.target.value };
                        setNewRuleForm({ ...newRuleForm, lines: next });
                      }}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    >
                      {activeOperationalCenters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={l.percentage}
                      onChange={(e) => {
                        const next = [...newRuleForm.lines];
                        next[idx] = {
                          ...next[idx],
                          percentage: parseFloat(e.target.value) || 0,
                        };
                        setNewRuleForm({ ...newRuleForm, lines: next });
                      }}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-right"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Justificação do critério..."
                      value={l.justification || ''}
                      onChange={(e) => {
                        const next = [...newRuleForm.lines];
                        next[idx] = { ...next[idx], justification: e.target.value };
                        setNewRuleForm({ ...newRuleForm, lines: next });
                      }}
                      className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setNewRuleForm({
                          ...newRuleForm,
                          lines: newRuleForm.lines.filter((_, i) => i !== idx),
                        })
                      }
                      className="text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreateRuleOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !newRuleForm.code ||
                  !newRuleForm.name ||
                  Math.abs(ruleTotalPct - 100) > 0.01 ||
                  createRuleMutation.isPending
                }
                onClick={() => createRuleMutation.mutate(newRuleForm)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50"
              >
                Guardar Regra (100%)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RECLASSIFICAÇÃO / TRANSFERÊNCIA INTERNA DE EQUIPAMENTO OU CUSTO */}
      {isReclassModalOpen && selectedAllocationForReclass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-xl max-h-[92vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Transferir / Reclassificar Equipamento ou Custo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Histórico auditável: transfere unidades e quotas entre centros com registo de motivo e responsáveis
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsReclassModalOpen(false);
                  setSelectedAllocationForReclass(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Caixa de Origem Atual */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Documento / Fatura:</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {selectedAllocationForReclass.source_document_ref}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Centro de Origem:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedAllocationForReclass.cost_center_code} — {selectedAllocationForReclass.cost_center_name} ({selectedAllocationForReclass.branch_name})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Unidades Disponíveis na Origem:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {num(selectedAllocationForReclass.allocated_units) || 1} {selectedAllocationForReclass.unit_measure || 'unid.'} · Valor Atual: <KzAmount value={num(selectedAllocationForReclass.allocated_amount)} />
                </span>
              </div>
              {selectedAllocationForReclass.asset_tags && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Etiquetas Atuais:</span>
                  <span className="font-mono font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded">
                    {selectedAllocationForReclass.asset_tags}
                  </span>
                </div>
              )}
              {selectedAllocationForReclass.recipient_responsible && (
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-500">Responsável Atual:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedAllocationForReclass.recipient_responsible}
                  </span>
                </div>
              )}
            </div>

            {/* Formulário de Transferência */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold block mb-1">Centro de Custos de Destino *</label>
                <select
                  value={reclassForm.to_cost_center_id}
                  onChange={(e) => setReclassForm({ ...reclassForm, to_cost_center_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-bold"
                >
                  <option value="">Selecione o Centro de Destino...</option>
                  {activeOperationalCenters
                    .filter((c) => c.id !== selectedAllocationForReclass.cost_center_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} ({c.branch_name})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">Unidades a Transferir</label>
                  <input
                    type="number"
                    min="1"
                    max={num(selectedAllocationForReclass.allocated_units) || 1}
                    value={reclassForm.transferred_units || 1}
                    onChange={(e) => {
                      const u = parseFloat(e.target.value) || 1;
                      const maxU = num(selectedAllocationForReclass.allocated_units) || 1;
                      const totalAmt = num(selectedAllocationForReclass.allocated_amount);
                      const unitAmt = maxU > 0 ? totalAmt / maxU : totalAmt;
                      setReclassForm({
                        ...reclassForm,
                        transferred_units: u,
                        transferred_amount: Math.min(totalAmt, u * unitAmt),
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold block mb-1">Valor a Transferir (Kz) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={reclassForm.transferred_amount}
                    onChange={(e) =>
                      setReclassForm({
                        ...reclassForm,
                        transferred_amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Etiquetas Patrimoniais / N.º de Série Movimentados
                </label>
                <input
                  type="text"
                  placeholder="Ex: PAT-TI-004"
                  value={reclassForm.asset_tags_moved || ''}
                  onChange={(e) =>
                    setReclassForm({ ...reclassForm, asset_tags_moved: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Identifica especificamente os computadores ou equipamentos físicos cedidos
                </span>
              </div>

              <div>
                <label className="font-bold block mb-1">
                  Justificação / Motivo da Transferência (Auditoria) *
                </label>
                <textarea
                  rows={2}
                  placeholder="Ex: Reafetação de 1 portátil para o novo colaborador da área comercial..."
                  value={reclassForm.reason}
                  onChange={(e) => setReclassForm({ ...reclassForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Responsável pela Transferência</label>
                <input
                  type="text"
                  value={reclassForm.performed_by || ''}
                  onChange={(e) =>
                    setReclassForm({ ...reclassForm, performed_by: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsReclassModalOpen(false);
                  setSelectedAllocationForReclass(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !reclassForm.to_cost_center_id ||
                  !reclassForm.reason.trim() ||
                  reclassForm.transferred_amount <= 0 ||
                  reclassifyMutation.isPending
                }
                onClick={() => reclassifyMutation.mutate(reclassForm)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {reclassifyMutation.isPending ? 'A Processar...' : 'Confirmar Transferência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
