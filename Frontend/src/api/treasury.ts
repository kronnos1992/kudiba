import { apiClient } from './client';

export type PaymentMethodType = 'NUMERARIO' | 'MULTICAIXA' | 'TRANSFERENCIA' | 'GPO_REFERENCE';
export type MovementType = 'SUPPLY' | 'BLEED' | 'SALE_RECEIPT' | 'EXPENSE';
export type SessionStatusType = 'OPEN' | 'CLOSED';
export type DiscrepancyType = 'Exact' | 'Surplus' | 'Shortage';

export interface CashRegister {
  id: string;
  tenant_id: string;
  branch_id?: string | null;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCashRegisterPayload {
  branch_id?: string;
  code: string;
  name: string;
}

export interface CashSession {
  id: string;
  tenant_id: string;
  register_id: string;
  operator_user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: string | number;
  closing_balance_counted: string | number | null;
  closing_balance_system: string | number | null;
  discrepancy: string | number | null;
  status: SessionStatusType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenCashSessionPayload {
  register_id: string;
  operator_user_id: string;
  opening_balance: string | number;
}

export interface CloseCashSessionPayload {
  closing_balance_counted: string | number;
  notes?: string;
}

export interface CashMovement {
  id: string;
  tenant_id: string;
  session_id: string;
  register_id: string;
  movement_type: MovementType;
  amount: string | number;
  reason: string;
  operator_user_id: string;
  created_at: string;
}

export interface RecordCashMovementPayload {
  session_id: string;
  movement_type: MovementType;
  amount: string | number;
  reason: string;
  operator_user_id: string;
}

export interface SessionReconciliation {
  opening_balance: string | number;
  total_supply: string | number;
  total_sale_receipt: string | number;
  total_bleed: string | number;
  total_expense: string | number;
  total_in: string | number;
  total_out: string | number;
  expected_balance: string | number;
  counted_balance: string | number | null;
  discrepancy: string | number | null;
  discrepancy_type: DiscrepancyType | null;
}

export interface SessionReport {
  session: CashSession;
  register_code: string;
  register_name: string;
  reconciliation: SessionReconciliation;
  movements: CashMovement[];
}

export interface BankAccount {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_number: string;
  iban: string;
  currency: string;
  current_balance: string | number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBankAccountPayload {
  bank_name: string;
  account_number: string;
  iban: string;
  currency: string;
  initial_balance?: string | number;
}

export interface TreasuryReceiptLine {
  id: string;
  receipt_id: string;
  invoice_id: string;
  invoice_number: string;
  amount_settled: string | number;
  notes: string | null;
  created_at: string;
}

export interface TreasuryReceipt {
  id: string;
  tenant_id: string;
  receipt_number: string;
  customer_id: string;
  customer_name: string;
  customer_nif: string | null;
  session_id: string | null;
  bank_account_id: string | null;
  payment_method: PaymentMethodType;
  total_amount: string | number;
  currency: string;
  notes: string | null;
  issued_at: string;
  created_at: string;
  lines: TreasuryReceiptLine[];
}

export interface IssueReceiptLinePayload {
  invoice_id: string;
  invoice_number: string;
  amount_settled: string | number;
  notes?: string;
}

export interface IssueReceiptPayload {
  customer_id: string;
  customer_name: string;
  customer_nif?: string;
  session_id?: string;
  bank_account_id?: string;
  payment_method: PaymentMethodType;
  total_amount: string | number;
  currency: string;
  notes?: string;
  lines: IssueReceiptLinePayload[];
}

export interface InvoiceReceivable {
  id: string;
  tenant_id: string;
  invoice_id: string;
  document_number: string;
  document_type: string;
  payment_mechanism: string | null;
  gross_total: string | number;
  status: 'Outstanding' | 'Settled' | string;
  created_at: string;
  updated_at: string;
}

export const treasuryApi = {
  // Caixas Físicos
  listRegisters: async (): Promise<CashRegister[]> => {
    const res = await apiClient.get<CashRegister[]>('/api/v1/treasury/registers');
    return res.data;
  },

  createRegister: async (payload: CreateCashRegisterPayload): Promise<CashRegister> => {
    const res = await apiClient.post<CashRegister>('/api/v1/treasury/registers', payload);
    return res.data;
  },

  getRegister: async (id: string): Promise<CashRegister> => {
    const res = await apiClient.get<CashRegister>(`/api/v1/treasury/registers/${id}`);
    return res.data;
  },

  // Sessões de Caixa
  openSession: async (payload: OpenCashSessionPayload): Promise<CashSession> => {
    const res = await apiClient.post<CashSession>('/api/v1/treasury/sessions/open', payload);
    return res.data;
  },

  closeSession: async (id: string, payload: CloseCashSessionPayload): Promise<CashSession> => {
    const res = await apiClient.post<CashSession>(`/api/v1/treasury/sessions/${id}/close`, payload);
    return res.data;
  },

  getCurrentSession: async (registerId: string): Promise<CashSession | null> => {
    const res = await apiClient.get<CashSession | null>('/api/v1/treasury/sessions/current', {
      params: { register_id: registerId },
    });
    return res.data;
  },

  getSession: async (id: string): Promise<CashSession> => {
    const res = await apiClient.get<CashSession>(`/api/v1/treasury/sessions/${id}`);
    return res.data;
  },

  getSessionReport: async (id: string): Promise<SessionReport> => {
    const res = await apiClient.get<SessionReport>(`/api/v1/treasury/sessions/${id}/report`);
    return res.data;
  },

  // Movimentos de Caixa
  recordMovement: async (payload: RecordCashMovementPayload): Promise<CashMovement> => {
    const res = await apiClient.post<CashMovement>('/api/v1/treasury/movements', payload);
    return res.data;
  },

  listSessionMovements: async (sessionId: string): Promise<CashMovement[]> => {
    const res = await apiClient.get<CashMovement[]>(`/api/v1/treasury/sessions/${sessionId}/movements`);
    return res.data;
  },

  // Contas Bancárias
  listBankAccounts: async (): Promise<BankAccount[]> => {
    const res = await apiClient.get<BankAccount[]>('/api/v1/treasury/bank-accounts');
    return res.data;
  },

  createBankAccount: async (payload: CreateBankAccountPayload): Promise<BankAccount> => {
    const res = await apiClient.post<BankAccount>('/api/v1/treasury/bank-accounts', payload);
    return res.data;
  },

  getBankAccount: async (id: string): Promise<BankAccount> => {
    const res = await apiClient.get<BankAccount>(`/api/v1/treasury/bank-accounts/${id}`);
    return res.data;
  },

  // Recibos RC
  listReceipts: async (params?: { customer_id?: string; limit?: number }): Promise<TreasuryReceipt[]> => {
    const res = await apiClient.get<TreasuryReceipt[]>('/api/v1/treasury/receipts', { params });
    return res.data;
  },

  getReceipt: async (id: string): Promise<TreasuryReceipt> => {
    const res = await apiClient.get<TreasuryReceipt>(`/api/v1/treasury/receipts/${id}`);
    return res.data;
  },

  issueReceipt: async (payload: IssueReceiptPayload): Promise<TreasuryReceipt> => {
    const res = await apiClient.post<TreasuryReceipt>('/api/v1/treasury/receipts', payload);
    return res.data;
  },

  // Contas a Receber
  listReceivables: async (limit?: number): Promise<InvoiceReceivable[]> => {
    const res = await apiClient.get<InvoiceReceivable[]>('/api/v1/treasury/receivables', {
      params: { limit },
    });
    return res.data;
  },
};
