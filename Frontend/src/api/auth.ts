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

  checkGatewayHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  checkServicesStatus: async () => {
    const response = await apiClient.get('/status');
    return response.data;
  },
};
