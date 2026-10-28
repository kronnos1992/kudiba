import { create } from 'zustand';
import { AuthState, LogoutReason, User, Tenant, LoginResponse } from '../types/auth';
import { toast } from './toastStore';

interface AuthActions {
  setSession: (response: LoginResponse) => void;
  updateTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => void;
  updateActiveTenantSettings: (updates: Partial<Tenant>) => void;
  setUser: (user: User) => void;
  logout: (reason?: LogoutReason) => void;
  setLoading: (loading: boolean) => void;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'kudiba_access_token',
  REFRESH_TOKEN: 'kudiba_refresh_token',
  USER: 'kudiba_user',
  ACTIVE_TENANT: 'kudiba_active_tenant',
  ACTIVE_BRANCH: 'kudiba_active_branch',
  TENANTS: 'kudiba_tenants',
  SESSION_EXPIRES_AT: 'kudiba_session_expires_at',
};

const decodeJwtPayload = (
  token: string | null
): { roles?: string[]; permissions?: string[]; exp?: number } => {
  if (!token) return {};
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
};

const resolveSessionExpiresAt = (accessToken: string | null, expiresIn?: number): number | null => {
  const payload = decodeJwtPayload(accessToken);
  if (typeof payload.exp === 'number' && payload.exp > 0) {
    return payload.exp * 1000;
  }
  if (typeof expiresIn === 'number' && expiresIn > 0) {
    return Date.now() + expiresIn * 1000;
  }
  return null;
};

