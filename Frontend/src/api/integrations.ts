import { apiClient } from './client';

export type ConnectorType = 'REST_PULL' | 'WEBHOOK' | 'FILE_UPLOAD';
export type DataFormat = 'JSON' | 'CSV' | 'XML' | 'FIXED_WIDTH';
export type AuthType = 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC';
export type ConflictPolicy = 'OVERWRITE' | 'SKIP' | 'FAIL';

export interface EndpointResponse {
  id: string;
  tenant_id: string;
  name: string;
  system_type: string;
  connector_type: ConnectorType;
  description?: string | null;
  is_enabled: boolean;
  auth_type: AuthType;
  has_credentials?: boolean;
  webhook_key?: string | null;
  webhook_header_name?: string | null;
  source_url?: string | null;
  http_method: string;
  request_headers?: Record<string, any>;
  query_params?: Record<string, any>;
  schedule_interval_seconds?: number | null;
  data_format: DataFormat;
  file_delimiter?: string | null;
  file_has_header: boolean;
  file_encoding: string;
  last_run_at?: string | null;
  created_at?: string | null;
}

export interface CreateEndpointPayload {
  name: string;
  system_type: string;
  connector_type: ConnectorType;
  description?: string;
  is_enabled?: boolean;
  auth_type?: AuthType;
  credentials?: Record<string, any>;
  source_url?: string;
  http_method?: string;
  schedule_interval_seconds?: number;
  data_format?: DataFormat;
  file_delimiter?: string;
  file_has_header?: boolean;
  file_encoding?: string;
}

export interface MappingField {
  source_path: string;
  target_field: string;
  transform_rule?: string;
  default_value?: any;
  is_required?: boolean;
}

export interface MappingResponse {
  id: string;
  tenant_id: string;
  endpoint_id: string;
  name: string;
  entity_type: string;
  target_event_type: string;
  target_routing_key: string;
  is_enabled: boolean;
  root_path?: string | null;
  fields: MappingField[];
  conflict_policy: ConflictPolicy;
}

export interface CreateMappingPayload {
  name: string;
  entity_type: string;
  target_event_type: string;
  target_routing_key: string;
  is_enabled?: boolean;
  root_path?: string;
  fields: MappingField[];
  conflict_policy?: ConflictPolicy;
}

export interface RunResponse {
  id: string;
  tenant_id: string;
  endpoint_id: string;
  trigger_type: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | string;
  started_at: string;
  finished_at?: string | null;
  records_received: number;
  records_succeeded: number;
  records_failed: number;
  records_skipped: number;
  error_message?: string | null;
  audit_details?: Record<string, any>;
}

export const integrationsApi = {
  listEndpoints: async (): Promise<EndpointResponse[]> => {
    const res = await apiClient.get<EndpointResponse[]>('/api/v1/integrations/endpoints');
    return res.data;
  },

  createEndpoint: async (payload: CreateEndpointPayload): Promise<EndpointResponse> => {
    const res = await apiClient.post<EndpointResponse>('/api/v1/integrations/endpoints', payload);
    return res.data;
  },

  getEndpoint: async (id: string): Promise<EndpointResponse> => {
    const res = await apiClient.get<EndpointResponse>(`/api/v1/integrations/endpoints/${id}`);
    return res.data;
  },

  updateEndpoint: async (
    id: string,
    payload: Partial<CreateEndpointPayload>
  ): Promise<EndpointResponse> => {
    const res = await apiClient.put<EndpointResponse>(
      `/api/v1/integrations/endpoints/${id}`,
      payload
    );
    return res.data;
  },

  deleteEndpoint: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/integrations/endpoints/${id}`);
  },

  listMappings: async (endpointId?: string): Promise<MappingResponse[]> => {
    const res = await apiClient.get<MappingResponse[]>('/api/v1/integrations/mappings', {
      params: { endpoint_id: endpointId },
    });
    return res.data;
  },

  createMapping: async (
    endpointId: string,
    payload: CreateMappingPayload
  ): Promise<MappingResponse> => {
    const res = await apiClient.post<MappingResponse>(
      `/api/v1/integrations/endpoints/${endpointId}/mappings`,
      payload
    );
    return res.data;
  },

  deleteMapping: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/integrations/mappings/${id}`);
  },

  listRuns: async (params?: { endpoint_id?: string; limit?: number }): Promise<RunResponse[]> => {
    const res = await apiClient.get<RunResponse[]>('/api/v1/integrations/runs', { params });
    return res.data;
  },

  runEndpointNow: async (endpointId: string): Promise<RunResponse> => {
    const res = await apiClient.post<RunResponse>(
      `/api/v1/integrations/endpoints/${endpointId}/run`
    );
    return res.data;
  },

  importFile: async (
    endpointId: string,
    fileContent: string | Blob,
    contentType: string = 'text/plain'
  ): Promise<RunResponse> => {
    const res = await apiClient.post<RunResponse>(
      `/api/v1/integrations/endpoints/${endpointId}/import`,
      fileContent,
      {
        headers: {
          'Content-Type': contentType,
        },
      }
    );
    return res.data;
  },
};
