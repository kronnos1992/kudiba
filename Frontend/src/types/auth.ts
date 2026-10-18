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
  city?: string | null;
  address_detail?: string | null;
  isMain?: boolean;
}

export interface TenantBankAccount {
  bank_name: string;
  iban: string;
  account_number?: string;
  swift?: string;
  currency?: string;
  is_primary?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  taxId: string;
  company_name?: string;
  trade_name?: string | null;
  nif?: string;
  slug?: string;
  address_detail?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_data_url?: string | null;
  commercial_registry?: string | null;
  share_capital?: string | null;
  currency?: string;
  tax_regime_code?: string | null;
  tax_office_code?: string | null;
  agt_cert_number?: string | null;
  default_withholding_rate?: number | null;
  invoice_footer_notes?: string | null;
  bank_accounts?: TenantBankAccount[];
  onboarding_completed?: boolean;
  roles?: string[];
  permissions?: string[];
  branches: Branch[];
  default_branch?: Branch;
  subscribed_modules?: string[] | null;
  license_valid_until?: string | null;
}

export interface TenantSettings {
  id: string;
  slug: string;
  company_name: string;
  trade_name?: string | null;
  nif: string;
  address_detail?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_data_url?: string | null;
  commercial_registry?: string | null;
  share_capital?: string | null;
  currency: string;
  tax_regime_code: string;
  tax_office_code?: string | null;
  agt_cert_number?: string | null;
  default_withholding_rate: number;
  invoice_footer_notes?: string | null;
  bank_accounts: TenantBankAccount[];
  onboarding_completed: boolean;
  subscribed_modules?: string[] | null;
  license_valid_until?: string | null;
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

