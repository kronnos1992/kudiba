import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ShieldCheck,
  History,
  Download,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileText,
  Building2,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Eye,
  ShieldAlert,
  UserCheck,
  UserX,
  Shield,
  Trash2,
  Laptop,
  Users,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import { invoicingApi } from '../../api/invoicing';
import { accountingApi } from '../../api/accounting';
import { useAuthStore } from '../../stores/authStore';
import { authApi, TenantMember } from '../../api/auth';

interface AuditAndActivitiesTabProps {
  members?: TenantMember[];
}

export const AuditAndActivitiesTab: React.FC<AuditAndActivitiesTabProps> = ({ members = [] }) => {
  const { activeTenant } = useAuthStore();

  const [auditSubTab, setAuditSubTab] = useState<'system' | 'fiscal' | 'security' | 'saft'>('system');
  const [systemModuleFilter, setSystemModuleFilter] = useState<string>('ALL');
  const [fiscalActionFilter, setFiscalActionFilter] = useState<'ALL' | 'INSERT' | 'TAMPER'>('ALL');
  const [authActionFilter, setAuthActionFilter] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');
  const [expandedSystemAuditId, setExpandedSystemAuditId] = useState<string | null>(null);
  const [expandedFiscalAuditId, setExpandedFiscalAuditId] = useState<string | null>(null);
  const [expandedAuthLogId, setExpandedAuthLogId] = useState<string | null>(null);

  const {
    data: systemAuditData,
    isLoading: isSystemAuditLoading,
    refetch: refetchSystemAudit,
  } = useQuery({
    queryKey: ['system_audit_trail', activeTenant?.id, systemModuleFilter, auditSearch],
    queryFn: () =>
      invoicingApi.getSystemAuditTrail({
        tenantId: activeTenant?.id,
        module: systemModuleFilter,
        search: auditSearch,
        limit: 150,
      }),
    enabled: Boolean(activeTenant?.id),
    refetchInterval: 3000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const {
    data: fiscalAuditData,
    isLoading: isFiscalAuditLoading,
    refetch: refetchFiscalAudit,
  } = useQuery({
    queryKey: ['fiscal_audit_trail', activeTenant?.id],
    queryFn: () => invoicingApi.getFiscalAuditTrail({ tenantId: activeTenant?.id, limit: 150 }),
    enabled: Boolean(activeTenant?.id),
    refetchInterval: 3000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const {
    data: authAuditData,
    isLoading: isAuthAuditLoading,
    refetch: refetchAuthAudit,
  } = useQuery({
    queryKey: ['auth_audit_logs', activeTenant?.id],
    queryFn: () => authApi.getAuditLogs({ limit: 150 }),
    enabled: Boolean(activeTenant?.id),
    refetchInterval: 4000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const fiscalAuditItems = useMemo(() => {
    const list = fiscalAuditData?.items || [];
    return list.filter((item) => {
      if (fiscalActionFilter === 'INSERT' && item.action !== 'INSERT') return false;
      if (fiscalActionFilter === 'TAMPER' && !item.action.startsWith('ATTEMPTED_')) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const refMatch = item.document_reference?.toLowerCase().includes(q);
        const actorMatch = item.actor_user_id?.toLowerCase().includes(q);
        const ipMatch = item.ip_address?.toLowerCase().includes(q);
        return Boolean(refMatch || actorMatch || ipMatch);
      }
      return true;
    });
  }, [fiscalAuditData, fiscalActionFilter, auditSearch]);

  const membersMap = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const authAuditItems = useMemo(() => {
    const list = authAuditData?.items || [];
    return list.filter((item) => {
      if (authActionFilter === 'MEMBERS_ROLES') {
        const isMemberOrRole =
          item.action.startsWith('MEMBER_') ||
          item.action.startsWith('ROLE_') ||
          item.action === 'USER_INVITED' ||
          item.action === 'ROLES_UPDATED';
        if (!isMemberOrRole) return false;
      } else if (authActionFilter !== 'ALL' && item.action !== authActionFilter) {
        return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const emailMatch = item.email_attempted?.toLowerCase().includes(q);
        const ipMatch = item.ip_address?.toLowerCase().includes(q);
        const agentMatch = item.user_agent?.toLowerCase().includes(q);
        const member = item.user_id ? membersMap.get(item.user_id) : undefined;
        const nameMatch = member?.full_name?.toLowerCase().includes(q);
        return Boolean(emailMatch || ipMatch || agentMatch || nameMatch);
      }
      return true;
    });
  }, [authAuditData, authActionFilter, auditSearch, membersMap]);

  const { sortedItems: sortedFiscalAudit, sortConfig: fiscalAuditSort, requestSort: requestFiscalAuditSort } =
    useTableSort(fiscalAuditItems, 'created_at', 'desc');
  const { sortedItems: sortedAuthAudit, sortConfig: authAuditSort, requestSort: requestAuthAuditSort } =
    useTableSort(authAuditItems, 'created_at', 'desc');

  const handleDownloadSaftInvoicing = async () => {
    try {
      const year = new Date().getFullYear();
      if (!activeTenant?.id) {
        throw new Error('Empresa activa não identificada.');
      }
      const blob = await invoicingApi.exportSaftXml({ tenantId: activeTenant.id, year });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SAFT_AO_Invoicing_${year}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Falha ao exportar SAF-T de faturação', err);
    }
  };

  const handleDownloadSaftAccounting = async () => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAuditSubTab('system')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              auditSubTab === 'system'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Actividades no Sistema
          </button>
          <button
            type="button"
            onClick={() => setAuditSubTab('fiscal')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              auditSubTab === 'fiscal'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Trilha Fiscal ({fiscalAuditData?.total ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setAuditSubTab('security')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              auditSubTab === 'security'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Acessos &amp; Segurança ({authAuditData?.total ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setAuditSubTab('saft')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              auditSubTab === 'saft'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Ficheiros SAF-T (AO)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            Apenas Administradores
          </span>
        </div>
      </div>

      {/* SUB-TAB 0: ACTIVIDADES NO SISTEMA */}
      {auditSubTab === 'system' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Total de Actividades</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {systemAuditData?.total ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Tesouraria &amp; Caixa</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {(systemAuditData?.items || []).filter((i) => i.module === 'TESOURARIA').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Facturação &amp; Vendas</div>
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                  {(systemAuditData?.items || []).filter((i) => i.module === 'FATURACAO').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Contabilidade &amp; RH</div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {(systemAuditData?.items || []).filter((i) => ['CONTABILIDADE', 'RH_PAYROLL'].includes(i.module)).length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
            </GlassCard>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'ALL', label: 'Todos os Módulos' },
                { key: 'TESOURARIA', label: 'Tesouraria' },
                { key: 'FATURACAO', label: 'Facturação' },
                { key: 'CONTABILIDADE', label: 'Contabilidade' },
                { key: 'INVENTARIO', label: 'Stock' },
                { key: 'RH_PAYROLL', label: 'Salários/RH' },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSystemModuleFilter(m.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    systemModuleFilter === m.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar documento, ação, operador..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-64 text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => refetchSystemAudit()}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Actualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md uppercase font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr>
                    <th className="w-8 px-3 py-3"></th>
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Módulo</th>
                    <th className="px-4 py-3">Actividade / Operação</th>
                    <th className="px-4 py-3">Documento Ref</th>
                    <th className="px-4 py-3">Operador / Entidade</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {isSystemAuditLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        A carregar actividades no sistema...
                      </td>
                    </tr>
                  ) : (systemAuditData?.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        Nenhuma actividade registada com os filtros actuais.
                      </td>
                    </tr>
                  ) : (
                    (systemAuditData?.items || []).map((item) => {
                      const isExpanded = expandedSystemAuditId === item.id;
                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            onClick={() =>
                              setExpandedSystemAuditId(isExpanded ? null : item.id)
                            }
                            className={`cursor-pointer transition-colors ${
                              isExpanded
                                ? 'bg-blue-50/40 dark:bg-blue-950/20'
                                : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="px-3 py-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600 inline" />
                              ) : (
                                <ChevronRight className="w-4 h-4 inline" />
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                              {new Date(item.created_at).toLocaleString('pt-AO')}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  item.module === 'TESOURARIA'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : item.module === 'FATURACAO'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                    : item.module === 'CONTABILIDADE'
                                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                    : item.module === 'INVENTARIO'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                }`}
                              >
                                {item.module}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                              {item.action}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-200">
                              {item.document_reference || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                              {item.actor_name || item.actor_user_id || 'Sistema'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSystemAuditId(isExpanded ? null : item.id);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                              >
                                {isExpanded ? 'Ocultar' : 'Detalhes'}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800">
                              <td colSpan={7} className="px-6 py-4">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                      Payload Auditável &amp; Metadados da Operação
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                                      <span>UUID: {item.id}</span>
                                      <span>Tipo Entidade: {item.entity_type}</span>
                                      <span>ID Entidade: {item.entity_id || '—'}</span>
                                    </div>
                                  </div>
                                  <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto max-h-60 border border-slate-800">
                                    {JSON.stringify(item.details, null, 2)}
                                  </pre>
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

      {/* SUB-TAB 1: TRILHA FISCAL AGT */}
      {auditSubTab === 'fiscal' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Total de Eventos Fiscais</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {fiscalAuditData?.total ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Emissões Legais (INSERT)</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {(fiscalAuditData?.items || []).filter((i) => i.action === 'INSERT').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Violações Bloqueadas (Trigger)</div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {(fiscalAuditData?.items || []).filter((i) => i.action.startsWith('ATTEMPTED_')).length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </GlassCard>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFiscalActionFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  fiscalActionFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Todos ({fiscalAuditData?.total ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setFiscalActionFilter('INSERT')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  fiscalActionFilter === 'INSERT'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Emissões
              </button>
              <button
                type="button"
                onClick={() => setFiscalActionFilter('TAMPER')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  fiscalActionFilter === 'TAMPER'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bloqueios de Adulteração
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar documento, utilizador, IP..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => refetchFiscalAudit()}
                disabled={isFiscalAuditLoading}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Actualizar dados de auditoria"
              >
                <RefreshCw className={`w-4 h-4 ${isFiscalAuditLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <SortableHeader field="created_at" currentSortField={fiscalAuditSort?.key} sortDirection={fiscalAuditSort?.direction} onSort={requestFiscalAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Data / Hora
                    </SortableHeader>
                    <SortableHeader field="action" currentSortField={fiscalAuditSort?.key} sortDirection={fiscalAuditSort?.direction} onSort={requestFiscalAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Ação Fiscal
                    </SortableHeader>
                    <SortableHeader field="document_reference" currentSortField={fiscalAuditSort?.key} sortDirection={fiscalAuditSort?.direction} onSort={requestFiscalAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Documento
                    </SortableHeader>
                    <SortableHeader field="actor_user_id" currentSortField={fiscalAuditSort?.key} sortDirection={fiscalAuditSort?.direction} onSort={requestFiscalAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Utilizador / Ator
                    </SortableHeader>
                    <SortableHeader field="ip_address" currentSortField={fiscalAuditSort?.key} sortDirection={fiscalAuditSort?.direction} onSort={requestFiscalAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Endereço IP
                    </SortableHeader>
                    <th className="sticky top-0 py-3 px-4 text-right bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                      Drill-down
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {isFiscalAuditLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        A carregar trilha fiscal de auditoria...
                      </td>
                    </tr>
                  ) : sortedFiscalAudit.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        Nenhum registo fiscal encontrado com os filtros actuais.
                      </td>
                    </tr>
                  ) : (
                    sortedFiscalAudit.map((item) => {
                      const isExpanded = expandedFiscalAuditId === item.audit_id;
                      const isTamper = item.action.startsWith('ATTEMPTED_');

                      return (
                        <React.Fragment key={item.audit_id}>
                          <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${isTamper ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''}`}>
                            <td className="py-3 px-4 font-mono whitespace-nowrap">
                              {new Date(item.created_at).toLocaleString('pt-AO')}
                            </td>
                            <td className="py-3 px-4">
                              {item.action === 'INSERT' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                                  <CheckCircle2 className="w-3 h-3" />
                                  EMISSÃO FISCAL
                                </span>
                              ) : isTamper ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/40">
                                  <ShieldAlert className="w-3 h-3" />
                                  BLOQUEIO: {item.action}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {item.action}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {item.document_reference || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              {item.actor_user_id || 'Sistema (Postgres Trigger)'}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 text-2xs">
                              {item.ip_address || 'Conexão Interna'}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedFiscalAuditId(isExpanded ? null : item.audit_id)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                                title="Ver Detalhes do Payload"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80">
                              <td colSpan={6} className="p-4">
                                <div className="bg-slate-950 text-slate-100 rounded-xl p-3 font-mono text-2xs space-y-2 max-h-72 overflow-y-auto border border-slate-800">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-slate-400">
                                    <span>Registo ID: {item.audit_id}</span>
                                    <span>Tabela: {item.table_name}</span>
                                  </div>
                                  <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400">
                                    {JSON.stringify(item.payload, null, 2)}
                                  </pre>
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

      {/* SUB-TAB 2: HISTÓRICO & LOGS DE UTILIZADORES */}
      {auditSubTab === 'security' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Total de Registos</div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {authAuditData?.total ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Logins com Sucesso</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {(authAuditData?.items || []).filter((i) => i.action === 'LOGIN_SUCCESS').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Falhas de Login</div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {(authAuditData?.items || []).filter((i) => i.action === 'LOGIN_FAILED').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">Bloqueios &amp; Alertas</div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {(authAuditData?.items || []).filter((i) => ['ACCOUNT_LOCKED', 'TOKEN_REUSE_DETECTED'].includes(i.action)).length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </GlassCard>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setAuthActionFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  authActionFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setAuthActionFilter('LOGIN_SUCCESS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  authActionFilter === 'LOGIN_SUCCESS'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Sucesso
              </button>
              <button
                type="button"
                onClick={() => setAuthActionFilter('LOGIN_FAILED')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  authActionFilter === 'LOGIN_FAILED'
                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Falhas
              </button>
              <button
                type="button"
                onClick={() => setAuthActionFilter('ACCOUNT_LOCKED')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  authActionFilter === 'ACCOUNT_LOCKED'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bloqueios
              </button>
              <button
                type="button"
                onClick={() => setAuthActionFilter('MEMBERS_ROLES')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  authActionFilter === 'MEMBERS_ROLES'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Membros &amp; Perfis
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar e-mail, IP, utilizador..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={() => refetchAuthAudit()}
                disabled={isAuthAuditLoading}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                title="Actualizar registos de acesso"
              >
                <RefreshCw className={`w-4 h-4 ${isAuthAuditLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-xs border-separate border-spacing-0">
                <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <SortableHeader field="created_at" currentSortField={authAuditSort?.key} sortDirection={authAuditSort?.direction} onSort={requestAuthAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Data / Hora
                    </SortableHeader>
                    <SortableHeader field="action" currentSortField={authAuditSort?.key} sortDirection={authAuditSort?.direction} onSort={requestAuthAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Ação / Evento
                    </SortableHeader>
                    <SortableHeader field="email_attempted" currentSortField={authAuditSort?.key} sortDirection={authAuditSort?.direction} onSort={requestAuthAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      E-mail / Utilizador
                    </SortableHeader>
                    <SortableHeader field="ip_address" currentSortField={authAuditSort?.key} sortDirection={authAuditSort?.direction} onSort={requestAuthAuditSort} className="py-3 px-4 border-b border-slate-200 dark:border-slate-800">
                      Endereço IP
                    </SortableHeader>
                    <th className="sticky top-0 py-3 px-4 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                      Navegador / Agente
                    </th>
                    <th className="sticky top-0 py-3 px-4 text-right bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                      Drill-down
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {isAuthAuditLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        A carregar histórico de acessos e segurança...
                      </td>
                    </tr>
                  ) : sortedAuthAudit.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        Nenhum registo de acesso encontrado com os filtros actuais.
                      </td>
                    </tr>
                  ) : (
                    sortedAuthAudit.map((item) => {
                      const isExpanded = expandedAuthLogId === item.id;

                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                            onClick={() => setExpandedAuthLogId(isExpanded ? null : item.id)}
                          >
                            <td className="py-3 px-4 font-mono whitespace-nowrap">
                              {new Date(item.created_at).toLocaleString('pt-AO')}
                            </td>
                            <td className="py-3 px-4">
                              {item.action === 'LOGIN_SUCCESS' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  LOGIN BEM-SUCEDIDO
                                </span>
                              ) : item.action === 'LOGIN_FAILED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  <AlertCircle className="w-3 h-3" />
                                  FALHA DE AUTENTICAÇÃO
                                </span>
                              ) : item.action === 'ACCOUNT_LOCKED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/40">
                                  <Lock className="w-3 h-3" />
                                  CONTA BLOQUEADA
                                </span>
                              ) : item.action === 'TOKEN_REUSE_DETECTED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/40">
                                  <ShieldAlert className="w-3 h-3" />
                                  TOKEN REUTILIZADO
                                </span>
                              ) : item.action === 'USER_INVITED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                  <Users className="w-3 h-3" />
                                  MEMBRO CONVIDADO
                                </span>
                              ) : item.action === 'MEMBER_SUSPENDED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40">
                                  <UserX className="w-3 h-3" />
                                  ACESSO SUSPENSO
                                </span>
                              ) : item.action === 'MEMBER_ACTIVATED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                                  <UserCheck className="w-3 h-3" />
                                  ACESSO REATIVADO
                                </span>
                              ) : item.action === 'MEMBER_REMOVED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/40">
                                  <UserX className="w-3 h-3" />
                                  MEMBRO REMOVIDO
                                </span>
                              ) : item.action === 'ROLES_UPDATED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300">
                                  <Shield className="w-3 h-3" />
                                  PAPÉIS DO UTILIZADOR
                                </span>
                              ) : item.action === 'ROLE_CREATED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  <ShieldCheck className="w-3 h-3" />
                                  PERFIL CRIADO
                                </span>
                              ) : item.action === 'ROLE_UPDATED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                                  <ShieldCheck className="w-3 h-3" />
                                  PERFIL EDITADO
                                </span>
                              ) : item.action === 'ROLE_PERMISSIONS_UPDATED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                  <Shield className="w-3 h-3" />
                                  PERMISSÕES SALVAS
                                </span>
                              ) : item.action === 'ROLE_PERMISSIONS_RESET' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                  <RefreshCw className="w-3 h-3" />
                                  PERMISSÕES REPOSTAS
                                </span>
                              ) : item.action === 'ROLE_DELETED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                  <Trash2 className="w-3 h-3" />
                                  PERFIL ELIMINADO
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {item.action}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                              {(() => {
                                const member = item.user_id ? membersMap.get(item.user_id) : undefined;
                                if (member) {
                                  return (
                                    <div>
                                      <div>{member.full_name}</div>
                                      <div className="text-2xs text-slate-400 font-mono">{member.email}</div>
                                    </div>
                                  );
                                }
                                if (item.email_attempted) {
                                  return <span>{item.email_attempted}</span>;
                                }
                                if (item.details?.role_id) {
                                  return <span className="font-mono text-blue-500">Perfil: {item.details.role_id}</span>;
                                }
                                if (item.user_id) {
                                  return <span className="font-mono text-2xs text-slate-500">{item.user_id}</span>;
                                }
                                return <span>N/A</span>;
                              })()}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500 text-2xs">
                              {item.ip_address || 'Desconhecido'}
                            </td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs truncate text-2xs" title={item.user_agent || ''}>
                              <span className="flex items-center gap-1">
                                <Laptop className="w-3 h-3 shrink-0 text-slate-400" />
                                <span className="truncate">{item.user_agent || 'Cliente HTTP'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedAuthLogId(isExpanded ? null : item.id)}
                                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white transition"
                                title="Ver Detalhes do Evento"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/80 dark:bg-slate-900/80">
                              <td colSpan={6} className="p-4">
                                <div className="bg-slate-950 text-slate-100 rounded-xl p-3 font-mono text-2xs space-y-2 max-h-72 overflow-y-auto border border-slate-800">
                                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-slate-400">
                                    <span>Registo ID: {item.id}</span>
                                    <span>Utilizador ID: {item.user_id || 'N/A'}</span>
                                  </div>
                                  <pre className="whitespace-pre-wrap leading-relaxed text-blue-400">
                                    {JSON.stringify(item.details, null, 2)}
                                  </pre>
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

      {/* SUB-TAB 3: FICHEIROS SAF-T (AO) */}
      {auditSubTab === 'saft' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard className="p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-sm">
                    XML
                  </span>
                  <StatusBadge status="ok" label="Conforme" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ficheiro SAF-T AO de Facturação Comercial
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Exportação do ficheiro mensal de auditoria contendo clientes, artigos, catálogo de taxas de IVA e todas as facturas assinadas com hash SHA1withRSA.
                </p>
              </div>
              <button
                onClick={handleDownloadSaftInvoicing}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar SAF-T Facturação (XML)
              </button>
            </GlassCard>

            <GlassCard className="p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-sm">
                    XML
                  </span>
                  <StatusBadge status="ok" label="Classes 1 a 8" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Ficheiro SAF-T AO de Contabilidade Geral
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Exportação do ficheiro anual de auditoria contabilística conforme as regras contabilísticas angolanas, contendo o plano de contas e todos os lançamentos do livro diário.
                </p>
              </div>
              <button
                onClick={handleDownloadSaftAccounting}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar SAF-T Contabilidade (XML)
              </button>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
};
