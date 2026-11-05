import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  PlusCircle,
  Search,
  RefreshCw,
  Ban,
  PlayCircle,
  Eye,
  X,
  ShieldCheck,
  CalendarClock,
  Layers,
  Award,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge, StatusType } from '../../components/common/StatusBadge';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { backofficeApi } from '../../api/backoffice';
import { validateCompanyNif } from '../../utils/validators';
import {
  AlvaraVerificationResult,
  BackofficeClient,
  CreateClientPayload,
  License,
  RenewLicensePayload,
} from '../../types/backoffice';

const STATUS_META: Record<string, { status: StatusType; label: string }> = {
  ACTIVE: { status: 'ok', label: 'Activa' },
  EXPIRED: { status: 'critico', label: 'Expirada' },
  SUSPENDED: { status: 'medio', label: 'Suspensa' },
  NONE: { status: 'acompanhar', label: 'Sem Licença' },
  CANCELLED: { status: 'acompanhar', label: 'Cancelada' },
};

const MODULE_CONFIG: Record<string, { label: string; short: string; color: string; border: string }> = {
  invoicing: {
    label: 'Facturação',
    short: 'Facturação',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
  },
  inventory: {
    label: 'Gestão de Stock',
    short: 'Stock',
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
  },
  treasury: {
    label: 'Tesouraria & Caixa',
    short: 'Tesouraria',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
  },
  payroll: {
    label: 'Recursos Humanos & Salários',
    short: 'Salários',
    color: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/60',
  },
  accounting: {
    label: 'Contabilidade',
    short: 'Contabilidade',
    color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
    border: 'border-indigo-200 dark:border-indigo-800/60',
  },
  integrations: {
    label: 'Hub de Integrações & ETL',
    short: 'Integrações',
    color: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
    border: 'border-teal-200 dark:border-teal-800/60',
  },
};

