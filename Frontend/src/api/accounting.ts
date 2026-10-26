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

export interface CostCenterItem {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  parent_cost_center_id?: string;
  parent_code?: string;
  parent_name?: string;
  center_type: 'COST_CENTER' | 'PROFIT_CENTER' | 'SHARED_SERVICE' | 'PROJECT_UNIT' | string;
  branch_name: string;
  department_name?: string;
  responsible_employee_id?: string;
  responsible_name?: string;
  valid_from: string;
  valid_to?: string;
  monthly_budget: number | string;
  committed_amount: number | string;
  realized_opex: number | string;
  realized_capex: number | string;
  monthly_depreciation?: number | string;
  available_budget: number | string;
  utilization_pct: number | string;
  alert_threshold_pct: number | string;
  budget_status: 'DENTRO_ORCAMENTO' | 'ALERTA_80' | 'CRITICO_90' | 'EXCEDIDO_100' | 'SEM_ORCAMENTO' | string;
  is_active: boolean;
  created_at: string;
}

export interface CreateCostCenterPayload {
  code: string;
  name: string;
  description?: string;
  parent_cost_center_id?: string;
  center_type?: string;
  branch_name?: string;
  department_name?: string;
  responsible_name?: string;
  valid_from?: string;
  valid_to?: string;
  monthly_budget?: number;
  alert_threshold_pct?: number;
}

export interface UpdateCostCenterPayload {
  name: string;
  description?: string;
  parent_cost_center_id?: string;
  center_type?: string;
  branch_name?: string;
  department_name?: string;
  responsible_name?: string;
  valid_from?: string;
  valid_to?: string;
  monthly_budget?: number;
  alert_threshold_pct?: number;
  is_active: boolean;
  committed_amount?: number;
}

export interface AllocationRuleLine {
  id: string;
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  branch_name: string;
  percentage: number | string;
  justification?: string;
}

export interface AllocationRule {
  id: string;
  code: string;
  name: string;
  description?: string;
  allocation_basis: string;
  default_account_code?: string;
  is_active: boolean;
  total_percentage: number | string;
  lines: AllocationRuleLine[];
}

export interface CreateAllocationRulePayload {
  code: string;
  name: string;
  description?: string;
  allocation_basis: string;
  default_account_code?: string;
  lines: Array<{
    cost_center_id: string;
    percentage: number;
    justification?: string;
  }>;
}

export interface AllocateExpensePayload {
  tracking_scope?: string;
  source_module: string;
  source_document_ref: string;
  supplier_name?: string;
  purchase_order_ref?: string;
  receipt_delivery_ref?: string;
  payment_settlement_ref?: string;
  journal_entry_ref?: string;
  allocation_date?: string;
  account_code: string;
  account_name: string;
  is_capex: boolean;
  total_amount: number;
  total_units?: number;
  unit_measure?: string;
  useful_life_months?: number;
  allocation_rule_id?: string;
  allocation_criterion?: string;
  project_code?: string;
  vehicle_or_asset?: string;
  notes?: string;
  lines: Array<{
    cost_center_id: string;
    percentage: number;
    allocated_units?: number;
    asset_tags?: string;
    recipient_responsible?: string;
    project_code?: string;
    vehicle_or_asset?: string;
    notes?: string;
  }>;
}

export interface CostAllocationRecord {
  id: string;
  batch_id: string;
  tracking_scope?: string;
  source_module: string;
  source_document_ref: string;
  supplier_name?: string;
  purchase_order_ref?: string;
  receipt_delivery_ref?: string;
  payment_settlement_ref?: string;
  journal_entry_ref?: string;
  allocation_date: string;
  account_code: string;
  account_name: string;
  is_capex: boolean;
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  department_name?: string;
  branch_name: string;
  project_code?: string;
  vehicle_or_asset?: string;
  allocation_criterion?: string;
  percentage: number | string;
  allocated_amount: number | string;
  total_document_amount: number | string;
  total_units?: number | string;
  allocated_units?: number | string;
  unit_measure?: string;
  asset_tags?: string;
  recipient_responsible?: string;
  useful_life_months?: number;
  monthly_depreciation?: number | string;
  notes?: string;
  created_by: string;
}

export interface CostTraceChain {
  batch_id: string;
  tracking_scope: string;
  source_module: string;
  source_document_ref: string;
  supplier_name?: string;
  purchase_order_ref?: string;
  receipt_delivery_ref?: string;
  payment_settlement_ref?: string;
  journal_entry_ref?: string;
  allocation_date: string;
  account_code: string;
  account_name: string;
  is_capex: boolean;
  total_document_amount: number | string;
  total_units?: number | string;
  unit_measure?: string;
  useful_life_months?: number;
  total_monthly_depreciation: number | string;
  project_code?: string;
  vehicle_or_asset?: string;
  allocation_criterion?: string;
  splits: CostAllocationRecord[];
}

