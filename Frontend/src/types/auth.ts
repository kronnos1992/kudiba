export interface User {
  id: string;
  email: string;
  fullName?: string;
  full_name?: string;
  avatarUrl?: string;
  isActive?: boolean;
  is_active?: boolean;
  is_superadmin?: boolean;
  roles?: string[];
  permissions?: string[];
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  city?: string;
  isMain?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  taxId: string;
  company_name?: string;
  nif?: string;
  slug?: string;
  currency?: string;
  branches: Branch[];
  default_branch?: Branch;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse extends TokenPair {
  user: User;
  tenants?: Tenant[];
  active_tenant?: Tenant;
  active_branch?: Branch;
}

export interface AuthState {
  user: User | null;
  tenants: Tenant[];
  activeTenant: Tenant | null;
  activeBranch: Branch | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
