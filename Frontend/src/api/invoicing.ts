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
  documentType: 'FT' | 'FR' | 'NC' | 'ND';
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
  customerName: string;
  customerNif?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCountry?: string;
  sourceDocumentNumber?: string;
  paymentMethods: string[];
  applyWithholding?: boolean;
  withholdingRate?: number;
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

  issueInvoice: async (payload: IssueInvoicePayload): Promise<Invoice> => {
    const response = await apiClient.post<Invoice>('/api/v1/fiscal/invoices', payload);
    return response.data;
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

  exportSaftXml: async (startDate: string, endDate: string): Promise<Blob> => {
    const response = await apiClient.get('/api/v1/fiscal/saft', {
      params: { startDate, endDate },
      responseType: 'blob',
    });
    return response.data;
  },

  getInvoicePdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/api/v1/fiscal/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  getInvoiceThermal: async (id: string): Promise<string> => {
    const response = await apiClient.get(`/api/v1/fiscal/invoices/${id}/thermal`, {
      responseType: 'text',
    });
    return response.data;
  },

  getProducts: async (): Promise<any[]> => {
    const response = await apiClient.get('/api/v1/inventory/products');
    return response.data;
  },
};