export interface CostReclassificationRecord {
  id: string;
  allocation_id?: string;
  batch_id: string;
  source_document_ref: string;
  from_cost_center_id: string;
  from_cost_center_code: string;
  from_cost_center_name: string;
  to_cost_center_id: string;
  to_cost_center_code: string;
  to_cost_center_name: string;
  transferred_units?: number | string;
  transferred_amount: number | string;
  asset_tags_moved?: string;
  reason: string;
  performed_by: string;
  created_at: string;
}

export interface ReclassifyCostAllocationPayload {
  allocation_id: string;
  to_cost_center_id: string;
  transferred_amount: number;
  transferred_units?: number;
  asset_tags_moved?: string;
  reason: string;
  performed_by?: string;
}

export interface DepartmentCostSummary {
  department_name: string;
  branch_name: string;
  budget_amount: number | string;
  realized_opex: number | string;
  committed_amount: number | string;
  realized_capex: number | string;
  monthly_depreciation?: number | string;
  utilization_pct: number | string;
}

export interface BranchCostSummary {
  branch_name: string;
  centers_count: number;
  total_budget: number | string;
  realized_opex: number | string;
  committed_amount: number | string;
  realized_capex: number | string;
}

export interface ProjectAssetSummary {
  dimension_type: string;
  code: string;
  total_opex: number | string;
  total_capex: number | string;
  monthly_depreciation?: number | string;
  total_units?: number | string;
  unit_measure?: string;
  documents_count: number;
}

export interface MonthlyCostTrend {
  month_label: string;
  period_month: number;
  budget_total: number | string;
  realized_opex: number | string;
  realized_capex: number | string;
}

export interface UnassignedExpense {
  entry_id: string;
  entry_number: number;
  transaction_date: string;
  source_document_ref?: string;
  account_code: string;
  description: string;
  amount: number | string;
}

export interface CostCenterAuditLog {
  id: string;
  action: string;
  entity_ref: string;
  details: string;
  performed_by: string;
  created_at: string;
}

export interface CostCenterDashboard {
  total_budget_monthly: number | string;
  total_realized_opex: number | string;
  total_committed: number | string;
  total_realized_capex: number | string;
  total_monthly_depreciation?: number | string;
  total_available_budget: number | string;
  overall_utilization_pct: number | string;
  active_centers_count: number;
  centers_over_80_pct: number;
  centers_over_100_pct: number;
  centers_without_responsible_or_budget: number;
  unassigned_expenses_count: number;
  centers: CostCenterItem[];
  by_department: DepartmentCostSummary[];
  by_branch: BranchCostSummary[];
  by_project_and_asset: ProjectAssetSummary[];
  monthly_trend: MonthlyCostTrend[];
  allocation_rules: AllocationRule[];
  recent_allocations: CostAllocationRecord[];
  trace_chains?: CostTraceChain[];
  reclassifications?: CostReclassificationRecord[];
  unassigned_expenses: UnassignedExpense[];
  audit_logs: CostCenterAuditLog[];
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

  getCostCentersDashboard: async (): Promise<CostCenterDashboard> => {
    const res = await apiClient.get<CostCenterDashboard>(
      '/api/v1/accounting/cost-centers/dashboard'
    );
    return res.data;
  },

  listCostCenters: async (): Promise<CostCenterItem[]> => {
    const res = await apiClient.get<CostCenterItem[]>('/api/v1/accounting/cost-centers');
    return res.data;
  },

  createCostCenter: async (payload: CreateCostCenterPayload): Promise<CostCenterItem> => {
    const res = await apiClient.post<CostCenterItem>(
      '/api/v1/accounting/cost-centers',
      payload
    );
    return res.data;
  },

  updateCostCenter: async (
    id: string,
    payload: UpdateCostCenterPayload
  ): Promise<CostCenterItem> => {
    const res = await apiClient.put<CostCenterItem>(
      `/api/v1/accounting/cost-centers/${id}`,
      payload
    );
    return res.data;
  },

  seedCostCenters: async (): Promise<CostCenterDashboard> => {
    const res = await apiClient.post<CostCenterDashboard>(
      '/api/v1/accounting/cost-centers/seed'
    );
    return res.data;
  },

  listAllocationRules: async (): Promise<AllocationRule[]> => {
    const res = await apiClient.get<AllocationRule[]>(
      '/api/v1/accounting/cost-centers/allocation-rules'
    );
    return res.data;
  },

  createAllocationRule: async (
    payload: CreateAllocationRulePayload
  ): Promise<AllocationRule> => {
    const res = await apiClient.post<AllocationRule>(
      '/api/v1/accounting/cost-centers/allocation-rules',
      payload
    );
    return res.data;
  },

  allocateExpense: async (
    payload: AllocateExpensePayload
  ): Promise<CostAllocationRecord[]> => {
    const res = await apiClient.post<CostAllocationRecord[]>(
      '/api/v1/accounting/cost-centers/allocate-expense',
      payload
    );
    return res.data;
  },

  reclassifyAllocation: async (
    payload: ReclassifyCostAllocationPayload
  ): Promise<CostReclassificationRecord> => {
    const res = await apiClient.post<CostReclassificationRecord>(
      '/api/v1/accounting/cost-centers/reclassify',
      payload
    );
    return res.data;
  },
};
