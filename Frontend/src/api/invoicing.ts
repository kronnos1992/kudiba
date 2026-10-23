import { apiClient } from './client';

export interface InvoiceLine {
  id?: string;
  lineNumber?: number;
  productCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxRate: number;
  taxExemptionCode?: string | null;
  isService?: boolean;
  lineTotal?: number;
}

export interface Invoice {
  id: string;
  tenantId: string;
  issuerNif: string;
  issuerAddress: string;
  issuerCity: string;
  issuerCountry: string;
  seriesId: string;
  documentNumber: string;
  sequenceNumber: number;
  documentType: 'FT' | 'FR' | 'NC' | 'ND' | 'GT' | 'GR';
  customerName: string;
  customerNif?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerCountry?: string | null;
  sourceDocumentNumber?: string | null;
  paymentMethods: string[];
  currency: string;
  netTotal: number;
  taxTotal: number;
  grossTotal: number;
  withholdingTotal: number;
  stampDutyTotal: number;
  amountDue: number;
  hashSha256: string;
  signatureRsaBase64: string;
  validationChars: string;
  keyVersion: string;
  isContingency: boolean;
  taxRegimeCode: string;
  issuedAt: string;
  systemEntryDate: string;
  createdAt: string;
  lines: InvoiceLine[];
}

export interface IssueInvoicePayload {
  tenantId: string;
  documentType: string;
  seriesCode: string;
  fiscalYear: number;
  cashSessionId?: string;
  idempotencyKey?: string;
  customerName: string;
  customerNif?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCountry?: string;
  sourceDocumentNumber?: string;
  paymentMethods: string[];
  applyWithholding?: boolean;
  withholdingRate?: number;
  vehiclePlateNumber?: string;
  loadingAddress?: string;
  loadingCity?: string;
  loadingDateTime?: string;
  unloadingAddress?: string;
  unloadingCity?: string;
  unloadingDateTime?: string;
  lines: Array<{
    productCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRate: number;
    taxExemptionCode?: string;
    isService?: boolean;
  }>;
}

export interface FiscalSeries {
  id: string;
  tenantId: string;
  documentType: string;
  seriesCode: string;
  fiscalYear: number;
  currentSequence: number;
  isActive: boolean;
}

export interface TaxRegime {
  regimeCode: string;
  displayName: string;
  standardRate: number;
  allowedRates: number[];
  isVatExempt: boolean;
  allowsInputVatCredit: boolean;
  requiresCreditNote: boolean;
  minTurnover: number;
  maxTurnover?: number | null;
}

export interface IssueInvoiceResult {
  id?: string;
  invoiceId: string;
  documentNumber: string;
  sequenceNumber: number;
  netTotal: number;
  taxTotal: number;
  grossTotal: number;
  withholdingTotal: number;
  stampDutyTotal: number;
  amountDue: number;
  hashSha256: string;
  signatureRsaBase64: string;
  validationChars: string;
  issuedAt: string;
  systemEntryDate: string;
  isContingency: boolean;
}

export interface PosTaxBreakdown {
  taxRate: number;
  taxableBase: number;
  taxAmount: number;
}

