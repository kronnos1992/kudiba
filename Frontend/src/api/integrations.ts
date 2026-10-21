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
  column_widths?: Array<Record<string, any>>;
  last_run_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateEndpointPayload {
  name: string;
  system_type: string;
  connector_type: ConnectorType;
  description?: string;
  is_enabled?: boolean;
  auth_type?: AuthType;
  credentials?: Record<string, any>;
  webhook_header_name?: string;
  webhook_secret?: string;
  source_url?: string;
  http_method?: string;
  request_headers?: Record<string, any>;
  query_params?: Record<string, any>;
  schedule_interval_seconds?: number;
  data_format?: DataFormat;
  file_delimiter?: string;
  file_has_header?: boolean;
  file_encoding?: string;
  column_widths?: Array<Record<string, any>>;
}

export interface MappingField {
  source?: string;
  source_path?: string;
  target?: string;
  target_field?: string;
  type?: 'string' | 'int' | 'float' | 'decimal' | 'bool' | 'datetime' | 'date';
  transform?: 'trim' | 'upper' | 'lower' | 'title' | string;
  transform_rule?: string;
  default?: any;
  default_value?: any;
  required?: boolean;
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
  record_path?: string | null;
  root_path?: string | null;
  field_mappings: MappingField[];
  fields?: MappingField[];
  static_payload?: Record<string, any>;
  dedup_fields?: string[];
  conflict_policy: ConflictPolicy;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateMappingPayload {
  name: string;
  entity_type: string;
  target_event_type: string;
  target_routing_key: string;
  is_enabled?: boolean;
  record_path?: string;
  root_path?: string;
  field_mappings?: MappingField[];
  fields?: MappingField[];
  static_payload?: Record<string, any>;
  dedup_fields?: string[];
  conflict_policy?: ConflictPolicy;
}

export interface RunResponse {
  id: string;
  tenant_id: string;
  endpoint_id: string;
  mapping_id?: string | null;
  trigger: string;
  trigger_type?: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | string;
  started_at: string;
  finished_at?: string | null;
  records_received: number;
  records_succeeded: number;
  records_failed: number;
  records_skipped: number;
  message?: string | null;
  error_message?: string | null;
  audit_details?: Record<string, any>;
  created_at?: string | null;
}

export interface IntegrationTemplate {
  id: string;
  title: string;
  subtitle: string;
  system_type: string;
  connector_type: ConnectorType;
  data_format: DataFormat;
  entity_type: string;
  endpoint: CreateEndpointPayload;
  mapping: CreateMappingPayload;
  sampleData: string;
}

export const INTEGRATION_TEMPLATES: IntegrationTemplate[] = [
  {
    id: 'primavera_products',
    title: 'Primavera ERP — Catálogo & Stocks',
    subtitle: 'Sincronização periódica REST Pull de artigos, preços e existências',
    system_type: 'PRIMAVERA',
    connector_type: 'REST_PULL',
    data_format: 'JSON',
    entity_type: 'PRODUCT',
    endpoint: {
      name: 'Primavera ERP — Catálogo Artigos',
      system_type: 'PRIMAVERA',
      connector_type: 'REST_PULL',
      description: 'Consulta periódica da API do Primavera ERP para atualização do catálogo Kudiba',
      auth_type: 'BEARER',
      source_url: 'https://api.erp.externo.ao/v1/artigos',
      http_method: 'GET',
      data_format: 'JSON',
      schedule_interval_seconds: 3600,
      is_enabled: true,
    },
    mapping: {
      name: 'Mapeamento Artigos Primavera -> Kudiba',
      entity_type: 'PRODUCT',
      target_event_type: 'inventory.product.imported',
      target_routing_key: 'kudiba.inventory.catalog_sync',
      record_path: 'data.items',
      conflict_policy: 'OVERWRITE',
      field_mappings: [
        { source: 'id_artigo', target: 'code', type: 'string', transform: 'trim', required: true },
        { source: 'descricao', target: 'name', type: 'string', transform: 'trim', required: true },
        { source: 'preco_venda', target: 'unit_price', type: 'decimal', required: true },
        { source: 'taxa_iva', target: 'tax_rate', type: 'decimal', default: 14 },
        { source: 'codigo_barras', target: 'barcode', type: 'string' },
        { source: 'stock_armazem', target: 'stock_quantity', type: 'decimal', default: 0 },
      ],
    },
    sampleData: JSON.stringify(
      {
        data: {
          items: [
            {
              id_artigo: 'ART001',
              descricao: 'Arroz Agulha 25kg',
              preco_venda: 22500.0,
              taxa_iva: 14.0,
              codigo_barras: '5601234567890',
              stock_armazem: 150,
            },
            {
              id_artigo: 'ART002',
              descricao: 'Óleo Alimentar 5 Litros',
              preco_venda: 8400.0,
              taxa_iva: 14.0,
              codigo_barras: '5601234567891',
              stock_armazem: 80,
            },
          ],
        },
      },
      null,
      2
    ),
  },
  {
    id: 'phc_csv_products',
    title: 'PHC Software — Importação CSV',
    subtitle: 'Importação rápida de ficheiros delimitados por ponto-e-vírgula (;)',
    system_type: 'PHC',
    connector_type: 'FILE_UPLOAD',
    data_format: 'CSV',
    entity_type: 'PRODUCT',
    endpoint: {
      name: 'PHC Software — Ficheiro CSV Artigos',
      system_type: 'PHC',
      connector_type: 'FILE_UPLOAD',
      description: 'Importação de listas de preços e artigos exportadas do PHC em formato CSV',
      auth_type: 'NONE',
      data_format: 'CSV',
      file_delimiter: ';',
      file_has_header: true,
      file_encoding: 'utf-8',
      is_enabled: true,
    },
    mapping: {
      name: 'Mapeamento CSV PHC -> Kudiba',
      entity_type: 'PRODUCT',
      target_event_type: 'inventory.product.imported',
      target_routing_key: 'kudiba.inventory.catalog_sync',
      record_path: '',
      conflict_policy: 'OVERWRITE',
      field_mappings: [
        { source: 'Referencia', target: 'code', type: 'string', transform: 'trim', required: true },
        { source: 'Designacao', target: 'name', type: 'string', transform: 'trim', required: true },
        { source: 'PVP1', target: 'unit_price', type: 'decimal', required: true },
        { source: 'TaxaIVA', target: 'tax_rate', type: 'decimal', default: 14 },
        { source: 'CodigoBarras', target: 'barcode', type: 'string' },
      ],
    },
    sampleData: `Referencia;Designacao;PVP1;TaxaIVA;CodigoBarras\nART-PHC-101;Leite UHT 1 Litro;1250.00;14;560999888111\nART-PHC-102;Farinha de Trigo 1kg;950.00;14;560999888222\nART-PHC-103;Açúcar Branco 1kg;1100.00;14;560999888333`,
  },
  {
    id: 'shopify_webhook',
    title: 'Shopify / WooCommerce — Webhook',
    subtitle: 'Receção em tempo real de novas encomendas para faturação e POS',
    system_type: 'SHOPIFY',
    connector_type: 'WEBHOOK',
    data_format: 'JSON',
    entity_type: 'INVOICE',
    endpoint: {
      name: 'Shopify / Loja Online — Webhook Orders',
      system_type: 'SHOPIFY',
      connector_type: 'WEBHOOK',
      description: 'Webhook instantâneo disparado na confirmação de pedidos na loja virtual',
      auth_type: 'API_KEY',
      webhook_header_name: 'X-Shopify-Hmac-Sha256',
      data_format: 'JSON',
      is_enabled: true,
    },
    mapping: {
      name: 'Mapeamento Pedidos Online -> Fatura Kudiba',
      entity_type: 'INVOICE',
      target_event_type: 'invoice.issued',
      target_routing_key: 'kudiba.invoicing.order_imported',
      record_path: '',
      conflict_policy: 'SKIP',
      field_mappings: [
        { source: 'order_number', target: 'invoice_number', type: 'string', required: true },
        { source: 'customer.first_name', target: 'customer_name', type: 'string', required: true },
        { source: 'customer.tax_id', target: 'customer_tax_id', type: 'string', default: '999999999' },
        { source: 'total_price', target: 'total_amount', type: 'decimal', required: true },
        { source: 'total_tax', target: 'tax_amount', type: 'decimal', default: 0 },
      ],
    },
    sampleData: JSON.stringify(
      {
        order_number: 'WEB-1092',
        created_at: '2026-10-21T08:00:00Z',
        total_price: '45000.00',
        total_tax: '5526.32',
        customer: {
          first_name: 'António Agostinho',
          tax_id: '5401239999',
          email: 'antonio@empresa.ao',
        },
      },
      null,
      2
    ),
  },
  {
    id: 'universal_csv_customers',
    title: 'Folha Excel / CSV — Clientes & NIFs',
    subtitle: 'Importação em lote de carteira de clientes com NIF e contactos',
    system_type: 'EXCEL_CSV',
    connector_type: 'FILE_UPLOAD',
    data_format: 'CSV',
    entity_type: 'CUSTOMER',
    endpoint: {
      name: 'Folha Excel / CSV — Carteira Clientes',
      system_type: 'EXCEL_CSV',
      connector_type: 'FILE_UPLOAD',
      description: 'Carregamento em lote de clientes com NIF, morada e contacto',
      auth_type: 'NONE',
      data_format: 'CSV',
      file_delimiter: ';',
      file_has_header: true,
      file_encoding: 'utf-8',
      is_enabled: true,
    },
    mapping: {
      name: 'Mapeamento Clientes CSV -> Kudiba',
      entity_type: 'CUSTOMER',
      target_event_type: 'customer.created',
      target_routing_key: 'kudiba.core.customer_sync',
      record_path: '',
      conflict_policy: 'OVERWRITE',
      field_mappings: [
        { source: 'NIF', target: 'tax_id', type: 'string', transform: 'trim', required: true },
        { source: 'NomeCliente', target: 'name', type: 'string', transform: 'trim', required: true },
        { source: 'Telefone', target: 'phone', type: 'string' },
        { source: 'Email', target: 'email', type: 'string', transform: 'lower' },
        { source: 'Cidade', target: 'city', type: 'string', default: 'Luanda' },
      ],
    },
    sampleData: `NIF;NomeCliente;Telefone;Email;Cidade\n5418889999;Comercial Esperança Lda;+244 923 111 222;comercial@esperanca.ao;Luanda\n5427771111;Supermercados do Sul SA;+244 912 333 444;compras@sul.ao;Benguela\n5409990000;Mecânica Central Luanda;+244 933 555 666;financeiro@mecanica.ao;Luanda`,
  },
];

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
    return (res.data || []).map((m) => ({
      ...m,
      field_mappings: m.field_mappings || m.fields || [],
      fields: m.field_mappings || m.fields || [],
      record_path: m.record_path || m.root_path || '',
    }));
  },

  createMapping: async (
    endpointId: string,
    payload: CreateMappingPayload
  ): Promise<MappingResponse> => {
    const rawFields = payload.field_mappings || payload.fields || [];
    const formattedFields = rawFields.map((f) => ({
      source: f.source || f.source_path || '',
      target: f.target || f.target_field || '',
      type: f.type || 'string',
      transform: f.transform || f.transform_rule || null,
      default: f.default ?? f.default_value ?? null,
      required: f.required ?? f.is_required ?? false,
    }));

    const formattedPayload = {
      name: payload.name,
      entity_type: payload.entity_type,
      target_event_type: payload.target_event_type,
      target_routing_key: payload.target_routing_key,
      is_enabled: payload.is_enabled ?? true,
      record_path: payload.record_path || payload.root_path || null,
      field_mappings: formattedFields,
      static_payload: payload.static_payload || {},
      dedup_fields: payload.dedup_fields || [],
      conflict_policy: payload.conflict_policy || 'SKIP',
    };

    const res = await apiClient.post<MappingResponse>(
      `/api/v1/integrations/endpoints/${endpointId}/mappings`,
      formattedPayload
    );
    return {
      ...res.data,
      field_mappings: res.data.field_mappings || res.data.fields || [],
      fields: res.data.field_mappings || res.data.fields || [],
    };
  },

  deleteMapping: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/integrations/mappings/${id}`);
  },

  listRuns: async (params?: { endpoint_id?: string; limit?: number }): Promise<RunResponse[]> => {
    const res = await apiClient.get<RunResponse[]>('/api/v1/integrations/runs', { params });
    return (res.data || []).map((r) => ({
      ...r,
      trigger: r.trigger || r.trigger_type || 'MANUAL',
      trigger_type: r.trigger || r.trigger_type || 'MANUAL',
      message: r.message || r.error_message || null,
      error_message: r.message || r.error_message || null,
    }));
  },

  runEndpointNow: async (endpointId: string): Promise<RunResponse> => {
    const res = await apiClient.post<RunResponse>(
      `/api/v1/integrations/endpoints/${endpointId}/run`
    );
    return {
      ...res.data,
      trigger: res.data.trigger || res.data.trigger_type || 'MANUAL',
      trigger_type: res.data.trigger || res.data.trigger_type || 'MANUAL',
      message: res.data.message || res.data.error_message || null,
    };
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
    return {
      ...res.data,
      trigger: res.data.trigger || res.data.trigger_type || 'FILE_UPLOAD',
      trigger_type: res.data.trigger || res.data.trigger_type || 'FILE_UPLOAD',
      message: res.data.message || res.data.error_message || null,
    };
  },

  installTemplate: async (
    template: IntegrationTemplate
  ): Promise<{ endpoint: EndpointResponse; mapping: MappingResponse }> => {
    const endpoint = await integrationsApi.createEndpoint(template.endpoint);
    const mapping = await integrationsApi.createMapping(endpoint.id, template.mapping);
    return { endpoint, mapping };
  },
};