const getInitialState = (): AuthState => {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const userJson = localStorage.getItem(STORAGE_KEYS.USER);
  const tenantJson = localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT);
  const branchJson = localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH);
  const tenantsJson = localStorage.getItem(STORAGE_KEYS.TENANTS);
  const storedExpiry = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRES_AT);

  let user: User | null = userJson ? JSON.parse(userJson) : null;
  const activeTenant: Tenant | null = tenantJson ? JSON.parse(tenantJson) : null;

  if (user && (!user.roles || user.roles.length === 0)) {
    const jwtPayload = decodeJwtPayload(accessToken);
    const resolvedRoles = activeTenant?.roles?.length
      ? activeTenant.roles
      : jwtPayload.roles || [];
    const resolvedPermissions = activeTenant?.permissions?.length
      ? activeTenant.permissions
      : jwtPayload.permissions || [];
    user = {
      ...user,
      roles: resolvedRoles,
      permissions: resolvedPermissions,
    };
  }

  const sessionExpiresAt =
    resolveSessionExpiresAt(accessToken) ?? (storedExpiry ? Number(storedExpiry) : null);

  return {
    accessToken,
    refreshToken,
    user,
    activeTenant,
    activeBranch: branchJson ? JSON.parse(branchJson) : null,
    tenants: tenantsJson ? JSON.parse(tenantsJson) : [],
    sessionExpiresAt: sessionExpiresAt && sessionExpiresAt > 0 ? sessionExpiresAt : null,
    isAuthenticated: Boolean(accessToken),
    isLoading: false,
  };
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...getInitialState(),

  setSession: (res) => {
    const jwtPayload = decodeJwtPayload(res.access_token);
    const resolvedRoles =
      res.active_tenant?.roles?.length
        ? res.active_tenant.roles
        : (res.user as User)?.roles?.length
        ? (res.user as User).roles!
        : jwtPayload.roles || [];

    const resolvedPermissions =
      res.active_tenant?.permissions?.length
        ? res.active_tenant.permissions
        : (res.user as User)?.permissions?.length
        ? (res.user as User).permissions!
        : jwtPayload.permissions || [];

    const normalizedUser: User = {
      ...res.user,
      fullName: res.user.fullName || res.user.full_name || 'Utilizador',
      isActive: res.user.isActive ?? res.user.is_active ?? true,
      roles: resolvedRoles,
      permissions: resolvedPermissions,
    };

    const normalizeTenant = (t: Tenant): Tenant => ({
      ...t,
      name: t.trade_name || t.name || t.company_name || 'Organização Kudiba',
      company_name: t.company_name || t.name || 'Organização Kudiba',
      taxId: t.taxId || t.nif || '',
      nif: t.nif || t.taxId || '',
      currency: t.currency || 'AOA',
      country: t.country || 'AO',
      tax_regime_code: t.tax_regime_code || 'REGIME_GERAL',
      default_withholding_rate: t.default_withholding_rate ?? 6.5,
      bank_accounts: t.bank_accounts || [],
      onboarding_completed: t.onboarding_completed ?? true,
      roles: t.roles?.length ? t.roles : resolvedRoles,
      permissions: t.permissions?.length ? t.permissions : resolvedPermissions,
      branches: t.branches && t.branches.length > 0 ? t.branches : (t.default_branch ? [t.default_branch] : []),
    });

    const rawActive = res.active_tenant || (res.tenants && res.tenants[0]) || null;
    const activeTenant = rawActive ? normalizeTenant(rawActive) : null;
    const tenants = (res.tenants || (activeTenant ? [activeTenant] : [])).map(normalizeTenant);
    const activeBranch = res.active_branch || (activeTenant?.default_branch) || (activeTenant?.branches[0]) || null;

    const sessionExpiresAt = resolveSessionExpiresAt(res.access_token, res.expires_in);

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));
    if (sessionExpiresAt) {
      localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRES_AT, String(sessionExpiresAt));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRES_AT);
    }

    if (activeTenant) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, JSON.stringify(activeTenant));
    }
    if (activeBranch) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH, JSON.stringify(activeBranch));
    }

    set({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      user: normalizedUser,
      tenants,
      activeTenant,
      activeBranch,
      sessionExpiresAt,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateTokens: (accessToken, refreshToken, expiresIn) => {
    const sessionExpiresAt = resolveSessionExpiresAt(accessToken, expiresIn);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (sessionExpiresAt) {
      localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRES_AT, String(sessionExpiresAt));
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRES_AT);
    }
    set({ accessToken, refreshToken, sessionExpiresAt });
  },

  updateActiveTenantSettings: (updates) => {
    set((state) => {
      if (!state.activeTenant) return state;
      const updatedTenant: Tenant = {
        ...state.activeTenant,
        ...updates,
        name:
          updates.trade_name ||
          updates.company_name ||
          updates.name ||
          state.activeTenant.trade_name ||
          state.activeTenant.company_name ||
          state.activeTenant.name,
        company_name: updates.company_name || state.activeTenant.company_name || state.activeTenant.name,
        taxId: updates.nif || updates.taxId || state.activeTenant.nif || state.activeTenant.taxId,
        nif: updates.nif || updates.taxId || state.activeTenant.nif || state.activeTenant.taxId,
      };
      const updatedTenants = state.tenants.map((t) =>
        t.id === updatedTenant.id ? updatedTenant : t
      );
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, JSON.stringify(updatedTenant));
      localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(updatedTenants));
      return {
        activeTenant: updatedTenant,
        tenants: updatedTenants,
      };
    });
  },

  setUser: (user) => {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    set({ user });
  },

  logout: (reason) => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_BRANCH);
    localStorage.removeItem(STORAGE_KEYS.TENANTS);
    localStorage.removeItem(STORAGE_KEYS.SESSION_EXPIRES_AT);
    set({
      user: null,
      tenants: [],
      activeTenant: null,
      activeBranch: null,
      accessToken: null,
      refreshToken: null,
      sessionExpiresAt: null,
      isAuthenticated: false,
      isLoading: false,
    });
    if (reason === 'idle') {
      toast.warning('Sessão terminada por inactividade. Volte a entrar para continuar.');
    } else if (reason === 'expired') {
      toast.warning('A sua sessão expirou. Volte a entrar para continuar.');
    }
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
