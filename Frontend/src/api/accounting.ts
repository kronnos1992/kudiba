import { apiClient } from './client';

export type AccountClass =
  | 'CLASS_1_MEIOS_FINANCEIROS'
  | 'CLASS_2_EXISTENCIAS'
  | 'CLASS_3_TERCEIROS'
  | 'CLASS_4_MEIOS_FIXOS'
  | 'CLASS_5_CAPITAL_RESERVAS'
  | 'CLASS_6_CUSTOS_PERDAS'
  | 'CLASS_7_PROVEITOS_GANHOS'
  | 'CLASS_8_RESULTADOS';

export type AccountNature = 'DEBIT' | 'CREDIT';

export interface AccountResponse {
  id: string;
  account_code: string;
  parent_account_code: string | null;
  account_name: string;
  account_class: string;
  account_nature: string;
  is_analytical: boolean;
  is_system_reserved: boolean;
  saft_grouping_code: string | null;
}

export interface CreateAccountPayload {
  account_code: string;
  parent_account_code?: string;
  account_name: string;
  account_nature?: AccountNature;
  is_analytical?: boolean;
  saft_grouping_code?: string;
}

export interface FiscalYear {
  id: string;
  tenant_id: string;
  year_code: number;
  status: 'OPEN' | 'CLOSED';
  start_date: string;
  end_date: string;
  closed_at?: string | null;
}

export interface CreateFiscalYearPayload {
  year_code: number;
}

export type JournalType = 'SALES' | 'PURCHASES' | 'CASH' | 'BANK' | 'OPERATIONS' | 'CLOSING';

export interface Journal {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  journal_type: JournalType;
  is_active: boolean;
  created_at: string;
}

export interface CreateJournalPayload {
  code: string;
  name: string;
  journal_type: JournalType;
}

export interface JournalLineResponse {
  id: string;
  line_number: number;
  account_code: string;
  description?: string | null;
  debit_amount: number | string;
  credit_amount: number | string;
  entity_id?: string | null;
}

export interface JournalEntryResponse {
  id: string;
  entry_number: number;
  transaction_date: string;
  period: number;
  description: string;
  source_service?: string | null;
  source_document_type?: string | null;
  source_document_ref?: string | null;
  total_debit: number | string;
  total_credit: number | string;
  status: 'DRAFT' | 'POSTED' | 'REVERSED' | 'AUDITED' | string;
  lines: JournalLineResponse[];
}

export interface ManualLinePayload {
  account_code: string;
  description?: string;
  debit_amount?: number | string;
  credit_amount?: number | string;
  entity_id?: string;
  cost_center_id?: string;
  currency?: 'AOA' | 'USD' | 'EUR';
}

export interface PostManualEntryPayload {
  fiscal_year: number;
  journal_code: string;
  transaction_date: string;
  period: number;
  description: string;
  lines: ManualLinePayload[];
}

export interface ReverseEntryPayload {
  entry_id: string;
  reversal_date: string;
  period: number;
  reason: string;
}

export interface UpdateEntryPayload {
  transaction_date: string;
  period: number;
  description: string;
  lines: ManualLinePayload[];
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  is_analytical: boolean;
  opening_debit: number | string;
  opening_credit: number | string;
  period_debit: number | string;
  period_credit: number | string;
  closing_debit: number | string;
  closing_credit: number | string;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  total_opening_debit: number | string;
  total_opening_credit: number | string;
  total_period_debit: number | string;
  total_period_credit: number | string;
  total_closing_debit: number | string;
  total_closing_credit: number | string;
  is_balanced: boolean;
}

export interface CurrencyRevaluationPayload {
  fiscal_year: number;
  period: number;
  revaluation_date: string;
  target_account_code: string;
  currency: 'USD' | 'EUR';
  foreign_balance: number;
  new_exchange_rate: number;
  previous_book_value_kz: number;
  notes?: string;
}

export interface CurrencyRevaluationResponse {
  entry_id: string;
  entry_number: number;
  target_account_code: string;
  currency: string;
  exchange_difference: number | string;
  is_gain: boolean;
  offset_account_code: string;
}

export const accountingApi = {
  getChart: async (): Promise<AccountResponse[]> => {
    const res = await apiClient.get<AccountResponse[]>('/api/v1/accounting/chart');
    return res.data;
  },

  createAccount: async (payload: CreateAccountPayload): Promise<AccountResponse> => {
    const res = await apiClient.post<AccountResponse>('/api/v1/accounting/chart', payload);
    return res.data;
  },

  seedStandardPgc: async (): Promise<{ message: string; accounts_created: number }> => {
    const res = await apiClient.post<{ message: string; accounts_created: number }>(
      '/api/v1/accounting/chart/seed-standard'
    );
    return res.data;
  },

  listFiscalYears: async (): Promise<FiscalYear[]> => {
    const res = await apiClient.get<FiscalYear[]>('/api/v1/accounting/fiscal-years');
    return res.data;
  },

  openFiscalYear: async (payload: CreateFiscalYearPayload): Promise<FiscalYear> => {
    const res = await apiClient.post<FiscalYear>('/api/v1/accounting/fiscal-years', payload);
    return res.data;
  },

  closeFiscalYear: async (year: number): Promise<FiscalYear> => {
    const res = await apiClient.post<FiscalYear>(`/api/v1/accounting/fiscal-years/${year}/close`);
    return res.data;
  },

  listJournals: async (): Promise<Journal[]> => {
    const res = await apiClient.get<Journal[]>('/api/v1/accounting/journals');
    return res.data;
  },

  createJournal: async (payload: CreateJournalPayload): Promise<Journal> => {
    const res = await apiClient.post<Journal>('/api/v1/accounting/journals', payload);
    return res.data;
  },

  listEntries: async (params?: {
    journal_id?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<JournalEntryResponse[]> => {
    const res = await apiClient.get<JournalEntryResponse[]>('/api/v1/accounting/entries', {
      params,
    });
    return res.data;
  },

  getEntry: async (id: string): Promise<JournalEntryResponse> => {
    const res = await apiClient.get<JournalEntryResponse>(`/api/v1/accounting/entries/${id}`);
    return res.data;
  },

  postManualEntry: async (payload: PostManualEntryPayload): Promise<JournalEntryResponse> => {
    const res = await apiClient.post<JournalEntryResponse>(
      '/api/v1/accounting/entries',
      payload
    );
    return res.data;
  },

  reverseEntry: async (payload: ReverseEntryPayload): Promise<JournalEntryResponse> => {
    const res = await apiClient.post<JournalEntryResponse>(
      '/api/v1/accounting/entries/reverse',
      payload
    );
    return res.data;
  },

  updateEntry: async (
    id: string,
    payload: UpdateEntryPayload
  ): Promise<JournalEntryResponse> => {
    const res = await apiClient.put<JournalEntryResponse>(
      `/api/v1/accounting/entries/${id}`,
      payload
    );
    return res.data;
  },

  getTrialBalance: async (params?: {
    from_date?: string;
    to_date?: string;
  }): Promise<TrialBalanceReport> => {
    const res = await apiClient.get<TrialBalanceReport>(
      '/api/v1/accounting/reports/trial-balance',
      { params }
    );
    return res.data;
  },

  revalueCurrency: async (
    payload: CurrencyRevaluationPayload
  ): Promise<CurrencyRevaluationResponse> => {
    const res = await apiClient.post<CurrencyRevaluationResponse>(
      '/api/v1/accounting/currency-revaluation',
      payload
    );
    return res.data;
  },

  downloadSaftXml: async (params?: {
    year?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<Blob> => {
    const res = await apiClient.get('/api/v1/accounting/saft', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};
