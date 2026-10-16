import { apiClient } from './client';
import { LoginResponse, User } from '../types/auth';

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
  description: string;
  permissions: string[];
}

export interface BranchDto {
  id: string;
  code: string;
  name: string;
  city?: string | null;
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

  listBranches: async (): Promise<BranchDto[]> => {
    const response = await apiClient.get<BranchDto[]>('/api/v1/auth/branches');
    return response.data;
  },

  listRoles: async (): Promise<RoleCatalogItem[]> => {
    const response = await apiClient.get<RoleCatalogItem[]>('/api/v1/auth/roles');
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
