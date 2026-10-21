import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  PlusCircle,
  Pencil,
  KeyRound,
  Trash2,
  X,
  Users,
  Search,
} from 'lucide-react';
import { GlassCard } from '../../components/common/GlassCard';
import {
  authApi,
  RoleCatalogItem,
  PermissionCatalogItem,
  CreateRolePayload,
} from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';

const MODULE_LABELS: Record<string, string> = {
  users: 'Utilizadores & RBAC',
  fiscal: 'Fiscal & Faturação',
  pos: 'Ponto de Venda (POS)',
  inventory: 'Inventário',
  treasury: 'Tesouraria',
  payroll: 'Recursos Humanos',
  accounting: 'Contabilidade',
  tenant: 'Organização',
};

const MODULE_ORDER = ['users', 'fiscal', 'pos', 'inventory', 'treasury', 'payroll', 'accounting', 'tenant'];

const RESERVED_ROLE_IDS = ['ADMIN', 'SYSADMIN', 'SUPER_ADMIN'];

const MODULE_COLORS: Record<string, string> = {
  users: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  fiscal: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  pos: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  inventory: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  treasury: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  payroll: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  accounting: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  tenant: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const groupPermissionsByModule = (permissions: PermissionCatalogItem[]) => {
  const groups = new Map<string, PermissionCatalogItem[]>();
  const sorted = [...permissions].sort((a, b) =>
    a.module === b.module ? a.id.localeCompare(b.id) : a.module.localeCompare(b.module)
  );
  for (const p of sorted) {
    const list = groups.get(p.module) ?? [];
    list.push(p);
    groups.set(p.module, list);
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
  const [permissionsRole, setPermissionsRole] = useState<RoleCatalogItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [roleToDelete, setRoleToDelete] = useState<RoleCatalogItem | null>(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['auth_roles'],
    queryFn: authApi.listRoles,
  });

  const { data: allPermissions = [] } = useQuery({
    queryKey: ['auth_permissions'],
    queryFn: authApi.listPermissions,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['auth_roles'] });
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
    mutationFn: ({ roleId, payload }: { roleId: string; payload: { name: string; description?: string | null } }) =>
      authApi.updateRole(roleId, payload),
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

  const openCreateModal = () => {
    setEditingRole(null);
    setForm({ id: '', name: '', description: '', permissions: [] });
    setIsFormModalOpen(true);
  };

  const openEditModal = (role: RoleCatalogItem) => {
    setEditingRole(role);
    setForm({ id: role.id, name: role.name, description: role.description ?? '', permissions: role.permissions });
    setIsFormModalOpen(true);
  };

  const openPermissionsModal = (role: RoleCatalogItem) => {
    setPermissionsRole(role);
    setSelectedPermissions([...role.permissions]);
  };

  const submitForm = () => {
    if (editingRole) {
      updateMutation.mutate({
        roleId: editingRole.id,
        payload: { name: form.name, description: form.description || null },
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

  const permissionGroups = groupPermissionsByModule(allPermissions);

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Perfis de Acesso &amp; Permissões
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {roles.length} perfis
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Catálogo de perfis e permissões desta empresa — os perfis de Sistema podem ser ajustados sem afectar as
            restantes organizações
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

      {/* Tabela de Perfis */}
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-900/75 text-xs font-bold text-slate-600 dark:text-slate-300">
                <th className="p-3">Perfil</th>
                <th className="p-3 text-center">Tipo</th>
                <th className="p-3">Permissões</th>
                <th className="p-3 text-center w-28">Utilizadores</th>
                <th className="p-3 text-center w-40">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    A carregar perfis...
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Nenhum perfil encontrado.
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition align-top"
                  >
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
                            title="As permissões effective deste perfil foram personalizadas"
                            className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            Ajustado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-lg">
                        {role.permissions.length === 0 ? (
                          <span className="text-[10px] text-slate-400 italic">Sem permissões atribuídas</span>
                        ) : (
                          role.permissions.map((p) => (
                            <span
                              key={p}
                              className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            >
                              {p}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {role.users_count}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openPermissionsModal(role)}
                          title="Gerir permissões"
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          Os perfis de Sistema (ADMIN, SYSADMIN, CONTABILISTA, OPERADOR_CAIXA, GESTOR_STOCK, AUDITOR, GESTOR_RH) são
          comuns a todas as empresas, mas as suas permissões podem ser ajustadas: o administrador do sistema
          (SYSADMIN) aplica as alterações a todas as empresas, o administrador da empresa (ADMIN) apenas à sua.
          ADMIN, SYSADMIN e SUPER_ADMIN têm acesso total e permissões imutáveis. Os perfis personalizados pertencem
          apenas a esta empresa e não afectam outras organizações.
        </span>
      </p>

      {/* MODAL: CRIAR / EDITAR PERFIL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingRole ? 'Editar Perfil' : 'Novo Perfil de Acesso'}
              </h3>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {!editingRole && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Código do Perfil (maiúsculas, ex.: GERENTE_LOJA)
                  </label>
                  <input
                    type="text"
                    placeholder="GERENTE_LOJA"
                    value={form.id}
                    onChange={(e) =>
                      setForm({ ...form, id: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Nome do Perfil
                </label>
                <input
                  type="text"
                  placeholder="Gerente de Loja"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  placeholder="Gestão comercial e operacional da loja..."
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
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
      )}

      {/* MODAL: PERMISSÕES */}
      {permissionsRole && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permissões — {permissionsRole.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono">{permissionsRole.id}</span>
                {permissionsRole.is_editable ? (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">
                    {permissionsRole.is_system
                      ? isSystemManager
                        ? 'Perfil de Sistema: as alterações são aplicadas a todas as empresas.'
                        : 'Perfil de Sistema: as alterações aplicam-se apenas a esta empresa.'
                      : 'Perfil personalizado desta empresa: as alterações não afectam outras empresas.'}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    Perfil de administrador: acesso total e permissões imutáveis.
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
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {permissionGroups.map(({ module, items }) => (
                <div key={module}>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                        MODULE_COLORS[module] ?? MODULE_COLORS.tenant
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
                            Array.from(new Set([...prev, ...items.map((p) => p.id)]))
                          )
                        }
                        className="text-blue-600 hover:underline disabled:opacity-40"
                      >
                        Marcar todas
                      </button>
                      <button
                        type="button"
                        disabled={!permissionsRole.is_editable}
                        onClick={() =>
                          setSelectedPermissions((prev) =>
                            prev.filter((pid) => !items.some((p) => p.id === pid))
                          )
                        }
                        className="text-slate-500 hover:underline disabled:opacity-40"
                      >
                        Desmarcar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {items.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                          permissionsRole.is_editable ? 'cursor-pointer' : 'opacity-70 cursor-default'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!permissionsRole.is_editable}
                          checked={selectedPermissions.includes(p.id)}
                          onChange={(e) => togglePermission(p.id, e.target.checked)}
                          className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 block">
                            {p.id}
                          </span>
                          {p.description && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                              {p.description}
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500">
                {selectedPermissions.length} de {allPermissions.length} permissões seleccionadas
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
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 text-sm font-semibold"
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
