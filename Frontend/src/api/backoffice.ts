import { apiClient } from './client';
import {
  BackofficeClient,
  BackofficeModule,
  CreateClientPayload,
  RenewLicensePayload,
  UpdateClientPayload,
} from '../types/backoffice';

export const backofficeApi = {
  listModules: async (): Promise<BackofficeModule[]> => {
    const res = await apiClient.get<BackofficeModule[]>('/api/v1/backoffice/modules');
    return res.data;
  },

  listClients: async (params?: { search?: string; status?: string }): Promise<BackofficeClient[]> => {
    const res = await apiClient.get<BackofficeClient[]>('/api/v1/backoffice/clients', { params });
    return res.data;
  },

  getClient: async (id: string): Promise<BackofficeClient> => {
    const res = await apiClient.get<BackofficeClient>(`/api/v1/backoffice/clients/${id}`);
    return res.data;
  },

  createClient: async (payload: CreateClientPayload): Promise<BackofficeClient> => {
    const res = await apiClient.post<BackofficeClient>('/api/v1/backoffice/clients', payload);
    return res.data;
  },

  updateClient: async (id: string, payload: UpdateClientPayload): Promise<BackofficeClient> => {
    const res = await apiClient.patch<BackofficeClient>(
      `/api/v1/backoffice/clients/${id}`,
      payload
    );
    return res.data;
  },

  renewLicense: async (clientId: string, payload: RenewLicensePayload): Promise<BackofficeClient> => {
    const res = await apiClient.post<BackofficeClient>(
      `/api/v1/backoffice/clients/${clientId}/licenses`,
      payload
    );
    return res.data;
  },

  suspendClient: async (clientId: string): Promise<BackofficeClient> => {
    const res = await apiClient.post<BackofficeClient>(
      `/api/v1/backoffice/clients/${clientId}/suspend`
    );
    return res.data;
  },

  activateClient: async (clientId: string): Promise<BackofficeClient> => {
    const res = await apiClient.post<BackofficeClient>(
      `/api/v1/backoffice/clients/${clientId}/activate`
    );
    return res.data;
  },

  getSummary: async (): Promise<import('../types/backoffice').PlatformSummary> => {
    const res = await apiClient.get<import('../types/backoffice').PlatformSummary>(
      '/api/v1/backoffice/summary'
    );
    return res.data;
  },
};
