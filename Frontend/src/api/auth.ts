import { apiClient } from './client';
import { LoginResponse, TenantBankAccount, TenantSettings, User } from '../types/auth';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SwitchTenantPayload {
  tenant_id: string;
  branch_id?: string;
}

export interface TenantMember {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  status: string;
  default_branch_id?: string | null;
}

export interface InviteMemberPayload {
  email: string;
  full_name: string;
  roles: string[];
  branch_id?: string | null;
  password?: string;
}

export interface UpdateRolesPayload {
  roles: string[];
}

export interface RoleCatalogItem {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  users_count: number;
  permissions: string[];
  is_editable: boolean;
  has_override: boolean;
  can_reset_override: boolean;
}

export interface PermissionCatalogItem {
  id: string;
  module: string;
  name: string;
  description?: string | null;
}

export interface CreateRolePayload {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface UpdateRolePayload {
  name: string;
  description?: string | null;
}

export interface BranchDto {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  address_detail?: string | null;
}

export interface CreateBranchPayload {
  code: string;
  name: string;
  city?: string | null;
  address_detail?: string | null;
}

export interface AuthAuditLogItem {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  email_attempted: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface AuthAuditLogsResponse {
  items: AuthAuditLogItem[];
  total: number;
}

export interface UpdateTenantSettingsPayload {
  company_name?: string;
  trade_name?: string | null;
  nif?: string;
  address_detail?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo_data_url?: string | null;
  commercial_registry?: string | null;
  share_capital?: string | null;
  currency?: string;
  tax_regime_code?: string;
  tax_office_code?: string | null;
  agt_cert_number?: string | null;
  default_withholding_rate?: number;
  invoice_footer_notes?: string | null;
  bank_accounts?: TenantBankAccount[];
  onboarding_completed?: boolean;
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', payload);
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await apiClient.post('/api/v1/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  logout: async (refreshToken?: string | null) => {
    try {
      await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken });
    } catch {
      // Ignora erro no logout para garantir limpeza de sessão local
    }
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    return response.data;
  },

  switchTenant: async (payload: SwitchTenantPayload): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/switch-tenant', payload);
    return response.data;
  },

  getTenantSettings: async (): Promise<TenantSettings> => {
    const response = await apiClient.get<TenantSettings>('/api/v1/auth/tenant/settings');
    return response.data;
  },

  updateTenantSettings: async (payload: UpdateTenantSettingsPayload): Promise<TenantSettings> => {
    const response = await apiClient.put<TenantSettings>('/api/v1/auth/tenant/settings', payload);
    return response.data;
  },

  listMembers: async (): Promise<TenantMember[]> => {
    const response = await apiClient.get<TenantMember[]>('/api/v1/auth/users');
    return response.data;
  },

  inviteMember: async (payload: InviteMemberPayload): Promise<TenantMember> => {
    const response = await apiClient.post<TenantMember>('/api/v1/auth/users/invite', payload);
    return response.data;
  },

  updateMemberRoles: async (userId: string, payload: UpdateRolesPayload): Promise<void> => {
    await apiClient.put(`/api/v1/auth/users/${userId}/roles`, payload);
  },

  updateMemberStatus: async (userId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> => {
    await apiClient.patch(`/api/v1/auth/users/${userId}/status`, { status });
  },

  removeMember: async (userId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/auth/users/${userId}`);
  },

  listBranches: async (): Promise<BranchDto[]> => {
    const response = await apiClient.get<BranchDto[]>('/api/v1/auth/branches');
    return response.data;
  },

  createBranch: async (payload: CreateBranchPayload): Promise<BranchDto> => {
    const response = await apiClient.post<BranchDto>('/api/v1/auth/branches', payload);
    return response.data;
  },

  listRoles: async (): Promise<RoleCatalogItem[]> => {
    const response = await apiClient.get<RoleCatalogItem[]>('/api/v1/auth/roles');
    return response.data;
  },

  listPermissions: async (): Promise<PermissionCatalogItem[]> => {
    const response = await apiClient.get<PermissionCatalogItem[]>('/api/v1/auth/permissions');
    return response.data;
  },

  createRole: async (payload: CreateRolePayload): Promise<RoleCatalogItem> => {
    const response = await apiClient.post<RoleCatalogItem>('/api/v1/auth/roles', payload);
    return response.data;
  },

  updateRole: async (roleId: string, payload: UpdateRolePayload): Promise<RoleCatalogItem> => {
    const response = await apiClient.put<RoleCatalogItem>(`/api/v1/auth/roles/${roleId}`, payload);
    return response.data;
  },

  updateRolePermissions: async (
    roleId: string,
    permissions: string[]
  ): Promise<RoleCatalogItem> => {
    const response = await apiClient.put<RoleCatalogItem>(
      `/api/v1/auth/roles/${roleId}/permissions`,
      { permissions }
    );
    return response.data;
  },

  resetRolePermissions: async (roleId: string): Promise<RoleCatalogItem> => {
    const response = await apiClient.delete<RoleCatalogItem>(
      `/api/v1/auth/roles/${roleId}/permissions/override`
    );
    return response.data;
  },

  deleteRole: async (roleId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/auth/roles/${roleId}`);
  },

  getAuditLogs: async (params?: { limit?: number; offset?: number }): Promise<AuthAuditLogsResponse> => {
    const response = await apiClient.get<AuthAuditLogsResponse>('/api/v1/auth/audit-logs', { params });
    return response.data;
  },

  checkGatewayHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  checkServicesStatus: async () => {
    const response = await apiClient.get('/status');
    return response.data;
  },
};

