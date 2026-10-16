import { create } from 'zustand';
import { AuthState, User, Tenant, Branch, LoginResponse } from '../types/auth';

interface AuthActions {
  setSession: (response: LoginResponse) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
  setActiveTenant: (tenant: Tenant, branch?: Branch) => void;
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

const getInitialState = (): AuthState => {
  const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  const userJson = localStorage.getItem(STORAGE_KEYS.USER);
  const tenantJson = localStorage.getItem(STORAGE_KEYS.ACTIVE_TENANT);
  const branchJson = localStorage.getItem(STORAGE_KEYS.ACTIVE_BRANCH);
  const tenantsJson = localStorage.getItem(STORAGE_KEYS.TENANTS);

  return {
    accessToken,
    refreshToken,
    user: userJson ? JSON.parse(userJson) : null,
    activeTenant: tenantJson ? JSON.parse(tenantJson) : null,
    activeBranch: branchJson ? JSON.parse(branchJson) : null,
    tenants: tenantsJson ? JSON.parse(tenantsJson) : [],
    isAuthenticated: Boolean(accessToken),
    isLoading: false,
  };
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...getInitialState(),

  setSession: (res) => {
    const normalizedUser: User = {
      ...res.user,
      fullName: res.user.fullName || res.user.full_name || 'Utilizador',
      isActive: res.user.isActive ?? res.user.is_active ?? true,
    };

    const normalizeTenant = (t: Tenant): Tenant => ({
      ...t,
      name: t.name || t.company_name || 'Organização Kudiba',
      taxId: t.taxId || t.nif || '',
      currency: t.currency || 'AOA',
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
    set({ activeTenant: tenant, activeBranch: selectedBranch });
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
