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
  pos_session_id: string | null;
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
  idempotencyKey?: string;
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
  paid_amount?: string | number;
  remaining_amount?: string | number;
  status: 'Outstanding' | 'Partial' | 'Settled' | string;
  created_at: string;
  updated_at: string;
}

export interface PosSession {
  id: string;
  tenant_id: string;
  register_id: string;
  opened_by: string;
  opened_at: string;
  closed_by: string | null;
  closed_at: string | null;
  closing_notes: string | null;
  status: SessionStatusType;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpenPosSessionPayload {
  register_id: string;
  notes?: string;
}

export interface ClosePosSessionPayload {
  notes?: string;
}

export interface PosSessionSummary {
  id: string;
  opened_by: string;
  opened_at: string;
}

export interface CashSessionSummary {
  id: string;
  operator_user_id: string;
  opened_at: string;
  opening_balance: string | number;
}

export interface PosRegisterPanel {
  register_id: string;
  code: string;
  name: string;
  is_active: boolean;
  pos_session: PosSessionSummary | null;
  cash_session: CashSessionSummary | null;
  sales_count: number;
  sales_total: string | number;
  supplies_total: string | number;
  bleeds_total: string | number;
  expenses_total: string | number;
  expected_cash: string | number;
  last_movement_at: string | null;
}

export interface PosOperatorPanel {
  operator_user_id: string;
  sales_count: number;
  sales_total: string | number;
  supplies_total: string | number;
  bleeds_total: string | number;
  expenses_total: string | number;
  net_cash_total: string | number;
}

export interface PosPanelTotals {
  total_registers: number;
  active_registers: number;
  open_pos_sessions: number;
  open_cash_sessions: number;
  sales_count: number;
  sales_total: string | number;
  supplies_total: string | number;
  bleeds_total: string | number;
  expenses_total: string | number;
}

export interface PosPanelResponse {
  tenant_id: string;
  date: string;
  generated_at: string;
  totals: PosPanelTotals;
  registers: PosRegisterPanel[];
  operators: PosOperatorPanel[];
}

export interface ForeignCurrencyAccount {
  bank_name: string;
  currency: string;
  balance_original: number;
  exchange_rate_to_aoa: number;
  converted_aoa: number;
}

export interface CurrentLiquidityBreakdown {
  total_available_aoa: number;
  cash_in_hand_aoa: number;
  bank_balances_aoa: number;
  reconciled_balance_aoa: number;
  pending_clearance_aoa: number;
  foreign_reserves: ForeignCurrencyAccount[];
}

export interface ActivityFlow {
  inflows: number;
  outflows: number;
  net: number;
}

export interface MethodBreakdown {
  method: string;
  amount: number;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
}

export interface RealizedCashFlow {
  total_inflows: number;
  total_outflows: number;
  net_cash_flow: number;
  operational: ActivityFlow;
  investment: ActivityFlow;
  financing: ActivityFlow;
  inflows_by_method: MethodBreakdown[];
  outflows_by_category: CategoryBreakdown[];
}

export interface TaxObligationForecast {
  tax_type: string;
  due_date: string;
  estimated_amount: number;
  description: string;
}

export interface ForecastCashFlow {
  receivables_due: number;
  payables_due: number;
  estimated_taxes: number;
  estimated_payroll: number;
  total_expected_inflows: number;
  total_expected_outflows: number;
  net_expected_flow: number;
  tax_obligations: TaxObligationForecast[];
}

export interface DailyProjectionPoint {
  date: string;
  starting_balance: number;
  expected_inflows: number;
  expected_outflows: number;
  ending_balance: number;
  is_deficit_risk: boolean;
}

export interface TreasuryAlert {
  severity: 'DANGER' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  due_date?: string | null;
}

export interface CashFlowReport {
  tenant_id: string;
  generated_at: string;
  base_currency: string;
  period_start: string;
  period_end: string;
  current_liquidity: CurrentLiquidityBreakdown;
  realized: RealizedCashFlow;
  forecast: ForecastCashFlow;
  projections: DailyProjectionPoint[];
  alerts: TreasuryAlert[];
}

export interface InvoicePayable {
  id: string;
  tenant_id: string;
  supplier_id?: string | null;
  supplier_name: string;
  supplier_nif?: string | null;
  invoice_number: string;
  activity_type: 'OPERATIONAL' | 'INVESTMENT' | 'FINANCING' | string;
  category: string;
  currency: string;
  gross_total: number;
  withholding_rate: number;
  withholding_amount: number;
  net_payable: number;
  amount_paid: number;
  due_date: string;
  issue_date: string;
  payment_method?: string | null;
  status: 'OUTSTANDING' | 'PARTIALLY_PAID' | 'SETTLED' | 'OVERDUE' | string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePayablePayload {
  supplier_id?: string;
  supplier_name: string;
  supplier_nif?: string;
  invoice_number: string;
  activity_type?: string;
  category?: string;
  currency?: string;
  gross_total: number;
  withholding_rate?: number;
  due_date: string;
  issue_date?: string;
  payment_method?: string;
  notes?: string;
}

export interface SettlePayablePayload {
  bank_account_id?: string;
  session_id?: string;
  amount_paid: number;
  payment_method: PaymentMethodType;
  payment_reference?: string;
  notes?: string;
}

export interface PayableSettlement {
  id: string;
  tenant_id: string;
  payable_id: string;
  bank_account_id?: string | null;
  session_id?: string | null;
  amount_paid: number;
  payment_method: string;
  payment_reference?: string | null;
  settled_at: string;
  operator_user_id: string;
  notes?: string | null;
}

export interface CashTransfer {
  id: string;
  tenant_id: string;
  transfer_number: string;
  source_type: 'BANK' | 'REGISTER' | string;
  source_id: string;
  source_name?: string | null;
  target_type: 'BANK' | 'REGISTER' | string;
  target_id: string;
  target_name?: string | null;
  amount: number;
  fee_amount: number;
  currency: string;
  status: string;
  operator_user_id: string;
  notes?: string | null;
  transferred_at: string;
  created_at: string;
}

export interface CreateCashTransferPayload {
  source_type: 'BANK' | 'REGISTER';
  source_id: string;
  target_type: 'BANK' | 'REGISTER';
  target_id: string;
  amount: number;
  fee_amount?: number;
  currency?: string;
  notes?: string;
}

export interface BankStatement {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  bank_name?: string | null;
  reference_period: string;
  start_balance: number;
  end_balance: number;
  statement_date: string;
  file_name?: string | null;
  status: string;
  created_at: string;
}

export interface BankStatementLine {
  id: string;
  statement_id: string;
  tenant_id: string;
  line_date: string;
  description: string;
  document_ref?: string | null;
  amount: number;
  balance_after: number;
  movement_type: 'CREDIT' | 'DEBIT' | string;
  is_reconciled: boolean;
  matched_type?: string | null;
  matched_id?: string | null;
  reconciled_at?: string | null;
  reconciled_by?: string | null;
}

export interface CreateBankStatementPayload {
  reference_period: string;
  start_balance: number;
  end_balance: number;
  statement_date: string;
  file_name?: string;
}

export interface ReconcileLinePayload {
  matched_type: string;
  matched_id?: string;
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
    const headers: Record<string, string> = {};
    if (payload.idempotencyKey) {
      headers['Idempotency-Key'] = payload.idempotencyKey;
    }
    const res = await apiClient.post<TreasuryReceipt>('/api/v1/treasury/receipts', payload, { headers });
    return res.data;
  },