export interface FiscalAuditTrailItem {
  audit_id: string;
  tenant_id: string;
  table_name: string;
  action: 'INSERT' | 'ATTEMPTED_UPDATE' | 'ATTEMPTED_DELETE' | string;
  document_reference: string | null;
  payload: Record<string, any>;
  actor_user_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface FiscalAuditTrailResponse {
  items: FiscalAuditTrailItem[];
  total: number;
}

export interface SystemAuditTrailEntry {
  id: string;
  tenant_id: string;
  module: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  document_reference: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  ip_address: string | null;
  details: Record<string, any>;
  created_at: string;
}

export interface SystemAuditTrailResponse {
  items: SystemAuditTrailEntry[];
  total: number;
}

export interface PosPaymentBreakdown {
  paymentMethod: string;
  paymentMethodName: string;
  totalAmount: number;
  transactionCount: number;
}

export interface PosDailyReportResult {
  reportType: 'LEITURA_X' | 'FECHO_Z' | string;
  tenantId: string;
  companyName: string;
  companyNif: string;
  agtCertNumber: string;
  date: string;
  generatedAt: string;
  zReportSequence?: number | null;
  zReportNumber?: string | null;
  posTerminalId?: string | null;
  firstDocumentNumber?: string | null;
  lastDocumentNumber?: string | null;
  invoicesCount: number;
  creditNotesCount: number;
  grossSalesTotal: number;
  discountsTotal: number;
  creditNotesTotal: number;
  netSalesTotal: number;
  vatTotal: number;
  withholdingTotal: number;
  stampDutyTotal: number;
  finalTotal: number;
  taxes: PosTaxBreakdown[];
  payments: PosPaymentBreakdown[];
}

export interface PosZReportSummary {
  id: string;
  fiscalYear: number;
  sequenceNumber: number;
  zNumber: string;
  closingDate: string;
  posTerminalId?: string | null;
  openedAt: string;
  closedAt: string;
  firstDocumentNumber?: string | null;
  lastDocumentNumber?: string | null;
  invoicesCount: number;
  creditNotesCount: number;
  grossSalesTotal: number;
  netSalesTotal: number;
  vatTotal: number;
  finalTotal: number;
  actorUserId?: string | null;
  taxes: PosTaxBreakdown[];
  payments: PosPaymentBreakdown[];
}

export const invoicingApi = {
  listInvoices: async (params?: {
    fiscalYear?: number;
    fiscalMonth?: number;
    offset?: number;
    limit?: number;
  }): Promise<Invoice[]> => {
    const response = await apiClient.get<Invoice[]>('/api/v1/fiscal/invoices', { params });
    return response.data;
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get<Invoice>(`/api/v1/fiscal/invoices/${id}`);
    return response.data;
  },

  issueInvoice: async (payload: IssueInvoicePayload): Promise<IssueInvoiceResult & Partial<Invoice>> => {
    const headers: Record<string, string> = { 'X-Tenant-ID': payload.tenantId };
    if (payload.cashSessionId) {
      headers['X-Cash-Session-ID'] = payload.cashSessionId;
    }
    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey;
    }
    const response = await apiClient.post<IssueInvoiceResult & Partial<Invoice>>(
      '/api/v1/fiscal/invoices',
      payload,
      { headers }
    );
    const data = response.data;
    if (data.invoiceId && !data.id) {
      data.id = data.invoiceId;
    }
    return data;
  },

  cancelInvoice: async (
    id: string,
    payload: { tenantId: string; reason: string; seriesCode?: string }
  ): Promise<any> => {
    const response = await apiClient.post(`/api/v1/fiscal/invoices/${id}/cancel`, payload);
    return response.data;
  },

  listSeries: async (): Promise<FiscalSeries[]> => {
    const response = await apiClient.get<FiscalSeries[]>('/api/v1/fiscal/series');
    return response.data;
  },

  createSeries: async (payload: {
    tenantId: string;
    documentType: string;
    seriesCode: string;
    fiscalYear: number;
  }): Promise<{ seriesId: string }> => {
    const response = await apiClient.post<{ seriesId: string }>('/api/v1/fiscal/series', payload);
    return response.data;
  },

  listTaxRegimes: async (): Promise<{ regimes: TaxRegime[] }> => {
    const response = await apiClient.get<{ regimes: TaxRegime[] }>('/api/v1/fiscal/tax-regimes');
    return response.data;
  },

