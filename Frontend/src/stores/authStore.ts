import { create } from 'zustand';
import { AuthState, User, Tenant, Branch, LoginResponse } from '../types/auth';

interface AuthActions {
  setSession: (response: LoginResponse) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  setActiveTenant: (tenant: Tenant, branch?: Branch) => void;
  updateActiveTenantSettings: (updates: Partial<Tenant>) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'kudiba_access_token',
  REFRESH_TOKEN: 'kudiba_refresh_token',
  USER: 'kudiba_user',
  ACTIVE_TENANT: 'kudiba_active_tenant',
  ACTIVE_BRANCH: 'kudiba_active_branch',
  TENANTS: 'kudiba_tenants',
};

const decodeJwtPayload = (token: string | null): { roles?: string[]; permissions?: string[] } => {
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

const getInitialState = (): AuthState => {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const userJson = localStorage.getItem(STORAGE_KEYS.USER);
  const tenantJson = localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT);
  const branchJson = localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH);
  const tenantsJson = localStorage.getItem(STORAGE_KEYS.TENANTS);

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

  return {
    accessToken,
    refreshToken,
    user,
    activeTenant,
    activeBranch: branchJson ? JSON.parse(branchJson) : null,
    tenants: tenantsJson ? JSON.parse(tenantsJson) : [],
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

    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refresh_token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
    localStorage.setItem(STORAGE_KEYS.TENANTS, JSON.stringify(tenants));

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
      isAuthenticated: true,
      isLoading: false,
    });
  },

  updateTokens: (accessToken, refreshToken) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    set({ accessToken, refreshToken });
  },

  setActiveTenant: (tenant, branch) => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TENANT, JSON.stringify(tenant));
    const selectedBranch = branch || tenant.branches[0] || null;
    if (selectedBranch) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_BRANCH, JSON.stringify(selectedBranch));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_BRANCH);
    }
    set((state) => {
      const updatedUser = state.user
        ? {
            ...state.user,
            roles: tenant.roles?.length ? tenant.roles : state.user.roles || [],
            permissions: tenant.permissions?.length ? tenant.permissions : state.user.permissions || [],
          }
        : null;
      if (updatedUser) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
      }
      return { activeTenant: tenant, activeBranch: selectedBranch, user: updatedUser };
    });
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

  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_TENANT);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_BRANCH);
    localStorage.removeItem(STORAGE_KEYS.TENANTS);
    set({
      user: null,
      tenants: [],
      activeTenant: null,
      activeBranch: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));