  // Contas a Receber
  listReceivables: async (limit?: number): Promise<InvoiceReceivable[]> => {
    const res = await apiClient.get<InvoiceReceivable[]>('/api/v1/treasury/receivables', {
      params: { limit },
    });
    return res.data;
  },

  getDashboardSummary: async (): Promise<any> => {
    const res = await apiClient.get('/api/v1/treasury/dashboard/summary');
    return res.data;
  },

  // Sessões POS (turno do gestor)
  openPosSession: async (payload: OpenPosSessionPayload): Promise<PosSession> => {
    const res = await apiClient.post<PosSession>('/api/v1/treasury/pos-sessions/open', payload);
    return res.data;
  },

  closePosSession: async (id: string, payload: ClosePosSessionPayload): Promise<PosSession> => {
    const res = await apiClient.post<PosSession>(`/api/v1/treasury/pos-sessions/${id}/close`, payload);
    return res.data;
  },

  getCurrentPosSession: async (registerId: string): Promise<PosSession | null> => {
    const res = await apiClient.get<PosSession | null>('/api/v1/treasury/pos-sessions/current', {
      params: { register_id: registerId },
    });
    return res.data;
  },

  // Painel dos POS (KPIs do dia, por caixa e por usuário)
  getPosPanel: async (params?: { register_id?: string; date?: string }): Promise<PosPanelResponse> => {
    const res = await apiClient.get<PosPanelResponse>('/api/v1/treasury/pos/panel', { params });
    return res.data;
  },