const PLAN_CONFIG: Record<string, { label: string; badge: string }> = {
  STANDARD: {
    label: 'STANDARD',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
  PROFESSIONAL: {
    label: 'PROFESSIONAL',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  ENTERPRISE: {
    label: 'ENTERPRISE',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
};

const getDaysRemaining = (validUntil?: string | null) => {
  if (!validUntil) return null;
  const target = new Date(validUntil).getTime();
  const now = new Date().getTime();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
};

const statusMeta = (value: string) => STATUS_META[value] || STATUS_META.NONE;

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('pt-AO') : '—';

const errorMessage = (error: unknown): string => {
  const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail || 'Ocorreu um erro ao processar o pedido.';
};

const defaultIssueDate = () => new Date().toISOString().slice(0, 10);
const defaultExpiryDate = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 5);
  return d.toISOString().slice(0, 10);
};

const SECTOR_CONFIG: Record<
  string,
  {
    label: string;
    shortLabel: string;
    regulator: string;
    legalReference: string;
    portalUrl: string;
    portalName: string;
    defaultTemplate: string;
    color: string;
    badge: string;
  }
> = {
  GERAL: {
    label: 'Sector Geral (Comércio, Indústria & Serviços)',
    shortLabel: 'Geral',
    regulator: 'MINFIN / AGT',
    legalReference: 'Decreto n.º 82/01 — Plano Geral de Contabilidade',
    portalUrl: 'https://portaldocontribuinte.minfin.gov.ao',
    portalName: 'Portal do Contribuinte AGT / MINFIN',
    defaultTemplate: 'PGC_GENERIC',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    badge: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  SEGUROS: {
    label: 'Sector Segurador & Fundos de Pensões',
    shortLabel: 'Seguros',
    regulator: 'ARSEG',
    legalReference: 'Norma Regulamentar n.º 01/26 e NR n.º 05/23 — PCESR',
    portalUrl: 'https://www.arseg.ao',
    portalName: 'Agência de Regulação e Supervisão de Seguros (ARSEG)',
    defaultTemplate: 'PCESR_01_26',
    color: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    badge: 'border-indigo-300 text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  BANCA: {
    label: 'Sector Bancário & Instituições Financeiras',
    shortLabel: 'Banca',
    regulator: 'BNA',
    legalReference: 'Aviso n.º 05/2019 e Instrutivo n.º 14/2019 (CONTIF / IFRS)',
    portalUrl: 'https://www.bna.ao',
    portalName: 'Banco Nacional de Angola (BNA)',
    defaultTemplate: 'PCIFB_14_2019',
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    badge: 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300',
  },
  PETROLEO: {
    label: 'Sector Petrolífero, Gás & Recursos Minerais',
    shortLabel: 'Petróleo & Minerais',
    regulator: 'MIREMPET / ANPG',
    legalReference: 'Lei n.º 13/04 de Tributação das Actividades Petrolíferas',
    portalUrl: 'https://www.mirempet.gov.ao',
    portalName: 'Ministério dos Recursos Minerais, Petróleo e Gás (MIREMPET)',
    defaultTemplate: 'PGC_PETROLEO',
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    badge: 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300',
  },
};

const emptyForm: CreateClientPayload = {
  company_name: '',
  nif: '',
  alvara_number: '',
  alvara_issue_date: defaultIssueDate(),
  alvara_expiry_date: defaultExpiryDate(),
  sector_code: 'GERAL',
  accounting_template_code: 'PGC_GENERIC',
  modules: [],
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
  plan: 'STANDARD',
  seats: 5,
};

export const ClientesView: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailClient, setDetailClient] = useState<BackofficeClient | null>(null);
  const [renewClient, setRenewClient] = useState<BackofficeClient | null>(null);
  const [certificateClient, setCertificateClient] = useState<BackofficeClient | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [createAdmin, setCreateAdmin] = useState(false);

  const [form, setForm] = useState<CreateClientPayload>(emptyForm);
  const [adminForm, setAdminForm] = useState({ email: '', full_name: '', password: '' });
  const [renewForm, setRenewForm] = useState<RenewLicensePayload>({});
  const [formAlvaraCheck, setFormAlvaraCheck] = useState<AlvaraVerificationResult | null>(null);
  const [detailAlvaraCheck, setDetailAlvaraCheck] = useState<AlvaraVerificationResult | null>(null);

  const { data: modules = [] } = useQuery({
    queryKey: ['backoffice_modules'],
    queryFn: () => backofficeApi.listModules(),
  });

  const { data: accountingTemplates = [] } = useQuery({
    queryKey: ['backoffice_accounting_templates'],
    queryFn: () => backofficeApi.listAccountingTemplates(),
  });

  const { data: summary } = useQuery({
    queryKey: ['backoffice_summary'],
    queryFn: () => backofficeApi.getSummary(),
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['backoffice_clients', search, statusFilter],
    queryFn: () =>
      backofficeApi.listClients({
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const { sortedItems: sortedClients, sortConfig: clientsSort, requestSort: requestClientsSort } = useTableSort(clients, 'company_name');

  const { data: detail } = useQuery({
    queryKey: ['backoffice_client', detailClient?.id],
    queryFn: () => backofficeApi.getClient(detailClient!.id),
    enabled: Boolean(detailClient?.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['backoffice_clients'] });
    queryClient.invalidateQueries({ queryKey: ['backoffice_client'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientPayload) => backofficeApi.createClient(payload),
    onSuccess: () => {
      invalidate();
      setShowCreateModal(false);
      setForm(emptyForm);
      setFormAlvaraCheck(null);
      setAdminForm({ email: '', full_name: '', password: '' });
      setCreateAdmin(false);
    },
  });

  const verifyFormAlvaraMutation = useMutation({
    mutationFn: () =>
      backofficeApi.verifyAlvara({
        alvara_number: form.alvara_number,
        nif: form.nif || null,
        alvara_issue_date: form.alvara_issue_date || null,
        alvara_expiry_date: form.alvara_expiry_date || null,
        probe_remote: true,
      }),
    onSuccess: (res) => {
      setFormAlvaraCheck(res);
      if (res.alvara_issue_date || res.alvara_expiry_date) {
        setForm((prev) => ({
          ...prev,
          alvara_issue_date: res.alvara_issue_date || prev.alvara_issue_date,
          alvara_expiry_date: res.alvara_expiry_date || prev.alvara_expiry_date,
        }));
      }
    },
  });

  const verifyClientAlvaraMutation = useMutation({
    mutationFn: (clientId: string) => backofficeApi.verifyClientAlvara(clientId, true),
    onSuccess: (res) => setDetailAlvaraCheck(res),
  });

  const renewMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RenewLicensePayload }) =>
      backofficeApi.renewLicense(id, payload),
    onSuccess: () => {
      invalidate();
      setRenewClient(null);
      setRenewForm({});
    },
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => backofficeApi.suspendClient(id),
    onSuccess: invalidate,
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => backofficeApi.activateClient(id),
    onSuccess: invalidate,
  });

  const toggleModule = (key: string) => {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(key)
        ? prev.modules.filter((m) => m !== key)
        : [...prev.modules, key],
    }));
  };

  const openRenew = (client: BackofficeClient) => {
    setRenewClient(client);
    setRenewForm({
      modules: client.license?.modules || [],
      plan: client.license?.plan || 'STANDARD',
      seats: client.license?.seats || 5,
      notes: '',
    });
  };

  const toggleRenewModule = (key: string) => {
    setRenewForm((prev) => {
      const current = prev.modules || [];
      return {
        ...prev,
        modules: current.includes(key) ? current.filter((m) => m !== key) : [...current, key],
      };
    });
  };

  const applyBundle = (bundle: 'FULL' | 'COMMERCIAL' | 'ACCOUNTING_HR') => {
    const allKeys = modules.map((m) => m.key);
    if (bundle === 'FULL') {
      setForm((prev) => ({ ...prev, modules: allKeys }));
    } else if (bundle === 'COMMERCIAL') {
      setForm((prev) => ({
        ...prev,
        modules: allKeys.filter((k) => ['invoicing', 'inventory', 'treasury'].includes(k)),
      }));
    } else if (bundle === 'ACCOUNTING_HR') {
      setForm((prev) => ({
        ...prev,
        modules: allKeys.filter((k) => ['payroll', 'accounting', 'invoicing'].includes(k)),
      }));
    }
  };

  const applyRenewBundle = (bundle: 'FULL' | 'COMMERCIAL' | 'ACCOUNTING_HR') => {
    const allKeys = modules.map((m) => m.key);
    if (bundle === 'FULL') {
      setRenewForm((prev) => ({ ...prev, modules: allKeys }));
    } else if (bundle === 'COMMERCIAL') {
      setRenewForm((prev) => ({
        ...prev,
        modules: allKeys.filter((k) => ['invoicing', 'inventory', 'treasury'].includes(k)),
      }));
    } else if (bundle === 'ACCOUNTING_HR') {
      setRenewForm((prev) => ({
        ...prev,
        modules: allKeys.filter((k) => ['payroll', 'accounting', 'invoicing'].includes(k)),
      }));
    }
  };

  const total = clients.length;
  const activeCount = clients.filter((c) => c.license_status === 'ACTIVE').length;
  const expiredCount = clients.filter((c) => c.license_status === 'EXPIRED').length;
  const suspendedCount = clients.filter((c) => c.license_status === 'SUSPENDED').length;

  const canSubmitCreate =
    form.company_name.trim().length >= 2 &&
    validateCompanyNif(form.nif).isValid &&
    form.alvara_number.trim().length >= 2 &&
    Boolean(
      form.alvara_issue_date &&
      form.alvara_expiry_date &&
      form.alvara_expiry_date > form.alvara_issue_date
    ) &&
    form.modules.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
            Clientes &amp; Licenças
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão de clientes subscritores, licenças anuais e módulos contratados
            {summary ? ` • ${summary.active_seats} utilizadores autorizados na plataforma` : ''}
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Total Clientes</span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-lg shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{total}</div>
          <span className="text-xs text-slate-400">Subscritores registados</span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Licenças Activas</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{activeCount}</div>
          <span className="text-xs text-emerald-600 font-medium">Dentro do prazo</span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Expiradas</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{expiredCount}</div>
          <span className="text-xs text-rose-600 font-medium">Requerem renovação</span>
        </GlassCard>

        <GlassCard className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase truncate">Suspensas</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg shrink-0">
              <Ban className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{suspendedCount}</div>
          <span className="text-xs text-amber-600 font-medium">Acesso bloqueado</span>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome, NIF, alvará ou e-mail…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="">Todos os estados</option>
            <option value="ACTIVE">Activa</option>
            <option value="EXPIRED">Expirada</option>
            <option value="SUSPENDED">Suspensa</option>
            <option value="NONE">Sem Licença</option>
          </select>
        </div>

        <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs text-xs text-slate-500 uppercase font-semibold">
              <tr>
                <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 w-10 text-center">
                  <span className="sr-only">Drill-down</span>
                </th>
                <SortableHeader field="company_name" currentSortField={clientsSort?.key} sortDirection={clientsSort?.direction} onSort={requestClientsSort} className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-800">
                  Empresa
                </SortableHeader>
                <SortableHeader field="nif" currentSortField={clientsSort?.key} sortDirection={clientsSort?.direction} onSort={requestClientsSort} className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-800">
                  NIF
                </SortableHeader>
                <th className="sticky top-0 py-2.5 px-4 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                  Módulos
                </th>
                <SortableHeader field="license.valid_until" currentSortField={clientsSort?.key} sortDirection={clientsSort?.direction} onSort={requestClientsSort} className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-800">
                  Validade
                </SortableHeader>
                <SortableHeader field="license_status" currentSortField={clientsSort?.key} sortDirection={clientsSort?.direction} onSort={requestClientsSort} align="center" className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-800">
                  Estado
                </SortableHeader>
                <th className="sticky top-0 py-2.5 px-4 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 text-center">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    A carregar clientes...
                  </td>
                </tr>
              ) : sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cliente encontrado. Clique em "Novo Cliente" para registar um subscritor.
                  </td>
                </tr>
              ) : (
                sortedClients.map((client) => {
                  const meta = statusMeta(client.license_status);
                  const isExpanded = expandedClientId === client.id;
                  return (
                    <React.Fragment key={client.id}>
                      <tr
                        className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                      >
                        <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setExpandedClientId(isExpanded ? null : client.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                            title="Expandir detalhes (Drill-down)"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 text-emerald-700 dark:text-emerald-300 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-500/30">
                            {client.company_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-slate-900 dark:text-white truncate">
                              {client.company_name}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              {client.contact_email ? (
                                <span className="truncate">{client.contact_email}</span>
                              ) : null}
                              {client.contact_phone ? (
                                <span className="text-[11px] text-slate-400">({client.contact_phone})</span>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                  SECTOR_CONFIG[client.sector_code || 'GERAL']?.color ||
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {SECTOR_CONFIG[client.sector_code || 'GERAL']?.regulator || client.sector_code || 'MINFIN / AGT'}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {client.accounting_template_code || 'PGC_GENERIC'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        <div>{client.nif}</div>
                        {client.alvara_number && (
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                            Alvará: {client.alvara_number}
                            {client.alvara_expiry_date ? (
                              <span
                                className={`ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                  client.alvara_status === 'EXPIRED'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                    : client.alvara_status === 'EXPIRING_SOON'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                }`}
                              >
                                Val: {formatDate(client.alvara_expiry_date)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                          {(client.license?.modules || []).map((m) => {
                            const cfg = MODULE_CONFIG[m] || {
                              label: m,
                              short: m,
                              color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                              border: 'border-slate-200 dark:border-slate-700',
                            };
                            return (
                              <span
                                key={m}
                                title={cfg.label}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${cfg.color} ${cfg.border}`}
                              >
                                {cfg.short}
                              </span>
                            );
                          })}
                          {(client.license?.modules || []).length === 0 && (
                            <span className="text-xs text-slate-400 italic">Nenhum módulo ativo</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        {client.license ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatDate(client.license.valid_until)}
                              </span>
                              {(() => {
                                const days = getDaysRemaining(client.license.valid_until);
                                if (days === null) return null;
                                if (days > 30) {
                                  return (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      {days}d restantes
                                    </span>
                                  );
                                }
                                if (days > 0) {
                                  return (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 animate-pulse">
                                      {days}d restantes
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    Expirada
                                  </span>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                                  PLAN_CONFIG[client.license.plan]?.badge ||
                                  'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {client.license.plan}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {client.license.seats} utilizador{client.license.seats > 1 ? 'es' : ''}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={meta.status} label={meta.label} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            title="Certificado Oficial de Licença"
                            onClick={() => setCertificateClient(client)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          >
                            <Award className="w-4 h-4" />
                          </button>
                          <button
                            title="Detalhe do Cliente"
                            onClick={() => setDetailClient(client)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Renovar licença"
                            onClick={() => openRenew(client)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {client.license_status === 'SUSPENDED' ? (
                            <button
                              title="Reactivar"
                              onClick={() => activateMutation.mutate(client.id)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            >
                              <PlayCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              title="Suspender"
                              onClick={() => suspendMutation.mutate(client.id)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                        <td colSpan={7} className="p-4">
                          <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                              <div>
                                <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Drill-down do Subscritor</span>
                                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  {client.company_name}
                                  <span className="text-xs font-mono font-bold text-emerald-600">NIF: {client.nif}</span>
                                  {client.alvara_number && (
                                    <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                                      • Alvará: {client.alvara_number}
                                    </span>
                                  )}
                                </h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDetailClient(client)}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Ver Ficha Completa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCertificateClient(client)}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-xs"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  Emitir Certificado
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <span className="text-2xs text-slate-400 font-bold block mb-1">Tenant ID (Kudiba Core)</span>
                                <span className="font-mono text-2xs text-slate-700 dark:text-slate-300 break-all select-all">{client.tenant_id}</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <span className="text-2xs text-slate-400 font-bold block mb-1">Chave da Licença (RSA Token)</span>
                                <span className="font-mono text-2xs text-slate-700 dark:text-slate-300 truncate block">
                                  {client.license?.license_key ? `${client.license.license_key.substring(0, 32)}...` : 'Sem chave emitida'}
                                </span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                <span className="text-2xs text-slate-400 font-bold block mb-1">Capacidade de Utilizadores</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  Até {client.license?.seats || 1} utilizadores em simultâneo
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

      {/* Modal: Novo Cliente */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Novo Cliente" icon={<Building2 className="w-5 h-5 text-emerald-600" />}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                ...form,
                admin_email: createAdmin ? adminForm.email : null,
                admin_full_name: createAdmin ? adminForm.full_name : null,
                admin_password: createAdmin ? adminForm.password : null,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Designação da Empresa" required>
                <input
                  required
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="NIF da Empresa (10 dígitos)" required>
                <input
                  required
                  placeholder="ex: 5417089123"
                  value={form.nif}
                  onChange={(e) => setForm({ ...form, nif: e.target.value.trim() })}
                  className={`${inputClass} font-mono font-bold transition-colors ${
                    form.nif.length > 0
                      ? validateCompanyNif(form.nif).isValid
                        ? 'border-emerald-500 focus:ring-emerald-500'
                        : 'border-rose-400 focus:ring-rose-500'
                      : ''
                  }`}
                />
                {form.nif.length > 0 && (
                  validateCompanyNif(form.nif).isValid ? (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium font-sans">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" /> NIF de empresa válido (10 dígitos)
                    </p>
                  ) : (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium font-sans">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {validateCompanyNif(form.nif).error}
                    </p>
                  )
                )}
              </Field>
              <Field label="Sector de Actividade Regulatório" required>
                <select
                  value={form.sector_code || 'GERAL'}
                  onChange={(e) => {
                    const sec = e.target.value;
                    const def = SECTOR_CONFIG[sec]?.defaultTemplate || 'PGC_GENERIC';
                    setForm({ ...form, sector_code: sec, accounting_template_code: def });
                  }}
                  className={inputClass}
                >
                  <option value="GERAL">Sector Geral (Comércio, Indústria & Serviços — MINFIN / AGT)</option>
                  <option value="SEGUROS">Sector Segurador & Resseguros (ARSEG)</option>
                  <option value="BANCA">Sector Bancário & Instituições Financeiras (BNA)</option>
                  <option value="PETROLEO">Sector Petrolífero, Gás & Minerais (MIREMPET / ANPG)</option>
                </select>
              </Field>

              <Field label="Plano Geral de Contas do Sector" required>
                <select
                  value={form.accounting_template_code || 'PGC_GENERIC'}
                  onChange={(e) => setForm({ ...form, accounting_template_code: e.target.value })}
                  className={inputClass}
                >
                  {(accountingTemplates.length > 0
                    ? accountingTemplates.filter((t) => !form.sector_code || t.sector_code === form.sector_code)
                    : [
                        { code: 'PGC_GENERIC', name: 'PGC Geral Angolano', regulator: 'MINFIN / AGT', sector_code: 'GERAL', account_count: 153 },
                        { code: 'PCESR_01_26', name: 'PCESR Segurador', regulator: 'ARSEG', sector_code: 'SEGUROS', account_count: 36 },
                        { code: 'PCIFB_14_2019', name: 'PCIFB Bancário IFRS', regulator: 'BNA', sector_code: 'BANCA', account_count: 27 },
                        { code: 'PGC_PETROLEO', name: 'PGC Actividades Petrolíferas', regulator: 'MIREMPET / ANPG', sector_code: 'PETROLEO', account_count: 31 },
                      ].filter((t) => !form.sector_code || t.sector_code === form.sector_code)
                  ).map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name} ({t.regulator || t.sector_code}) — {t.account_count ?? 0} contas
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {(() => {
              const secCfg = SECTOR_CONFIG[form.sector_code || 'GERAL'] || SECTOR_CONFIG.GERAL;
              const tpl = accountingTemplates.find((t) => t.code === form.accounting_template_code);
              return (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${secCfg.badge}`}>
                        {secCfg.regulator}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {tpl?.name || secCfg.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {tpl?.legal_reference || secCfg.legalReference}
                      {tpl?.account_count ? ` • ${tpl.account_count} contas prontas a provisionar no módulo de Contabilidade.` : ''}
                    </p>
                  </div>
                  <a
                    href={tpl?.portal_url || secCfg.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-[11px] font-semibold shrink-0"
                  >
                    <span>{secCfg.portalName}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  </a>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="N.º do Alvará Comercial" required>
                <input
                  required
                  placeholder="Ex: ALV-2026/00412"
                  value={form.alvara_number}
                  onChange={(e) => {
                    setForm({ ...form, alvara_number: e.target.value });
                    setFormAlvaraCheck(null);
                  }}
                  onBlur={() => {
                    if (form.alvara_number.trim().length >= 3 && !verifyFormAlvaraMutation.isPending) {
                      verifyFormAlvaraMutation.mutate();
                    }
                  }}
                  className={inputClass}
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Validação automática e auto-preenchimento das datas legais ao sair do campo.
                </p>
              </Field>
              <Field label="Data de Emissão do Alvará" required>
                <input
                  required
                  type="date"
                  value={form.alvara_issue_date}
                  onChange={(e) => {
                    setForm({ ...form, alvara_issue_date: e.target.value });
                    setFormAlvaraCheck(null);
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Data de Validade do Alvará" required>
                <input
                  required
                  type="date"
                  value={form.alvara_expiry_date}
                  onChange={(e) => {
                    setForm({ ...form, alvara_expiry_date: e.target.value });
                    setFormAlvaraCheck(null);
                  }}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Nome do Contacto">
                <input
                  value={form.contact_name || ''}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="E-mail do Contacto">
                <input
                  type="email"
                  value={form.contact_email || ''}
                  onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Telefone">
                <input
                  value={form.contact_phone || ''}
                  onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Plano">
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className={inputClass}
                >
                  <option value="STANDARD">STANDARD</option>
                  <option value="PROFESSIONAL">PROFESSIONAL</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="N.º de Utilizadores (seats)">
                <input
                  type="number"
                  min={1}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Observações Internas">
                <input
                  value={form.notes || ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notas comerciais, gestor de conta..."
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Verificação Oficial do Alvará Comercial
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Valide o prazo de vigência e consulte o alvará nas plataformas oficiais (SILAC/MINDCOM, GUE, SEPE e AGT)
                  </span>
                </div>
                <button
                  type="button"
                  disabled={form.alvara_number.trim().length < 2 || verifyFormAlvaraMutation.isPending}
                  onClick={() => verifyFormAlvaraMutation.mutate()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {verifyFormAlvaraMutation.isPending ? 'A verificar…' : 'Testar Validade do Alvará'}
                </button>
              </div>

              {formAlvaraCheck && <AlvaraVerificationCard result={formAlvaraCheck} />}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Módulos Subscritos
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyBundle('FULL')}
                    className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                  >
                    + Todos (Full ERP)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBundle('COMMERCIAL')}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    + Comercial
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBundle('ACCOUNTING_HR')}
                    className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold hover:bg-purple-100 cursor-pointer"
                  >
                    + RH &amp; Contabilidade
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {modules.map((mod) => (
                  <label
                    key={mod.key}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      form.modules.includes(mod.key)
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.modules.includes(mod.key)}
                      onChange={() => toggleModule(mod.key)}
                      className="mt-0.5 accent-emerald-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {mod.name}
                      </span>
                      <span className="block text-xs text-slate-500">{mod.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={createAdmin}
                onChange={(e) => setCreateAdmin(e.target.checked)}
                className="accent-emerald-600"
              />
              Criar conta de administrador para este cliente
            </label>

            {createAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <Field label="E-mail do Administrador" required>
                  <input
                    required
                    type="email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Nome Completo" required>
                  <input
                    required
                    value={adminForm.full_name}
                    onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Palavra-passe (mín. 12)" required>
                  <input
                    required
                    type="password"
                    minLength={12}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {createMutation.isError && <ErrorText text={errorMessage(createMutation.error)} />}

            <ModalActions
              onCancel={() => setShowCreateModal(false)}
              submitLabel="Criar Cliente"
              disabled={!canSubmitCreate || createMutation.isPending}
            />
          </form>
        </Modal>
      )}

      {/* Modal: Renovar Licença */}
      {renewClient && (
        <Modal
          onClose={() => setRenewClient(null)}
          title={`Renovar Licença — ${renewClient.company_name}`}
          icon={<RefreshCw className="w-5 h-5 text-emerald-600" />}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renewMutation.mutate({ id: renewClient.id, payload: renewForm });
            }}
            className="space-y-4"
          >
            <p className="text-sm text-slate-500">
              Será emitido um novo período anual a partir de {formatDate(renewClient.license?.valid_until)} (ou de hoje,
              se já expirado) e o acesso será reactivado.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Plano">
                <select
                  value={renewForm.plan}
                  onChange={(e) => setRenewForm({ ...renewForm, plan: e.target.value })}
                  className={inputClass}
                >
                  <option value="STANDARD">STANDARD</option>
                  <option value="PROFESSIONAL">PROFESSIONAL</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </Field>
              <Field label="N.º de Utilizadores (seats)">
                <input
                  type="number"
                  min={1}
                  value={renewForm.seats}
                  onChange={(e) => setRenewForm({ ...renewForm, seats: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Módulos Subscritos
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyRenewBundle('FULL')}
                    className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                  >
                    + Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRenewBundle('COMMERCIAL')}
                    className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold hover:bg-blue-100 cursor-pointer"
                  >
                    + Comercial
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRenewBundle('ACCOUNTING_HR')}
                    className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold hover:bg-purple-100 cursor-pointer"
                  >
                    + RH &amp; Contabilidade
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {modules.map((mod) => (
                  <label
                    key={mod.key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      (renewForm.modules || []).includes(mod.key)
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(renewForm.modules || []).includes(mod.key)}
                      onChange={() => toggleRenewModule(mod.key)}
                      className="accent-emerald-600"
                    />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{mod.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {renewMutation.isError && <ErrorText text={errorMessage(renewMutation.error)} />}

            <ModalActions
              onCancel={() => setRenewClient(null)}
              submitLabel="Renovar e Reactivar"
              disabled={renewMutation.isPending || (renewForm.modules || []).length === 0}
            />
          </form>
        </Modal>
      )}

      {/* Modal: Detalhe */}
      {detailClient && (
        <Modal
          onClose={() => {
            setDetailClient(null);
            setDetailAlvaraCheck(null);
          }}
          title={detail?.company_name || detailClient.company_name}
          icon={<Eye className="w-5 h-5 text-emerald-600" />}
          wide
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Info label="NIF" value={detail?.nif || detailClient.nif} />
              <Info label="N.º do Alvará" value={detail?.alvara_number || detailClient.alvara_number || '—'} />
              <Info label="Emissão do Alvará" value={formatDate(detail?.alvara_issue_date || detailClient.alvara_issue_date)} />
              <Info label="Validade do Alvará" value={formatDate(detail?.alvara_expiry_date || detailClient.alvara_expiry_date)} />
              <Info
                label="Sector Regulatório"
                value={
                  SECTOR_CONFIG[detail?.sector_code || detailClient.sector_code || 'GERAL']?.label ||
                  detail?.sector_code ||
                  detailClient.sector_code ||
                  'Geral'
                }
              />
              <Info
                label="Plano de Contas"
                value={detail?.accounting_template_code || detailClient.accounting_template_code || 'PGC_GENERIC'}
              />
              <Info label="Contacto" value={detail?.contact_name || '—'} />
              <Info label="E-mail" value={detail?.contact_email || '—'} />
              <Info label="Telefone" value={detail?.contact_phone || '—'} />
              <Info label="Plano / Seats" value={`${detail?.license?.plan || '—'} (${detail?.license?.seats ?? '—'})`} />
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Validação do Alvará Comercial nas Plataformas Oficiais
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Teste o estado de validade e aceda directamente ao SILAC/MINDCOM, Guiché Único (GUE), SEPE e Portal AGT
                  </span>
                </div>
                <button
                  type="button"
                  disabled={verifyClientAlvaraMutation.isPending}
                  onClick={() => verifyClientAlvaraMutation.mutate(detailClient.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {verifyClientAlvaraMutation.isPending ? 'A consultar plataformas…' : 'Testar Validade nas Plataformas Oficiais'}
                </button>
              </div>

              {detailAlvaraCheck && <AlvaraVerificationCard result={detailAlvaraCheck} />}
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Histórico de Licenças</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(detail?.license_history || detailClient.license_history || []).map((lic: License) => {
                  const meta = statusMeta(lic.expired ? 'EXPIRED' : lic.status);
                  return (
                    <div
                      key={lic.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800"
                    >
                      <div>
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {formatDate(lic.valid_from)} → {formatDate(lic.valid_until)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">{lic.license_key}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {lic.modules.map((m) => (
                            <span
                              key={m}
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <StatusBadge status={meta.status} label={meta.label} />
                    </div>
                  );
                })}
                {!(detail?.license_history || detailClient.license_history || []).length && (
                  <p className="text-sm text-slate-400">Sem histórico de licenças.</p>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Certificado Oficial de Licença */}
      {certificateClient && (
        <Modal
          onClose={() => setCertificateClient(null)}
          title="Certificado Oficial de Licença — Kudiba B2B"
          icon={<Award className="w-5 h-5 text-emerald-600" />}
          wide
        >
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white border border-emerald-500/40 shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-black text-xl">
                    {certificateClient.company_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-white">
                      {certificateClient.company_name}
                    </h3>
                    <p className="text-xs text-white/70 font-mono">
                      NIF: {certificateClient.nif}
                      {certificateClient.alvara_number ? ` • Alvará: ${certificateClient.alvara_number}` : ''}
                      {certificateClient.alvara_expiry_date ? ` (Val: ${formatDate(certificateClient.alvara_expiry_date)})` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Plano {certificateClient.license?.plan || 'STANDARD'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/90">
                    {certificateClient.license?.seats || 5} Utilizadores
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-5 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                    Chave de Ativação / Licença Criptográfica:
                  </span>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/15 rounded-xl p-2.5 font-mono text-[11px] text-emerald-300">
                    <span className="truncate flex-1">
                      {certificateClient.license?.license_key || 'KUDIBA-B2B-LIC-2026-ACTIVE'}
                    </span>
                    <button
                      type="button"
                      title="Copiar Chave"
                      onClick={() => {
                        const key = certificateClient.license?.license_key || 'KUDIBA-B2B-LIC-2026-ACTIVE';
                        navigator.clipboard.writeText(key);
                        setCopiedKey(key);
                        setTimeout(() => setCopiedKey(null), 2000);
                      }}
                      className="p-1 rounded bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-bold text-white/60 uppercase block mb-1">
                    Período de Validade:
                  </span>
                  <div className="bg-white/5 border border-white/15 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <span className="text-white/80">
                      Início: {formatDate(certificateClient.license?.valid_from || certificateClient.created_at)}
                    </span>
                    <span className="font-bold text-emerald-400">
                      Término: {formatDate(certificateClient.license?.valid_until)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-white/60 uppercase block mb-2">
                  Módulos Contratados &amp; Autorizados no Ecossistema:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(certificateClient.license?.modules || []).map((m) => {
                    const cfg = MODULE_CONFIG[m] || { label: m, short: m };
                    return (
                      <div
                        key={m}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 text-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-semibold text-white/90 truncate">{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 pt-4 mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-white/60">
                <span>Software de Gestão Comercial Certificado conforme Decreto Presidencial n.º 71/25 (FE/528/AGT/2026)</span>
                <span className="font-mono text-emerald-400 font-bold">Autenticado Kudiba Cloud B2B</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent';

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase mb-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
    {children}
  </label>
);

const Info: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="block text-[10px] font-semibold text-slate-400 uppercase">{label}</span>
    <span className="block text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);

const AlvaraVerificationCard: React.FC<{ result: AlvaraVerificationResult }> = ({ result }) => {
  const isOk = result.status === 'VALID';
  const isWarn = result.status === 'EXPIRING_SOON';
  const badgeColor = isOk
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
    : isWarn
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300';

  const statusLabel =
    result.status === 'VALID'
      ? 'ALVARÁ VÁLIDO'
      : result.status === 'EXPIRING_SOON'
      ? 'A EXPIRAR BREVEMENTE'
      : result.status === 'EXPIRED'
      ? 'ALVARÁ EXPIRADO'
      : 'DADOS INVÁLIDOS';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {result.valid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="font-bold text-slate-800 dark:text-slate-100">{result.message}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
          {statusLabel}
        </span>
      </div>

      {result.auto_filled && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300">
          <CalendarClock className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[11px] font-medium leading-tight">
            Datas de emissão e de validade preenchidas automaticamente de acordo aos dados obtidos na validação legal (vigência de 5 anos Decreto Presidencial n.º 191/18 / SILAC).
          </span>
        </div>
      )}

      {result.official_platforms && result.official_platforms.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5">
            Plataformas Oficiais de Consulta e Verificação (Angola):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.official_platforms.map((p) => (
              <a
                key={p.id}
                href={p.verification_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-slate-50/60 dark:bg-slate-800/40 transition-colors"
              >
                <div className="min-w-0">
                  <span className="block font-bold text-slate-800 dark:text-slate-100 truncate">
                    {p.name}
                  </span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {p.entity}
                    {p.reachable !== null && p.reachable !== undefined
                      ? ` • ${p.reachable ? `Online (${p.latency_ms ?? 0}ms)` : 'Consulta via Browser'}`
                      : ''}
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ErrorText: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
    {text}
  </p>
);

const ModalActions: React.FC<{ onCancel: () => void; submitLabel: string; disabled?: boolean }> = ({
  onCancel,
  submitLabel,
  disabled,
}) => (
  <div className="flex justify-end gap-2 pt-2">
    <button
      type="button"
      onClick={onCancel}
      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      Cancelar
    </button>
    <button
      type="submit"
      disabled={disabled}
      className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {submitLabel}
    </button>
  </div>
);

const Modal: React.FC<{
  title: string;
  icon?: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, onClose, wide, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
    <div
      className={`w-full ${wide ? 'max-w-3xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          {icon}
          {title}
        </h3>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);
