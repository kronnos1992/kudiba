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

export interface BackofficeClient {
  id: string;
  tenant_id: string;
  company_name: string;
  nif: string;
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
