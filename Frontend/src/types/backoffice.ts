export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED' | 'NONE';

export interface BackofficeModule {
  key: string;
  name: string;
  description?: string | null;
}

export interface License {
  id: string;
  license_key: string;
  plan: string;
  seats: number;
  modules: string[];
  valid_from: string;
  valid_until: string;
  status: string;
  expired: boolean;
  notes?: string | null;
  created_at?: string | null;
}

export type AlvaraStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'INVALID' | 'UNVERIFIED' | 'MISSING';

export interface AlvaraPlatformCheck {
  id: string;
  name: string;
  entity: string;
  portal_url: string;
  verification_url: string;
  reachable?: boolean | null;
  latency_ms?: number | null;
  status_message: string;
}

export interface AlvaraVerificationResult {
  alvara_number: string;
  nif?: string | null;
  alvara_issue_date?: string | null;
  alvara_expiry_date?: string | null;
  valid: boolean;
  status: AlvaraStatus | string;
  format_valid: boolean;
  dates_valid: boolean;
  is_expired: boolean;
  days_remaining?: number | null;
  message: string;
  checked_at: string;
  official_platforms: AlvaraPlatformCheck[];
  auto_filled?: boolean;
}

export interface AccountingTemplate {
  code: string;
  name: string;
  sector_code: string;
  regulator?: string | null;
  legal_reference?: string | null;
  version?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
  status: string;
  description?: string | null;
  portal_url?: string | null;
  account_count?: number;
}

export interface VerifyAlvaraPayload {
  alvara_number: string;
  nif?: string | null;
  alvara_issue_date?: string | null;
  alvara_expiry_date?: string | null;
  probe_remote?: boolean;
}

export interface BackofficeClient {
  id: string;
  tenant_id: string;
  company_name: string;
  nif: string;
  alvara_number?: string | null;
  alvara_issue_date?: string | null;
  alvara_expiry_date?: string | null;
  alvara_status?: AlvaraStatus | string;
  sector_code?: string;
  accounting_template_code?: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  license_status: LicenseStatus | string;
  license?: License | null;
  created_at: string;
  updated_at: string;
  license_history?: License[];
}

export interface CreateClientPayload {
  company_name: string;
  nif: string;
  alvara_number: string;
  alvara_issue_date?: string;
  alvara_expiry_date?: string;
  sector_code?: string;
  accounting_template_code?: string;
  modules: string[];
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
  plan?: string;
  seats?: number;
  admin_email?: string | null;
  admin_full_name?: string | null;
  admin_password?: string | null;
}

export interface UpdateClientPayload {
  company_name?: string;
  alvara_number?: string | null;
  alvara_issue_date?: string | null;
  alvara_expiry_date?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
}

export interface RenewLicensePayload {
  modules?: string[];
  plan?: string;
  seats?: number;
  notes?: string | null;
}

export interface PlatformClientStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  none: number;
}

export interface PlatformLicenseStats {
  total: number;
  active: number;
  expiring_soon: number;
  expired: number;
  suspended: number;
}

export interface PlatformModuleAdoption {
  key: string;
  name: string;
  client_count: number;
}

export interface PlatformSummary {
  generated_at: string;
  clients: PlatformClientStats;
  licenses: PlatformLicenseStats;
  active_seats: number;
  modules: PlatformModuleAdoption[];
}

export interface CommercialMonthBucket {
  month: string;
  count: number;
}

export interface PlatformCommercialSummary {
  generated_at: string;
  total_clients: number;
  new_this_month: number;
  new_last_month: number;
  growth_rate: number | null;
  new_last_12m: number;
  monthly: CommercialMonthBucket[];
}