  // Fluxo de Caixa (Realizado, Previsto, Projetado)
  getCashFlow: async (params?: { start_date?: string; end_date?: string }): Promise<CashFlowReport> => {
    const res = await apiClient.get<CashFlowReport>('/api/v1/treasury/cash-flow', { params });
    return res.data;
  },

  // Contas a Pagar (Fornecedores)
  listPayables: async (params?: { status?: string; activity_type?: string }): Promise<InvoicePayable[]> => {
    const res = await apiClient.get<InvoicePayable[]>('/api/v1/treasury/payables', { params });
    return res.data;
  },

  createPayable: async (payload: CreatePayablePayload): Promise<InvoicePayable> => {
    const res = await apiClient.post<InvoicePayable>('/api/v1/treasury/payables', payload);
    return res.data;
  },

  settlePayable: async (id: string, payload: SettlePayablePayload): Promise<PayableSettlement> => {
    const res = await apiClient.post<PayableSettlement>(`/api/v1/treasury/payables/${id}/settle`, payload);
    return res.data;
  },

  listPayableSettlements: async (payableId: string): Promise<PayableSettlement[]> => {
    const res = await apiClient.get<PayableSettlement[]>(`/api/v1/treasury/payables/${payableId}/settlements`);
    return res.data;
  },

  // Transferências Internas
  listTransfers: async (): Promise<CashTransfer[]> => {
    const res = await apiClient.get<CashTransfer[]>('/api/v1/treasury/transfers');
    return res.data;
  },

  executeTransfer: async (payload: CreateCashTransferPayload): Promise<CashTransfer> => {
    const res = await apiClient.post<CashTransfer>('/api/v1/treasury/transfers', payload);
    return res.data;
  },

  // Extratos e Conciliação Bancária
  listBankStatements: async (bankAccountId: string): Promise<BankStatement[]> => {
    const res = await apiClient.get<BankStatement[]>(`/api/v1/treasury/bank-accounts/${bankAccountId}/statements`);
    return res.data;
  },

  createBankStatement: async (bankAccountId: string, payload: CreateBankStatementPayload): Promise<BankStatement> => {
    const res = await apiClient.post<BankStatement>(`/api/v1/treasury/bank-accounts/${bankAccountId}/statements`, payload);
    return res.data;
  },

  listStatementLines: async (statementId: string): Promise<BankStatementLine[]> => {
    const res = await apiClient.get<BankStatementLine[]>(`/api/v1/treasury/statements/${statementId}/lines`);
    return res.data;
  },

  reconcileLine: async (lineId: string, payload: ReconcileLinePayload): Promise<BankStatementLine> => {
    const res = await apiClient.post<BankStatementLine>(`/api/v1/treasury/statements/lines/${lineId}/reconcile`, payload);
    return res.data;
  },
};
