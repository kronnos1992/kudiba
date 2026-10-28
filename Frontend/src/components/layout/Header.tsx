import React from 'react';
import { Sun, Moon, LogOut, Store, ShieldCheck, Menu, KeyRound, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { useUiStore } from '../../stores/uiStore';
import { StatusBadge } from '../common/StatusBadge';

export const Header: React.FC = () => {
  const { user, tenants, activeTenant, activeBranch, setSession, logout } = useAuthStore();
  const { themeMode, toggleTheme, toggleMobileSidebar } = useUiStore();
  const queryClient = useQueryClient();
  const [isSwitchingContext, setIsSwitchingContext] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const switchContext = async (tenantId: string, branchId?: string) => {
    if (isSwitchingContext) return;
    setIsSwitchingContext(true);
    try {
      const session = await authApi.switchTenant({
        tenant_id: tenantId,
        ...(branchId ? { branch_id: branchId } : {}),
      });
      setSession(session);
      await queryClient.invalidateQueries();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Não foi possível alterar a empresa ou filial ativa.'
      );
    } finally {
      setIsSwitchingContext(false);
    }
  };

  const changeOwnPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação da palavra-passe não coincide.');
      return;
    }
    if (newPassword.length < 12) {
      toast.error('A nova palavra-passe deve ter pelo menos 12 caracteres.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changeOwnPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success('Palavra-passe alterada. Inicie sessão novamente.');
      setIsPasswordModalOpen(false);
      logout();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Não foi possível alterar a palavra-passe.'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <header className="no-print sticky top-0 z-30 h-16 w-full bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between gap-2 transition-colors">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={toggleMobileSidebar}
          aria-label="Abrir menu de navegação"
          className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {activeTenant?.logo_data_url && (
          <img
            src={activeTenant.logo_data_url}
            alt={activeTenant.name}
            className="hidden sm:block w-8 h-8 rounded-lg object-contain border border-slate-200 dark:border-slate-700 bg-white p-0.5 shrink-0"
          />
        )}

        {tenants.length > 0 && (
          <div className="relative min-w-0 max-w-[190px] sm:max-w-[280px] md:max-w-sm">
            <select
              value={activeTenant?.id || ''}
              disabled={isSwitchingContext}
              onChange={(e) => {
                const selected = tenants.find((t) => t.id === e.target.value);
                if (selected) void switchContext(selected.id);
              }}
              className="w-full truncate appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-semibold rounded-xl px-2.5 sm:px-3 py-1.5 pr-6 sm:pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer shadow-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trade_name || t.name} (NIF: {t.nif || t.taxId})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="hidden xl:flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
          <Store className="w-4 h-4 shrink-0" />
          {activeTenant?.branches && activeTenant.branches.length > 1 ? (
            <select
              value={activeBranch?.id || activeTenant.branches[0]?.id || ''}
              disabled={isSwitchingContext}
              onChange={(e) => {
                const br = activeTenant.branches.find((b) => b.id === e.target.value);
                if (br && activeTenant) void switchContext(activeTenant.id, br.id);
              }}
              className="bg-transparent font-medium text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
            >
              {activeTenant.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate max-w-[160px]">
              {activeBranch?.name || activeTenant?.branches?.[0]?.name || 'Sede Principal'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-1.5" title="Motor Fiscal Conforme (RSA-SHA1)">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <StatusBadge status="ok" label="Fiscal Conforme" size="small" />
        </div>

        <button
          onClick={toggleTheme}
          aria-label="Alternar tema"
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={() => setIsPasswordModalOpen(true)}
          title="Minha Conta — alterar palavra-passe"
          className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 text-left"
        >
          <span
            aria-hidden="true"
            className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 hover:ring-2 hover:ring-emerald-400"
          >
            {user?.fullName?.charAt(0) || 'U'}
          </span>
          <div className="hidden sm:block text-left max-w-[150px]">
            <p className="text-xs sm:text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100 truncate">
              {user?.fullName || 'Utilizador Kudiba'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {user?.email || 'admin@kudiba.ao'}
            </p>
          </div>
        </button>

        <button
            onClick={() => logout()}
          title="Terminar Sessão"
          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={changeOwnPassword}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Minha conta</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Alterar palavra-passe</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Palavra-passe actual
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Nova palavra-passe (mínimo 12 caracteres)
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirmar nova palavra-passe
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <KeyRound className="h-4 w-4" />
              {isChangingPassword ? 'A alterar...' : 'Alterar palavra-passe'}
            </button>
          </form>
        </div>
      )}
    </header>
  );
};
