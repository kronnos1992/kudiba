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
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge, StatusType } from '../../components/common/StatusBadge';
import { backofficeApi } from '../../api/backoffice';
import {
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

const emptyForm: CreateClientPayload = {
  company_name: '',
  nif: '',
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

  const { data: modules = [] } = useQuery({
    queryKey: ['backoffice_modules'],
    queryFn: () => backofficeApi.listModules(),
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
      setAdminForm({ email: '', full_name: '', password: '' });
      setCreateAdmin(false);
    },
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

  const canSubmitCreate = form.company_name.trim().length >= 2 && form.nif.trim().length >= 3 && form.modules.length > 0;

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
              placeholder="Pesquisar por nome, NIF ou e-mail…"
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

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">NIF</th>
                <th className="px-4 py-3">Módulos</th>
                <th className="px-4 py-3">Validade</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    A carregar clientes...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Nenhum cliente encontrado. Clique em "Novo Cliente" para registar um subscritor.
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const meta = statusMeta(client.license_status);
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
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
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {client.nif}
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
              <Field label="NIF" required>
                <input
                  required
                  value={form.nif}
                  onChange={(e) => setForm({ ...form, nif: e.target.value })}
                  className={inputClass}
                />
              </Field>
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
              <Field label="N.º de Utilizadores (seats)">
                <input
                  type="number"
                  min={1}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
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
          onClose={() => setDetailClient(null)}
          title={detail?.company_name || detailClient.company_name}
          icon={<Eye className="w-5 h-5 text-emerald-600" />}
          wide
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Info label="NIF" value={detail?.nif || detailClient.nif} />
              <Info label="Contacto" value={detail?.contact_name || '—'} />
              <Info label="E-mail" value={detail?.contact_email || '—'} />
              <Info label="Telefone" value={detail?.contact_phone || '—'} />
              <Info label="Plano" value={detail?.license?.plan || '—'} />
              <Info label="Seats" value={String(detail?.license?.seats ?? '—')} />
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
                <span>Software de Gestão Comercial Certificado conforme Decreto Presidencial n.º 71/25 (AGT/2026/0042)</span>
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
