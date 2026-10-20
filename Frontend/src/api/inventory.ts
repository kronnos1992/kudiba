import { apiClient } from './client';

export interface Product {
  id: string;
  tenant_id: string;
  code: string;
  ref_id?: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  product_type: 'P' | 'S' | 'O' | string;
  is_stockable: boolean;
  track_lots: boolean;
  unit_of_measure: string;
  sale_price: string | number;
  cost_price: string | number;
  current_cmp: string | number;
  tax_type: string;
  tax_code: string;
  tax_percentage: string | number;
  exemption_reason_code: string | null;
  exemption_reason_text: string | null;
  has_withholding_tax: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  code?: string;
  ref_id?: string;
  barcode?: string;
  name: string;
  description?: string;
  product_type?: 'P' | 'S' | 'O';
  is_stockable?: boolean;
  track_lots?: boolean;
  unit_of_measure?: string;
  sale_price: string;
  cost_price?: string;
  tax_percentage?: string;
  exemption_reason_code?: string;
  exemption_reason_text?: string;
  has_withholding_tax?: boolean;
}

export interface UpdateProductPayload {
  ref_id?: string;
  name?: string;
  description?: string;
  barcode?: string;
  unit_of_measure?: string;
  sale_price?: string;
  cost_price?: string;
  tax_percentage?: string;
  exemption_reason_code?: string;
  exemption_reason_text?: string;
  has_withholding_tax?: boolean;
  is_active?: boolean;
}

export interface UpdatePricePayload {
  sale_price: string;
  cost_price?: string;
}