  exportSaftXml: async (params: {
    tenantId: string;
    year: number;
    month?: number;
  }): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/fiscal/saft', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  validateSaftXml: async (
    xmlContent: string
  ): Promise<{ isValid: boolean; errors?: string[] }> => {
    try {
      const response = await apiClient.post<{ valid: boolean; message?: string; error?: string }>(
        '/api/v1/fiscal/saft/validate',
        { xml_content: xmlContent }
      );
      return response.data.valid
        ? { isValid: true }
        : {
            isValid: false,
            errors: (response.data.error || 'Ficheiro fora de conformidade.')
              .replace(/^[^:]*:\s*/, '')
              .split('|')
              .map((e) => e.trim())
              .filter(Boolean),
          };
    } catch (err: any) {
      const detail = err?.response?.data?.error || err?.response?.data?.detail;
      return { isValid: false, errors: [detail || 'Erro ao validar o SAF-T.'] };
    }
  },

  getInvoicePdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/v1/fiscal/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getInvoicePdfByNumber: async (documentNumber: string): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/fiscal/invoices/pdf-by-number', {
      params: { documentNumber },
      responseType: 'blob',
    });
    return response.data;
  },

  getInvoiceThermal: async (id: string): Promise<string> => {
    const response = await apiClient.get(`/api/v1/fiscal/invoices/${id}/thermal`, {
      params: { format: 'text' },
      responseType: 'text',
    });
    return response.data;
  },

  getInvoiceThermalPdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/v1/fiscal/invoices/${id}/thermal`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    });
    return response.data;
  },

  getLeituraX: async (posTerminalId?: string): Promise<string> => {
    const response = await apiClient.get('/api/v1/fiscal/pos/reports/x/thermal', {
      params: { posTerminalId, format: 'text' },
      responseType: 'text',
    });
    return response.data;
  },

  getLeituraXReport: async (posTerminalId?: string): Promise<PosDailyReportResult> => {
    const response = await apiClient.get<PosDailyReportResult>('/api/v1/fiscal/pos/reports/x', {
      params: { posTerminalId },
    });
    return response.data;
  },

  postFechoZ: async (payload: { posTerminalId?: string; seriesCode?: string }): Promise<PosDailyReportResult> => {
    const response = await apiClient.post<PosDailyReportResult>('/api/v1/fiscal/pos/reports/z', {
      posTerminalId: payload.posTerminalId || payload.seriesCode,
    });
    return response.data;
  },

  getZReports: async (params?: {
    posTerminalId?: string;
    date?: string;
  }): Promise<PosZReportSummary[]> => {
    const response = await apiClient.get<PosZReportSummary[]>('/api/v1/fiscal/pos/reports', {
      params,
    });
    return response.data;
  },

  getTaxReportPdf: async (params: {
    tenantId: string;
    year: number;
    month?: number;
  }): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/fiscal/reports/tax/pdf', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  getTaxReportExcel: async (params: {
    tenantId: string;
    year: number;
    month?: number;
  }): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/fiscal/reports/tax/excel', {
      params,
      responseType: 'blob',
    });
    return response.data;
  },

  getDashboardSummary: async (year?: number): Promise<any> => {
    const response = await apiClient.get('/api/v1/fiscal/dashboard/summary', {
      params: year ? { year } : undefined,
    });
    return response.data;
  },

  getProducts: async (): Promise<any[]> => {
    const response = await apiClient.get('/api/v1/inventory/products');
    return response.data;
  },

  getFiscalTenant: async (): Promise<any> => {
    const response = await apiClient.get('/api/v1/fiscal/tenant');
    return response.data;
  },

  syncFiscalTenant: async (payload: Record<string, any>): Promise<any> => {
    const response = await apiClient.put('/api/v1/fiscal/tenant', payload);
    return response.data;
  },

  getFiscalAuditTrail: async (params?: {
    tenantId?: string;
    limit?: number;
    offset?: number;
    action?: string;
  }): Promise<FiscalAuditTrailResponse> => {
    const response = await apiClient.get<FiscalAuditTrailResponse>('/api/v1/fiscal/audit-trail', {
      params: {
        tenantId: params?.tenantId,
        limit: params?.limit,
        offset: params?.offset,
        action: params?.action,
      },
    });
    return response.data;
  },

  getSystemAuditTrail: async (params?: {
    tenantId?: string;
    module?: string;
    action?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<SystemAuditTrailResponse> => {
    const response = await apiClient.get<SystemAuditTrailResponse>('/api/v1/fiscal/system-audit-trail', {
      params,
    });
    return response.data;
  },
};
