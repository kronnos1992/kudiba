import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Users,
  Key,
  FileText,
  Download,
  PlusCircle,
  ShieldCheck,
  Search,
  X,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuthStore } from '../../stores/authStore';
import {
  authApi,
  TenantMember,
  InviteMemberPayload,
  RoleCatalogItem,
} from '../../api/auth';
import { invoicingApi } from '../../api/invoicing';
import { accountingApi } from '../../api/accounting';

type SettingsTab = 'organization' | 'users' | 'certification' | 'series' | 'saft';

export const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeTenant, activeBranch, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('organization');

  // Search & Modal States
  const [userSearch, setUserSearch] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedMemberForRoles, setSelectedMemberForRoles] = useState<TenantMember | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Invite Form
  const [inviteForm, setInviteForm] = useState<InviteMemberPayload>({
    email: '',
    full_name: '',
    roles: ['OPERADOR_CAIXA'],
    branch_id: activeBranch?.id || null,
    password: '',
  });

  // Series Form
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [seriesForm, setSeriesForm] = useState({
    code: '2026-A',
    fiscal_year: new Date().getFullYear(),
  });

  // Queries
  const { data: members = [], isLoading: isLoadingMembers } = useQuery({
    queryKey: ['auth_members'],
    queryFn: authApi.listMembers,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['auth_branches'],
    queryFn: authApi.listBranches,
  });

  const { data: rolesCatalog = [] } = useQuery({
    queryKey: ['auth_roles'],
    queryFn: authApi.listRoles,
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ['invoicing_series'],
    queryFn: invoicingApi.listSeries,
  });

  // Mutations
  const inviteMemberMutation = useMutation({
    mutationFn: authApi.inviteMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth_members'] });
      setIsInviteModalOpen(false);
      setInviteForm({
        email: '',
        full_name: '',
        roles: ['OPERADOR_CAIXA'],
        branch_id: activeBranch?.id || null,
        password: '',
      });
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      authApi.updateMemberRoles(userId, { roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth_members'] });
      setSelectedMemberForRoles(null);
    },
  });

  const createSeriesMutation = useMutation({
    mutationFn: invoicingApi.createSeries,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoicing_series'] });
      setIsSeriesModalOpen(false);
    },
  });

  // Download SAF-T Invoicing
  const handleDownloadSaftInvoicing = async () => {
    try {
      const year = new Date().getFullYear();
      const blob = await invoicingApi.exportSaftXml(`${year}-01-01`, `${year}-12-31`);
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

  // Download SAF-T Accounting
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

  const filteredMembers = members.filter((m) => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Configurações do Sistema &amp; Conformidade AGT
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Conforme Decreto 71/25
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestão da empresa, utilizadores &amp; RBAC, certificados fiscais RSA-2048, séries e auditoria SAF-T
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Certificado AGT: <span className="font-mono text-emerald-600">N.º 71/25-AGT</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('organization')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'organization'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Organização &amp; Filiais
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Users className="w-4 h-4" />
            Utilizadores &amp; RBAC ({members.length})
          </button>

          <button
            onClick={() => setActiveTab('certification')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'certification'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Key className="w-4 h-4" />
            Certificação AGT &amp; Chaves RSA
          </button>

          <button
            onClick={() => setActiveTab('series')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'series'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            Séries Fiscais ({seriesList.length})
          </button>

          <button
            onClick={() => setActiveTab('saft')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
              activeTab === 'saft'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Download className="w-4 h-4" />
            Auditoria &amp; SAF-T (AO)
          </button>
        </nav>
      </div>

      {/* TAB 1: ORGANIZAÇÃO & FILIAIS */}
      {activeTab === 'organization' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Dados Cadastrais da Empresa
                  </h3>
                  <p className="text-xs text-slate-500">
                    Informações oficiais constantes nos documentos emitidos e no ficheiro SAF-T AO
                  </p>
                </div>
                <StatusBadge status="ok" label="NIF Válido AGT" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Denominação Social
                  </label>
                  <div className="font-semibold text-slate-900 dark:text-white p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    {activeTenant?.name || 'Kudiba Comercial & Serviços Lda'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    NIF (Número de Identificação Fiscal)
                  </label>
                  <div className="font-mono font-bold text-slate-900 dark:text-white p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    {activeTenant?.taxId || '5001234567'}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Moeda Operacional
                  </label>
                  <div className="font-semibold text-slate-900 dark:text-white p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    Kwanza Angolano (AOA - Kz)
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    País de Tributação
                  </label>
                  <div className="font-semibold text-slate-900 dark:text-white p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    Angola (AO)
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                    Sede / Morada Fiscal
                  </label>
                  <div className="font-medium text-slate-900 dark:text-white p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    Avenida 4 de Fevereiro, Edifício Baía de Luanda, 7º Andar, Luanda, Angola
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Filiais Cadastradas */}
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Filiais &amp; Lojas Registadas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pontos de venda, armazéns centrais e balcões operacionais
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {branches.length > 0 ? (
                  branches.map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-mono font-bold text-xs flex items-center justify-center">
                          {b.code}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {b.name}
                          </h4>
                          <span className="text-xs text-slate-500">
                            {b.city || 'Luanda'} • Angola
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {b.id === activeBranch?.id ? 'FILIAL ATIVA' : 'CONECTADA'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 font-mono font-bold text-xs flex items-center justify-center">
                        SEDE
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Sede Principal - Luanda
                        </h4>
                        <span className="text-xs text-slate-500">Luanda • Angola</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      FILIAL ATIVA
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          <div className="space-y-6">
            <GlassCard className="p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Segurança &amp; Perímetro
              </h3>
              <p className="text-xs text-slate-500">
                Configurações ativas no API Gateway perimétrico (Rust + Axum + Redis)
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Algoritmo de Hash:</span>
                  <span className="font-mono font-bold">Argon2id (OWASP 2024)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Autenticação:</span>
                  <span className="font-mono font-bold">JWT HMAC-SHA256</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Rate Limiting:</span>
                  <span className="font-mono font-bold">600 req/min (Token Bucket)</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Idempotência Fiscais:</span>
                  <span className="font-mono font-bold text-emerald-600">Ativa (Redis Lock)</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Trilha de Auditoria:</span>
                  <span className="font-mono font-bold text-emerald-600">audit_events (PostgreSQL)</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* TAB 2: UTILIZADORES & RBAC */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome ou e-mail..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition"
            >
              <PlusCircle className="w-4 h-4" />
              Convidar Utilizador
            </button>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="p-3">Utilizador</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Papéis Atribuídos</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center w-28">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {isLoadingMembers ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        A carregar utilizadores...
                      </td>
                    </tr>
                  ) : filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Nenhum utilizador encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => (
                      <tr
                        key={m.user_id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-xs">
                            {m.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{m.full_name}</div>
                            {user?.id === m.user_id && (
                              <span className="text-[10px] text-blue-600 font-bold">
                                (A sua sessão)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                          {m.email}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {m.roles.map((r) => (
                              <span
                                key={r}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              m.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMemberForRoles(m);
                              setSelectedRoles([...m.roles]);
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            Papéis
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Catálogo de Papéis Card */}
          <GlassCard className="p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Catálogo de Papéis &amp; Permissões RBAC (Kudiba ERP)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesCatalog.map((rc: RoleCatalogItem) => (
                <div
                  key={rc.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {rc.name}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                      {rc.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{rc.description}</p>
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-wrap gap-1">
                    {rc.permissions.map((p) => (
                      <span
                        key={p}
                        className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 3: CERTIFICAÇÃO AGT & CHAVES RSA */}
      {activeTab === 'certification' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Par de Chaves Criptográficas RSA-2048
                </h3>
              </div>
              <StatusBadge status="ok" label="Assinatura Digital Ativa" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Conforme exigido pelo regime de certificação de programas de faturação da AGT em Angola, cada documento emitido (Facturas, Facturas-Recibo, Notas de Crédito) é assinado com chave privada RSA-2048 usando o algoritmo SHA1withRSA, gerando o hash de 172 caracteres.
            </p>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                <span className="font-bold block text-slate-900 dark:text-white mb-1">
                  Chave Pública Registada na AGT:
                </span>
                <p className="break-all font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0f9kudibaAGT2026rsa2048publickeyhash
                  5412345678AO...wIDAQAB
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Versão da Chave:</span>
                  <span className="font-bold text-slate-900 dark:text-white">Versão 1 (2026)</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 block text-[11px]">Algoritmo de Encadeamento:</span>
                  <span className="font-bold text-emerald-600">SHA1withRSA</span>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Regime de Contingência AGT
                </h3>
              </div>
              <StatusBadge status="ok" label="Dentro do Prazo Legal" />
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              O Decreto Presidencial n.º 71/25 estabelece que o sistema de faturação pode operar em modo de contingência offline por um período máximo contínuo de até 10 dias sem comunicação com os servidores centrais.
            </p>

            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Prazo Máximo Legal:
                </span>
                <span className="font-bold font-mono">10 Dias</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Dias em Contingência Decorridos:
                </span>
                <span className="font-bold font-mono text-emerald-600">0 Dias (Online)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300 font-semibold">
                  Estado do Canal AGT:
                </span>
                <span className="font-bold font-mono text-emerald-600">OPERACIONAL</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* TAB 4: SÉRIES FISCAIS */}
      {activeTab === 'series' && (
        <div className="space-y-4">
          <GlassCard className="p-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Séries de Documentos Fiscais (Exercício 2026)
              </h3>
              <p className="text-xs text-slate-500">
                Séries devidamente registadas para garantia de cronologia estrita e sem quebras de numeração
              </p>
            </div>
            <button
              onClick={() => setIsSeriesModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition"
            >
              <PlusCircle className="w-4 h-4" />
              Criar Nova Série
            </button>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <th className="p-3">Código da Série</th>
                    <th className="p-3">Ano Fiscal</th>
                    <th className="p-3">Sequenciador Atual</th>
                    <th className="p-3">Data de Ativação</th>
                    <th className="p-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {seriesList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        Nenhuma série fiscal registada.
                      </td>
                    </tr>
                  ) : (
                    seriesList.map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {s.seriesCode}
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          {s.fiscalYear}
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-900 dark:text-white">
                          #{s.currentSequence}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-xs">
                          {s.documentType || 'FT'}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              s.isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {s.isActive ? 'ATIVA' : 'ENCERRADA'}
                          </span>
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

      {/* TAB 5: AUDITORIA & SAF-T (AO) */}
      {activeTab === 'saft' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-sm">
                  XML
                </span>
                <StatusBadge status="ok" label="Conforme AGT" />
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
                Exportação do ficheiro anual de auditoria contabilística conforme as regras do PGC Angolano, contendo o plano de contas e todos os lançamentos do livro diário.
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
      )}

      {/* MODAL: CONVIDAR MEMBRO */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Convidar Novo Utilizador
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Ex.: Maria dos Santos"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  E-mail Profissional
                </label>
                <input
                  type="email"
                  placeholder="maria.santos@empresa.ao"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Palavra-passe Inicial (Mínimo 12 caracteres)
                </label>
                <input
                  type="password"
                  placeholder="PasswordForte2026!"
                  value={inviteForm.password || ''}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Papel no Sistema
                </label>
                <select
                  value={inviteForm.roles[0] || 'OPERADOR_CAIXA'}
                  onChange={(e) => setInviteForm({ ...inviteForm, roles: [e.target.value] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                >
                  <option value="OPERADOR_CAIXA">Operador de Caixa (POS)</option>
                  <option value="GESTOR_STOCK">Gestor de Stocks</option>
                  <option value="CONTABILISTA">Contabilista Certificado</option>
                  <option value="ADMIN">Administrador Geral</option>
                  <option value="AUDITOR">Auditor Fiscal</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  !inviteForm.email ||
                  !inviteForm.full_name ||
                  !inviteForm.password ||
                  (inviteForm.password && inviteForm.password.length < 12) ||
                  inviteMemberMutation.isPending
                }
                onClick={() => inviteMemberMutation.mutate(inviteForm)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {inviteMemberMutation.isPending ? 'A enviar...' : 'Criar Utilizador'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR PAPÉIS */}
      {selectedMemberForRoles && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Editar Papéis de Utilizador
                </h3>
                <span className="text-xs text-slate-500">{selectedMemberForRoles.full_name}</span>
              </div>
              <button
                onClick={() => setSelectedMemberForRoles(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {['ADMIN', 'CONTABILISTA', 'OPERADOR_CAIXA', 'GESTOR_STOCK', 'AUDITOR'].map(
                (role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRoles([...selectedRoles, role]);
                        } else {
                          setSelectedRoles(selectedRoles.filter((r) => r !== role));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {role}
                    </span>
                  </label>
                )
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedMemberForRoles(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={selectedRoles.length === 0 || updateRolesMutation.isPending}
                onClick={() =>
                  updateRolesMutation.mutate({
                    userId: selectedMemberForRoles.user_id,
                    roles: selectedRoles,
                  })
                }
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {updateRolesMutation.isPending ? 'A gravar...' : 'Gravar Papéis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVA SÉRIE FISCAL */}
      {isSeriesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Nova Série Fiscal (AGT)
              </h3>
              <button
                onClick={() => setIsSeriesModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Código da Série (Ex.: 2026-B)
                </label>
                <input
                  type="text"
                  placeholder="2026-B"
                  value={seriesForm.code}
                  onChange={(e) =>
                    setSeriesForm({ ...seriesForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Ano Fiscal
                </label>
                <input
                  type="number"
                  value={seriesForm.fiscal_year}
                  onChange={(e) =>
                    setSeriesForm({
                      ...seriesForm,
                      fiscal_year: parseInt(e.target.value) || 2026,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSeriesModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!seriesForm.code || createSeriesMutation.isPending}
                onClick={() =>
                  createSeriesMutation.mutate({
                    tenantId: activeTenant?.id || 'a0000000-0000-0000-0000-000000000001',
                    documentType: 'FT',
                    seriesCode: seriesForm.code,
                    fiscalYear: seriesForm.fiscal_year,
                  })
                }
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition"
              >
                {createSeriesMutation.isPending ? 'A criar...' : 'Ativar Série'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