export interface CommercialEntity {
  id: string;
  tenant_id: string;
  entity_type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' | string;
  tax_id: string;
  tax_id_type: string;
  name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  is_withholding_agent: boolean;
  country_code: string;
  province: string | null;
  city: string | null;
  address_detail: string | null;
  iban: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegisterEntityPayload {
  entity_type?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  tax_id: string;
  tax_id_kind: 'LEGAL_ENTITY' | 'NATURAL_PERSON_BI' | 'FINAL_CONSUMER' | 'FOREIGN';
  name: string;
  trade_name?: string;
  email?: string;
  phone?: string;
  is_withholding_agent?: boolean;
  country_code?: string;
  province?: string;
  city?: string;
  address_detail?: string;
  iban?: string;
}

export interface UpdateEntityPayload {
  name?: string;
  trade_name?: string;
  email?: string;
  phone?: string;
  is_withholding_agent?: boolean;
  country_code?: string;
  province?: string;
  city?: string;
  address_detail?: string;
  iban?: string;
  is_active?: boolean;
}

export interface Warehouse {
  id: string;
  tenant_id: string;
  branch_id: string;
  code: string;
  name: string;
  is_default: boolean;
  address_detail: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWarehousePayload {
  branch_id: string;
  code: string;
  name: string;
  is_default?: boolean;
  address_detail?: string;
}

export interface UpdateWarehousePayload {
  name?: string;
  is_default?: boolean;
  address_detail?: string;
  is_active?: boolean;
}

export interface ProductBatch {
  id: string;
  tenant_id: string;
  product_id: string;
  batch_number: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  is_expired: boolean;
  created_at: string;
}

export interface CreateBatchPayload {
  product_id: string;
  batch_number: string;
  manufacture_date?: string;
  expiry_date?: string;
}

export interface StockBalance {
  warehouse_id: string;
  product_id: string;
  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  available_quantity: string | number;
  reorder_point: string | number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  warehouse_id: string;
  product_id: string;
  batch_id: string | null;
  movement_type: string;
  quantity: string | number;
  unit_cost: string | number;
  total_cost: string | number;
  resulting_cmp: string | number;
  document_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReceivePurchasePayload {
  warehouse_id: string;
  product_id: string;
  batch_id?: string;
  quantity: string;
  unit_cost: string;
  document_ref?: string;
  notes?: string;
}

export interface TransferStockPayload {
  from_warehouse_id: string;
  to_warehouse_id: string;
  product_id: string;
  batch_id?: string;
  quantity: string;
  notes?: string;
}

export interface AdjustStockPayload {
  warehouse_id: string;
  product_id: string;
  batch_id?: string;
  quantity_delta: string;
  is_waste?: boolean;
  document_ref?: string;
  notes?: string;
}

export const inventoryApi = {
  // Produtos
  listProducts: async (params?: { limit?: number; offset?: number }): Promise<Product[]> => {
    const res = await apiClient.get<Product[]>('/api/v1/inventory/products', { params });
    return res.data;
  },

  getProduct: async (id: string): Promise<Product> => {
    const res = await apiClient.get<Product>(`/api/v1/inventory/products/${id}`);
    return res.data;
  },

  getProductByCode: async (code: string): Promise<Product> => {
    const res = await apiClient.get<Product>(`/api/v1/inventory/products/by-code/${code}`);
    return res.data;
  },

  createProduct: async (payload: CreateProductPayload): Promise<Product> => {
    const res = await apiClient.post<Product>('/api/v1/inventory/products', payload);
    return res.data;
  },

  updateProduct: async (id: string, payload: UpdateProductPayload): Promise<Product> => {
    const res = await apiClient.put<Product>(`/api/v1/inventory/products/${id}`, payload);
    return res.data;
  },

  updateProductPrice: async (id: string, payload: UpdatePricePayload): Promise<Product> => {
    const res = await apiClient.patch<Product>(`/api/v1/inventory/products/${id}/price`, payload);
    return res.data;
  },

  // Armazéns
  listWarehouses: async (): Promise<Warehouse[]> => {
    const res = await apiClient.get<Warehouse[]>('/api/v1/inventory/warehouses');
    return res.data;
  },

  createWarehouse: async (payload: CreateWarehousePayload): Promise<Warehouse> => {
    const res = await apiClient.post<Warehouse>('/api/v1/inventory/warehouses', payload);
    return res.data;
  },

  updateWarehouse: async (id: string, payload: UpdateWarehousePayload): Promise<Warehouse> => {
    const res = await apiClient.put<Warehouse>(`/api/v1/inventory/warehouses/${id}`, payload);
    return res.data;
  },

  // Lotes
  listBatchesByProduct: async (productId: string): Promise<ProductBatch[]> => {
    const res = await apiClient.get<ProductBatch[]>(`/api/v1/inventory/products/${productId}/batches`);
    return res.data;
  },

  createBatch: async (payload: CreateBatchPayload): Promise<ProductBatch> => {
    const res = await apiClient.post<ProductBatch>('/api/v1/inventory/batches', payload);
    return res.data;
  },

  // Saldos e Movimentos
  listAllStockBalances: async (): Promise<StockBalance[]> => {
    const res = await apiClient.get<StockBalance[]>('/api/v1/inventory/stock');
    return res.data;
  },

  getStockBalance: async (productId: string): Promise<StockBalance[]> => {
    const res = await apiClient.get<StockBalance[]>(`/api/v1/inventory/stock/${productId}`);
    return res.data;
  },

  getStockBalanceAtWarehouse: async (productId: string, warehouseId: string): Promise<StockBalance> => {
    const res = await apiClient.get<StockBalance>(`/api/v1/inventory/stock/${productId}/warehouses/${warehouseId}`);
    return res.data;
  },

  listMovements: async (params?: { product_id?: string; warehouse_id?: string; limit?: number }): Promise<StockMovement[]> => {
    const res = await apiClient.get<StockMovement[]>('/api/v1/inventory/movements', { params });
    return res.data;
  },

  receivePurchase: async (payload: ReceivePurchasePayload): Promise<StockMovement> => {
    const res = await apiClient.post<StockMovement>('/api/v1/inventory/movements/purchase', payload);
    return res.data;
  },

  transferStock: async (payload: TransferStockPayload): Promise<StockMovement> => {
    const res = await apiClient.post<StockMovement>('/api/v1/inventory/movements/transfer', payload);
    return res.data;
  },

  adjustStock: async (payload: AdjustStockPayload): Promise<StockMovement> => {
    const res = await apiClient.post<StockMovement>('/api/v1/inventory/movements/adjust', payload);
    return res.data;
  },

  // Entidades (Clientes / Fornecedores)
  listEntities: async (params?: { limit?: number; offset?: number }): Promise<CommercialEntity[]> => {
    const res = await apiClient.get<CommercialEntity[]>('/api/v1/inventory/entities', { params });
    return res.data;
  },

  getEntityByTaxId: async (taxId: string): Promise<CommercialEntity> => {
    const res = await apiClient.get<CommercialEntity>(`/api/v1/inventory/entities/by-tax-id/${taxId}`);
    return res.data;
  },

  registerEntity: async (payload: RegisterEntityPayload): Promise<CommercialEntity> => {
    const res = await apiClient.post<CommercialEntity>('/api/v1/inventory/entities', payload);
    return res.data;
  },

  updateEntity: async (id: string, payload: UpdateEntityPayload): Promise<CommercialEntity> => {
    const res = await apiClient.put<CommercialEntity>(`/api/v1/inventory/entities/${id}`, payload);
    return res.data;
  },

  getDashboardSummary: async (): Promise<any> => {
    const res = await apiClient.get('/api/v1/inventory/dashboard/summary');
    return res.data;
  },

  processInvoiceIssued: async (payload: {
    invoiceId: string;
    tenantId: string;
    documentNumber: string;
    documentType: string;
    lines: Array<{
      lineNumber: number;
      productCode: string;
      description: string;
      quantity: number;
      unitPrice?: number;
    }>;
  }): Promise<any> => {
    const res = await apiClient.post('/api/v1/inventory/events/invoice-issued', payload);
    return res.data;
  },
};
