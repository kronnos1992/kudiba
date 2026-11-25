import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  ShieldAlert,
  PlusCircle,
  Pencil,
  KeyRound,
  Trash2,
  X,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import { SortableHeader } from '../../components/common/SortableHeader';
import { useTableSort } from '../../hooks/useTableSort';
import {
  authApi,
  RoleCatalogItem,
  PermissionCatalogItem,
  CreateRolePayload,
} from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';

export const CANONICAL_SYSTEM_PERMISSIONS: PermissionCatalogItem[] = [
  // Fiscal & Facturação
  { id: 'invoices:issue', module: 'fiscal', name: 'Emitir Facturas', description: 'Permissão para emitir facturas, facturas-recibo e outros documentos fiscais' },
  { id: 'invoices:read', module: 'fiscal', name: 'Consultar Facturas', description: 'Permissão para consultar documentos e imprimir vias' },
  { id: 'invoices:cancel', module: 'fiscal', name: 'Anular Facturas', description: 'Permissão para emitir Notas de Crédito de rectificação/anulação' },
  { id: 'fiscal:series:manage', module: 'fiscal', name: 'Gerir Séries Fiscais', description: 'Abertura e configuração de séries de facturação' },
  { id: 'fiscal:saft:export', module: 'fiscal', name: 'Exportar SAF-T (AO)', description: 'Geração e exportação do ficheiro oficial SAF-T' },
  { id: 'fiscal:reports:read', module: 'fiscal', name: 'Consultar Mapas Fiscais', description: 'Acesso aos relatórios de IVA, retenções e imposto de selo' },
  { id: 'customers:read', module: 'fiscal', name: 'Consultar Clientes', description: 'Consulta da lista de clientes, fichas comerciais e histórico de compras' },
  { id: 'customers:manage', module: 'fiscal', name: 'Gerir Clientes & NIF', description: 'Criação, actualização de dados cadastrais e validação do NIF de clientes' },
  { id: 'invoices:proforma', module: 'fiscal', name: 'Orçamentos & Facturas Proforma', description: 'Emissão, actualização e conversão de orçamentos e facturas proforma' },
  { id: 'invoices:transport', module: 'fiscal', name: 'Guias de Transporte & Remessa', description: 'Emissão de guias de transporte rodoviário e movimentação física de bens' },
  { id: 'invoices:receipts', module: 'fiscal', name: 'Recibos Autónomos de Quitação (RG)', description: 'Emissão de recibos de liquidação total ou parcial de facturas a crédito' },
  { id: 'invoices:debit_note', module: 'fiscal', name: 'Emitir Notas de Débito', description: 'Emissão de notas de débito para cobrança de acertos e despesas a clientes' },

  // Ponto de Venda (POS)
  { id: 'pos:sale', module: 'pos', name: 'Operar Ponto de Venda', description: 'Registo de vendas directas no caixa' },
  { id: 'pos:reading_x', module: 'pos', name: 'Efectuar Leitura X', description: 'Conferência intradiária de valores em caixa' },
  { id: 'pos:closing_z', module: 'pos', name: 'Efectuar Fecho Z', description: 'Fecho diário oficial e geração de memória fiscal' },
  { id: 'pos:cash_movements', module: 'pos', name: 'Sangrias & Suprimentos de Caixa', description: 'Registo de reforços e retiradas de valores na gaveta do operador de caixa' },
  { id: 'pos:discounts', module: 'pos', name: 'Aplicar Descontos Manuais', description: 'Aplicação de descontos comerciais em linha ou no total da venda no POS' },

  // Utilizadores & RBAC
  { id: 'users:read', module: 'auth', name: 'Listar Utilizadores', description: 'Visualização de utilizadores da organização' },
  { id: 'users:invite', module: 'auth', name: 'Convidar Utilizadores', description: 'Envio de convites e associação de utilizadores à empresa' },
  { id: 'users:manage_roles', module: 'auth', name: 'Gerir Papéis de Utilizadores', description: 'Atribuição e revogação de funções de utilizadores' },
  { id: 'audit:read', module: 'auth', name: 'Consultar Registos de Auditoria', description: 'Visualização da trilha de auditoria fiscal, eventos de autenticação e logs de segurança' },
  { id: 'tenant:settings:manage', module: 'core', name: 'Gerir Dados da Empresa', description: 'Actualização de dados fiscais e cadastrais da empresa' },

  // Inventário & Armazéns
  { id: 'inventory:read', module: 'inventory', name: 'Consultar Inventário', description: 'Consulta de produtos, existências por armazém e histórico de movimentos' },
  { id: 'inventory:manage', module: 'inventory', name: 'Gerir Produtos e Existências', description: 'Criação e actualização de produtos, unidades de medida e níveis mínimos de stock' },
  { id: 'inventory:transfer', module: 'inventory', name: 'Transferir Stock entre Armazéns', description: 'Criação e processamento de transferências de mercadorias entre armazéns' },
  { id: 'inventory:warehouses', module: 'inventory', name: 'Gerir Armazéns & Lojas', description: 'Parametrização de armazéns físicos, locais de guarda e centros de distribuição' },
  { id: 'inventory:adjust', module: 'inventory', name: 'Ajustes & Contagem de Stock', description: 'Registo de quebras, sobras, perdas e acertos pontuais de existências' },
  { id: 'inventory:suppliers', module: 'inventory', name: 'Fornecedores & Compras', description: 'Gestão do cadastro de fornecedores, encomendas de compra e preços acordados' },

  // Tesouraria & Caixa
  { id: 'treasury:read', module: 'treasury', name: 'Consultar Tesouraria & Caixas', description: 'Consulta de saldos de caixas, extractos de contas bancárias e posições financeiras' },
  { id: 'treasury:manage', module: 'treasury', name: 'Gerir Caixas & Contas Bancárias', description: 'Configuração de caixas físicos, contas bancárias da empresa e métodos de pagamento' },
  { id: 'treasury:movements', module: 'treasury', name: 'Movimentos de Caixa & Despesas', description: 'Lançamento de despesas correntes, entradas e saídas de caixa da tesouraria' },
  { id: 'treasury:transfers', module: 'treasury', name: 'Transferências entre Contas', description: 'Realização de transferências entre caixas e contas bancárias da empresa' },
  { id: 'treasury:reconcile', module: 'treasury', name: 'Reconciliação Bancária', description: 'Conferência de extractos bancários, cruzamento de saldos e reconciliação financeira' },

  // Recursos Humanos & Salários
  { id: 'payroll:manage', module: 'payroll', name: 'Gerir Colaboradores e Contratos', description: 'Registo, actualização e cessação de colaboradores, departamentos e contratos' },
  { id: 'payroll:view', module: 'payroll', name: 'Consultar Folha Salarial', description: 'Consulta de recibos, períodos e resumos de processamento salarial' },
  { id: 'payroll:calculate', module: 'payroll', name: 'Processar Salários', description: 'Cálculo da folha salarial do período (IRT e INSS)' },
  { id: 'payroll:approve', module: 'payroll', name: 'Aprovar e Encerrar Períodos', description: 'Aprovação e encerramento oficial do período salarial' },
  { id: 'payroll:export', module: 'payroll', name: 'Exportar Remessa Bancária', description: 'Geração do ficheiro PS2 de transferências em lote' },
  { id: 'payroll:hr', module: 'payroll', name: 'Gerir Férias e Assiduidade', description: 'Pedidos de férias, aprovações e registos de assiduidade' },

  // Contabilidade & PGC
  { id: 'accounting:read', module: 'accounting', name: 'Consultar Contabilidade & Razão', description: 'Consulta do plano de contas, diários, extractos de conta e balancetes' },
  { id: 'accounting:journal', module: 'accounting', name: 'Lançamentos Contabilísticos Manuais', description: 'Registo e estorno de lançamentos em partidas dobradas nos diários oficiais' },
  { id: 'accounting:chart', module: 'accounting', name: 'Gerir Plano Geral de Contas (PGC)', description: 'Criação e manutenção de contas e subcontas das classes 1 a 8 do PGC Angolano' },
  { id: 'accounting:vat_settlement', module: 'accounting', name: 'Apuramento Periódico de IVA', description: 'Cálculo, fecho e apuramento do IVA a pagar ou a recuperar perante a administração fiscal' },
  { id: 'accounting:reports', module: 'accounting', name: 'Balanço & Demonstração de Resultados', description: 'Geração do Balanço analítico, Balancete de Verificação e Demonstração de Resultados' },

  // Integrações & Biometria
  { id: 'integrations:read', module: 'integrations', name: 'Consultar Dispositivos & Presenças', description: 'Visualização de terminais biométricos conectados, webhooks e marcações de ponto' },
  { id: 'integrations:manage', module: 'integrations', name: 'Gerir Terminais & Mapeamentos', description: 'Parametrização de terminais biométricos e regras de sincronização' },
];

