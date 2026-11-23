import React from 'react';
import {
  Sun,
  Moon,
  LogOut,
  Store,
  ShieldCheck,
  Menu,
  KeyRound,
  X,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Building2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { useUiStore } from '../../stores/uiStore';
import { StatusBadge } from '../common/StatusBadge';
import { ModuleKey } from './Sidebar';

interface HeaderProps {
  activeModule?: ModuleKey;
  onSelectModule?: (module: ModuleKey) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeModule, onSelectModule }) => {
  const { user, tenants, activeTenant, activeBranch, setSession, logout } = useAuthStore();
  const { themeMode, toggleTheme, toggleMobileSidebar } = useUiStore();
  const queryClient = useQueryClient();
  const [isSwitchingContext, setIsSwitchingContext] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);

  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsPasswordModalOpen(false);
  };

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
      resetPasswordForm();
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

        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl border-l border-slate-200 dark:border-slate-800 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0 ring-2 ring-emerald-500/20"
            >
              {user?.fullName?.charAt(0) || user?.full_name?.charAt(0) || 'U'}
            </span>
            <div className="hidden sm:block text-left max-w-[150px]">
              <p className="text-xs sm:text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100 truncate">
                {user?.fullName || user?.full_name || 'Utilizador Kudiba'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {user?.email || 'admin@kudiba.ao'}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                isUserMenuOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
              }`}
            />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl py-2 z-40 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                    {user?.fullName?.charAt(0) || user?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {user?.fullName || user?.full_name || 'Utilizador Kudiba'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user?.email || 'admin@kudiba.ao'}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
                    {user?.is_superadmin ? 'Superadministrador' : user?.roles?.[0] || 'Utilizador'}
                  </span>
                  {activeTenant && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 truncate max-w-[170px]"
                      title={activeTenant.trade_name || activeTenant.name}
                    >
                      <Store className="w-3 h-3 shrink-0" />
                      <span className="truncate">{activeTenant.trade_name || activeTenant.name}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="p-1.5 space-y-0.5">
                {user?.is_superadmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onSelectModule?.('clients');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors text-left cursor-pointer ${
                        activeModule === 'clients'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 font-bold'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Clientes & Licenças</span>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        Superadmin
                      </span>
                    </button>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Alterar palavra-passe</span>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Terminar sessão</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 space-y-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-800/40">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Alterar Palavra-passe
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    Atualize a palavra-passe da sua conta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetPasswordForm}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={changeOwnPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Palavra-passe actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    placeholder="Introduza a sua palavra-passe actual"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Nova palavra-passe
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Mínimo de 12 caracteres"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Deve conter pelo menos 12 caracteres.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Confirmar nova palavra-passe
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Confirme a nova palavra-passe"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 pr-10 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetPasswordForm}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" />
                  {isChangingPassword ? 'A alterar...' : 'Guardar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