const normalizeModule = (module: string): string => {
  if (module === 'users' || module === 'auth') return 'auth';
  if (module === 'tenant' || module === 'core') return 'core';
  return module;
};

const MODULE_LABELS: Record<string, string> = {
  auth: 'Utilizadores & RBAC',
  users: 'Utilizadores & RBAC',
  core: 'Organização & Empresa',
  tenant: 'Organização & Empresa',
  fiscal: 'Fiscal & Facturação',
  pos: 'Ponto de Venda (POS)',
  inventory: 'Inventário & Armazéns',
  treasury: 'Tesouraria & Caixa',
  payroll: 'Recursos Humanos & Salários',
  accounting: 'Contabilidade & PGC',
  integrations: 'Integrações & Biometria',
};

const MODULE_ORDER = [
  'auth',
  'fiscal',
  'pos',
  'inventory',
  'treasury',
  'payroll',
  'accounting',
  'integrations',
  'core',
];

const RESERVED_ROLE_IDS = ['ADMIN', 'SYSADMIN', 'SUPER_ADMIN'];

const MODULE_COLORS: Record<string, string> = {
  auth: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  users: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  fiscal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pos: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  inventory: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  treasury: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  payroll: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  accounting: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  integrations: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  core: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  tenant: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const groupPermissionsByModule = (permissions: PermissionCatalogItem[]) => {
  const groups = new Map<string, PermissionCatalogItem[]>();
  const sorted = [...permissions].sort((a, b) => a.id.localeCompare(b.id));

  for (const p of sorted) {
    const mod = normalizeModule(p.module);
    const list = groups.get(mod) ?? [];
    list.push(p);
    groups.set(mod, list);
  }

  const orderedKeys = [
    ...MODULE_ORDER.filter((k) => groups.has(k)),
    ...[...groups.keys()].filter((k) => !MODULE_ORDER.includes(k)).sort(),
  ];

  return orderedKeys.map((module) => ({ module, items: groups.get(module)! }));
};

export const RolesManager: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, activeTenant } = useAuthStore();

  const actorRoles = (
    user?.roles?.length ? user.roles : activeTenant?.roles ?? []
  ).map((r) => r.toUpperCase());
  const isSystemManager = actorRoles.includes('SYSADMIN') || actorRoles.includes('SUPER_ADMIN');

  const [search, setSearch] = useState('');
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleCatalogItem | null>(null);
  const [form, setForm] = useState<CreateRolePayload>({ id: '', name: '', description: '', permissions: [] });
  const [formSearchPerm, setFormSearchPerm] = useState('');
  const [permissionsRole, setPermissionsRole] = useState<RoleCatalogItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [permModalSearch, setPermModalSearch] = useState('');
  const [roleToDelete, setRoleToDelete] = useState<RoleCatalogItem | null>(null);

  const { data: roles = [], isLoading: isLoadingRoles } = useQuery({
    queryKey: ['auth_roles'],
    queryFn: authApi.listRoles,
  });

  const {
    data: rawPermissions = [],
    isLoading: isLoadingPermissions,
    isError: isPermissionsError,
    refetch: refetchPermissions,
  } = useQuery({
    queryKey: ['auth_permissions'],
    queryFn: authApi.listPermissions,
  });

  const allPermissions: PermissionCatalogItem[] =
    rawPermissions && rawPermissions.length > 0 ? rawPermissions : CANONICAL_SYSTEM_PERMISSIONS;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['auth_roles'] });
    queryClient.invalidateQueries({ queryKey: ['auth_audit_logs'] });
  };

  const handleError = (err: any) =>
    toast.error(err?.response?.data?.detail || 'Operação falhou. Verifique as permissões.');

  const createMutation = useMutation({
    mutationFn: authApi.createRole,
    onSuccess: (role) => {
      invalidate();
      setIsFormModalOpen(false);
      setForm({ id: '', name: '', description: '', permissions: [] });
      toast.success(`Perfil "${role.name}" criado com sucesso!`);
    },
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      roleId,
      payload,
      permissions,
    }: {
      roleId: string;
      payload: { name: string; description?: string | null };
      permissions?: string[];
    }) => {
      const updated = await authApi.updateRole(roleId, payload);
      if (permissions !== undefined) {
        await authApi.updateRolePermissions(roleId, permissions);
      }
      return updated;
    },
    onSuccess: () => {
      invalidate();
      setIsFormModalOpen(false);
      setEditingRole(null);
      toast.success('Perfil actualizado com sucesso!');
    },
    onError: handleError,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: string[] }) =>
      authApi.updateRolePermissions(roleId, permissions),
    onSuccess: () => {
      invalidate();
      setPermissionsRole(null);
      toast.success('Permissões do perfil actualizadas!');
    },
    onError: handleError,
  });

  const resetPermissionsMutation = useMutation({
    mutationFn: (roleId: string) => authApi.resetRolePermissions(roleId),
    onSuccess: () => {
      invalidate();
      setPermissionsRole(null);
      toast.success('Permissões repostas nas predefinições do sistema!');
    },
    onError: handleError,
  });

  const deleteMutation = useMutation({
    mutationFn: authApi.deleteRole,
    onSuccess: () => {
      invalidate();
      setRoleToDelete(null);
      toast.success('Perfil eliminado com sucesso!');
    },
    onError: handleError,
  });

  const filteredRoles = roles.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q)
    );
  });

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const { sortedItems: sortedRoles, sortConfig: rolesSort, requestSort: requestRolesSort } = useTableSort(filteredRoles, 'name');

  const openCreateModal = () => {
    setEditingRole(null);
    setForm({ id: '', name: '', description: '', permissions: [] });
    setFormSearchPerm('');
    setIsFormModalOpen(true);
  };

  const openEditModal = (role: RoleCatalogItem) => {
    setEditingRole(role);
    setForm({ id: role.id, name: role.name, description: role.description ?? '', permissions: [...role.permissions] });
    setFormSearchPerm('');
    setIsFormModalOpen(true);
  };

  const openPermissionsModal = (role: RoleCatalogItem) => {
    setPermissionsRole(role);
    setSelectedPermissions([...role.permissions]);
    setPermModalSearch('');
  };

  const submitForm = () => {
    if (editingRole) {
      updateMutation.mutate({
        roleId: editingRole.id,
        payload: { name: form.name, description: form.description || null },
        permissions: form.permissions,
      });
      return;
    }
    const roleId = form.id.toUpperCase();
    if (RESERVED_ROLE_IDS.includes(roleId)) {
      toast.error(`O código "${roleId}" é reservado pelo sistema.`);
      return;
    }
    createMutation.mutate({
      id: roleId,
      name: form.name,
      description: form.description || null,
      permissions: form.permissions,
    });
  };

  const togglePermission = (permId: string, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permId] : prev.filter((p) => p !== permId)
    );
  };

  const toggleFormPermission = (permId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permId]
        : prev.permissions.filter((p) => p !== permId),
    }));
  };

  const permissionGroups = groupPermissionsByModule(allPermissions);

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Perfis de Acesso &amp; Permissões (RBAC)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {roles.length} perfis
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              {allPermissions.length} funcionalidades
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Catálogo de papéis e permissões da empresa — configure as funções de cada perfil para controlar o acesso aos módulos do sistema.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar perfil..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            Novo Perfil
          </button>
        </div>
      </GlassCard>

      {/* Alerta caso o catálogo tenha falhado e esteja em fallback */}
      {isPermissionsError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>A utilizar catálogo predefinido do sistema. Algumas informações podem estar a carregar em segundo plano.</span>
          </div>
          <button
            type="button"
            onClick={() => refetchPermissions()}
            className="font-bold underline hover:opacity-80 ml-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Tabela de Perfis */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs">
              <tr className="text-xs font-bold text-slate-600 dark:text-slate-300">
                <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 w-10 text-center">
                  <span className="sr-only">Drill-down</span>
                </th>
                <SortableHeader field="name" currentSortField={rolesSort?.key} sortDirection={rolesSort?.direction} onSort={requestRolesSort} className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                  Perfil
                </SortableHeader>
                <SortableHeader field="is_system" currentSortField={rolesSort?.key} sortDirection={rolesSort?.direction} align="center" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800">
                  Tipo
                </SortableHeader>
                <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800">
                  Permissões Atribuídas
                </th>
                <SortableHeader field="users_count" currentSortField={rolesSort?.key} sortDirection={rolesSort?.direction} align="center" className="py-2.5 px-3 border-b border-slate-200 dark:border-slate-800 w-28">
                  Utilizadores
                </SortableHeader>
                <th className="sticky top-0 py-2.5 px-3 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 text-center w-40">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {isLoadingRoles ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    A carregar perfis...
                  </td>
                </tr>
              ) : sortedRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Nenhum perfil encontrado.
                  </td>
                </tr>
              ) : (
                sortedRoles.map((role) => {
                  const isExpanded = expandedRoleId === role.id;

                  return (
                    <React.Fragment key={role.id}>
                      <tr
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition align-top cursor-pointer ${
                          isExpanded ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                        }`}
                        onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setExpandedRoleId(isExpanded ? null : role.id)}
                            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                            title="Expandir detalhes de permissões (Drill-down)"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">{role.name}</div>
                          <div className="font-mono text-[10px] font-bold text-blue-600 mt-0.5">{role.id}</div>
                          {role.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                              {role.description}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                role.is_system
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              }`}
                            >
                              {role.is_system ? 'Sistema' : 'Personalizado'}
                            </span>
                            {role.has_override && (
                              <span
                                title="As permissões efectivas deste perfil foram personalizadas"
                                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              >
                                Ajustado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold text-xs px-2.5 py-1 rounded-lg border ${
                                role.permissions.length === 0
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              }`}
                            >
                              {role.permissions.length} de {allPermissions.length} ativas
                            </span>
                            <span className="text-2xs text-slate-400">
                              (Clique na linha para expandir a matriz)
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {role.users_count}
                          </span>
                        </td>
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openPermissionsModal(role)}
                              title="Gerir permissões"
                              className="p-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            {!role.is_system && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(role)}
                                  title="Editar perfil"
                                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRoleToDelete(role)}
                                  title="Eliminar perfil"
                                  className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                          <td colSpan={6} className="p-4">
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                <div>
                                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Drill-down de Permissões</span>
                                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                    Perfil: {role.name}
                                    <span className="text-xs font-mono font-normal text-blue-600">({role.id})</span>
                                  </h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openPermissionsModal(role)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-xs"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  Personalizar Permissões
                                </button>
                              </div>

                              {role.permissions.length === 0 ? (
                                <div className="p-4 text-center border border-dashed border-amber-300 dark:border-amber-800 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                                  <ShieldAlert className="w-6 h-6 text-amber-600 mx-auto" />
                                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                    Nenhuma funcionalidade atribuída a este perfil.
                                  </div>
                                  <p className="text-[11px] text-amber-700 dark:text-amber-300 max-w-md mx-auto">
                                    Os utilizadores associados a este perfil não conseguirão aceder a funcionalidades restritas do Kudiba ERP. Clique no botão abaixo para definir as permissões.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => openPermissionsModal(role)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    Atribuir Funcionalidades Agora
                                  </button>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {MODULE_ORDER.map((module) => {
                                    const modulePerms = role.permissions.filter((p) => {
                                      const meta = allPermissions.find((ap) => ap.id === p);
                                      const m = meta
                                        ? normalizeModule(meta.module)
                                        : p.startsWith('users:') || p.startsWith('audit:')
                                        ? 'auth'
                                        : p.startsWith('tenant:')
                                        ? 'core'
                                        : p.split(':')[0] || '';
                                      return m === module;
                                    });
                                    if (modulePerms.length === 0) return null;

                                    return (
                                      <div
                                        key={module}
                                        className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-2xs font-bold text-slate-700 dark:text-slate-300">
                                            {MODULE_LABELS[module] || module}
                                          </span>
                                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 font-bold">
                                            {modulePerms.length}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                          {modulePerms.map((pid) => {
                                            const meta = allPermissions.find((ap) => ap.id === pid);
                                            return (
                                              <span
                                                key={pid}
                                                title={meta?.description || pid}
                                                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                              >
                                                {meta ? meta.name : pid}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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

      <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          Os perfis de Sistema (ADMIN, SYSADMIN, CONTABILISTA, OPERADOR_CAIXA, GESTOR_STOCK, AUDITOR, GESTOR_RH) são
          comuns a todas as empresas, mas as suas permissões podem ser ajustadas no âmbito da sua organização. Perfis
          personalizados (ex.: GERENTE) pertencem apenas a esta empresa.
        </span>
      </p>

      {/* MODAL: CRIAR / EDITAR PERFIL COM ATRIBUIÇÃO DIRETA DE PERMISSÕES */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingRole ? `Editar Perfil — ${editingRole.name}` : 'Novo Perfil de Acesso'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingRole
                    ? 'Actualize a identificação e seleccione as funcionalidades atribuídas a este perfil.'
                    : 'Defina o código, nome e marque directamente as funcionalidades permitidas para este perfil.'}
                </p>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!editingRole && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      Código do Perfil * (maiúsculas, ex.: GERENTE)
                    </label>
                    <input
                      type="text"
                      placeholder="GERENTE"
                      value={form.id}
                      onChange={(e) =>
                        setForm({ ...form, id: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
                    />
                  </div>
                )}

                <div className={editingRole ? 'sm:col-span-2' : ''}>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Nome do Perfil *
                  </label>
                  <input
                    type="text"
                    placeholder="Gerente Geral / Supervisor"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Descrição do Perfil
                  </label>
                  <input
                    type="text"
                    placeholder="Gestão operacional, vendas e supervisão de stocks..."
                    value={form.description || ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
              </div>

              {/* SELEÇÃO DIRETA DE FUNCIONALIDADES / PERMISSÕES */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      Funcionalidades &amp; Permissões ({form.permissions.length} de {allPermissions.length} seleccionadas)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Marque as funções que os utilizadores deste perfil poderão aceder.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, permissions: allPermissions.map((p) => p.id) }))}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      Marcar todas
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, permissions: [] }))}
                      className="text-xs text-slate-500 hover:underline font-semibold"
                    >
                      Desmarcar
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar funcionalidades (ex.: facturas, stock, caixa, clientes)..."
                    value={formSearchPerm}
                    onChange={(e) => setFormSearchPerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {permissionGroups.map(({ module, items }) => {
                    const filteredItems = items.filter((p) => {
                      if (!formSearchPerm) return true;
                      const q = formSearchPerm.toLowerCase();
                      return (
                        p.name.toLowerCase().includes(q) ||
                        p.id.toLowerCase().includes(q) ||
                        (p.description ?? '').toLowerCase().includes(q)
                      );
                    });
                    if (filteredItems.length === 0) return null;

                    const allModuleSelected = filteredItems.every((p) => form.permissions.includes(p.id));

                    return (
                      <div key={module} className="rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              MODULE_COLORS[module] ?? MODULE_COLORS.core
                            }`}
                          >
                            {MODULE_LABELS[module] ?? module}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (allModuleSelected) {
                                setForm((prev) => ({
                                  ...prev,
                                  permissions: prev.permissions.filter((pid) => !filteredItems.some((p) => p.id === pid)),
                                }));
                              } else {
                                setForm((prev) => ({
                                  ...prev,
                                  permissions: Array.from(new Set([...prev.permissions, ...filteredItems.map((p) => p.id)])),
                                }));
                              }
                            }}
                            className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {allModuleSelected ? (
                              <>
                                <CheckSquare className="w-3 h-3" /> Desmarcar módulo
                              </>
                            ) : (
                              <>
                                <Square className="w-3 h-3" /> Seleccionar módulo
                              </>
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {filteredItems.map((p) => {
                            const isChecked = form.permissions.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2 p-2 rounded-lg border transition cursor-pointer text-left ${
                                  isChecked
                                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => toggleFormPermission(p.id, e.target.checked)}
                                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold block leading-tight">
                                    {p.name}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                    {p.id}
                                  </span>
                                  {p.description && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block line-clamp-1 mt-0.5">
                                      {p.description}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                {form.permissions.length} funcionalidades selecionadas
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    !form.name.trim() ||
                    (!editingRole && !form.id.trim()) ||
                    createMutation.isPending ||
                    updateMutation.isPending
                  }
                  onClick={submitForm}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'A gravar...'
                    : editingRole
                    ? 'Gravar Alterações'
                    : 'Criar Perfil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEDICADO: GERIR PERMISSÕES */}
      {permissionsRole && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permissões &amp; Funcionalidades — {permissionsRole.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono font-bold">{permissionsRole.id}</span>
                {permissionsRole.is_editable ? (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">
                    {permissionsRole.id === 'ADMIN'
                      ? 'Perfil de Administrador: as alterações aplicam-se a esta empresa; permissões essenciais de gestão são salvaguardadas.'
                      : permissionsRole.is_system
                      ? isSystemManager
                        ? 'Perfil de Sistema: as alterações são aplicadas a todas as empresas.'
                        : 'Perfil de Sistema: as alterações aplicam-se apenas a esta empresa.'
                      : 'Perfil personalizado: as alterações não afectam outras empresas.'}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    Perfil de administração de sistema (SYSADMIN/SUPER_ADMIN): acesso total e permissões imutáveis.
                  </p>
                )}
                {permissionsRole.has_override && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    <Pencil className="w-3 h-3" />
                    Permissões personalizadas
                  </span>
                )}
              </div>
              <button
                onClick={() => setPermissionsRole(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-3 pb-2 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Pesquisar funcionalidade..."
                  value={permModalSearch}
                  onChange={(e) => setPermModalSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {permissionsRole.is_editable && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions(allPermissions.map((p) => p.id))}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Marcar todas
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPermissions([])}
                    className="text-xs text-slate-500 hover:underline font-semibold"
                  >
                    Desmarcar
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto py-2 space-y-4">
              {isLoadingPermissions ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                  A carregar catálogo de funcionalidades...
                </div>
              ) : (
                permissionGroups.map(({ module, items }) => {
                  const filteredItems = items.filter((p) => {
                    if (!permModalSearch) return true;
                    const q = permModalSearch.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.id.toLowerCase().includes(q) ||
                      (p.description ?? '').toLowerCase().includes(q)
                    );
                  });
                  if (filteredItems.length === 0) return null;

                  return (
                    <div key={module} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                            MODULE_COLORS[module] ?? MODULE_COLORS.core
                          }`}
                        >
                          {MODULE_LABELS[module] ?? module}
                        </span>
                        <div className="flex gap-2 text-[10px] font-bold">
                          <button
                            type="button"
                            disabled={!permissionsRole.is_editable}
                            onClick={() =>
                              setSelectedPermissions((prev) =>
                                Array.from(new Set([...prev, ...filteredItems.map((p) => p.id)]))
                              )
                            }
                            className="text-blue-600 hover:underline disabled:opacity-40"
                          >
                            Marcar secção
                          </button>
                          <button
                            type="button"
                            disabled={!permissionsRole.is_editable}
                            onClick={() =>
                              setSelectedPermissions((prev) =>
                                prev.filter((pid) => !filteredItems.some((p) => p.id === pid))
                              )
                            }
                            className="text-slate-500 hover:underline disabled:opacity-40"
                          >
                            Desmarcar
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {filteredItems.map((p) => {
                          const isChecked = selectedPermissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2.5 p-2 rounded-lg border transition ${
                                isChecked
                                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-950 dark:text-blue-100'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100/50'
                              } ${
                                permissionsRole.is_editable ? 'cursor-pointer' : 'opacity-70 cursor-default'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={!permissionsRole.is_editable}
                                checked={isChecked}
                                onChange={(e) => togglePermission(p.id, e.target.checked)}
                                className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold block leading-tight">
                                  {p.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                                  {p.id}
                                </span>
                                {p.description && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block line-clamp-1 mt-0.5">
                                    {p.description}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500">
                {selectedPermissions.length} de {allPermissions.length} funcionalidades seleccionadas
              </span>
              <div className="flex items-center gap-3">
                {permissionsRole.can_reset_override && (
                  <button
                    type="button"
                    disabled={resetPermissionsMutation.isPending}
                    onClick={() => resetPermissionsMutation.mutate(permissionsRole.id)}
                    className="px-4 py-2 rounded-xl text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-sm font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50"
                  >
                    {resetPermissionsMutation.isPending ? 'A repor...' : 'Repor predefinições'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPermissionsRole(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {permissionsRole.is_editable ? 'Cancelar' : 'Fechar'}
                </button>
                {permissionsRole.is_editable && (
                  <button
                    type="button"
                    disabled={updatePermissionsMutation.isPending}
                    onClick={() =>
                      updatePermissionsMutation.mutate({
                        roleId: permissionsRole.id,
                        permissions: selectedPermissions,
                      })
                    }
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
                  >
                    {updatePermissionsMutation.isPending ? 'A gravar...' : 'Gravar Permissões'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINAÇÃO */}
      {roleToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Eliminar Perfil</h3>
                <p className="text-xs text-slate-500">{roleToDelete.name}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              O perfil <span className="font-mono font-bold">{roleToDelete.id}</span> será removido definitivamente.
              Esta acção não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRoleToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(roleToDelete.id)}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'A eliminar...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
