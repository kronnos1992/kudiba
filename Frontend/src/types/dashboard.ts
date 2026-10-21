export interface PayrollEmployeeStatusCounts {
  total: number;
  active: number;
  on_leave: number;
  suspended: number;
  terminated: number;
}

export interface PayrollOrganizationSummary {
  departments: number;
  job_positions: number;
}

export interface PayrollPeriodTotals {
  period_id: string;
  title: string;
  year: number;
  month: number;
  status: string;
  total_gross: number | string;
  total_net: number | string;
  total_irt: number | string;
  total_inss_employee: number | string;
  total_inss_employer: number | string;
}

export interface PayrollMonthlyPoint {
  month: number;
  status: string;
  total_gross: number | string;
  total_net: number | string;
}

export interface PayrollAnnualSummary {
  year: number;
  periods_processed: number;
  total_gross: number | string;
  total_net: number | string;
  total_irt: number | string;
  total_inss_employee: number | string;
  total_inss_employer: number | string;
  monthly: PayrollMonthlyPoint[];
}

export interface PayrollDashboardSummary {
  generated_at: string;
  employees: PayrollEmployeeStatusCounts;
  organization: PayrollOrganizationSummary;
  latest_period: PayrollPeriodTotals | null;
  annual: PayrollAnnualSummary;
}

export interface InventoryProductStats {
  total: number;
  active: number;
  stockable: number;
  services: number;
}

export interface InventoryWarehouseStats {
  total: number;
  active: number;
}

export interface InventoryEntityStats {
  total: number;
  customers: number;
  suppliers: number;
}

export interface InventoryTopValueProduct {
  product_id: string;
  code: string;
  name: string;
  quantity_on_hand: number | string;
  value_by_cost: number | string;
}

export interface InventoryLowStockItem {
  product_id: string;
  code: string;
  name: string;
  warehouse_id: string;
  warehouse_name: string;
  quantity_on_hand: number | string;
  reorder_point: number | string;
}

export interface InventoryStockStats {
  tracked_positions: number;
  total_quantity: number | string;
  value_by_cost: number | string;
  value_by_sale: number | string;
  low_stock_count: number;
  top_value_products: InventoryTopValueProduct[];
  low_stock_items: InventoryLowStockItem[];
}

export interface InventoryDashboardSummary {
  tenant_id: string;
  generated_at: string;
  products: InventoryProductStats;
  warehouses: InventoryWarehouseStats;
  entities: InventoryEntityStats;
  stock: InventoryStockStats;
}

export interface TreasuryBankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  iban: string;
  currency: string;
  current_balance: number | string;
  is_active: boolean;
}

export interface TreasuryLiquidity {
  total_balance_aoa: number | string;
  total_accounts: number;
  active_accounts: number;
  accounts: TreasuryBankAccount[];
}

export interface TreasuryAgingBucket {
  bucket: string;
  count: number;
  amount: number | string;
}

export interface TreasuryReceivables {
  outstanding_count: number;
  outstanding_total: number | string;
  settled_count: number;
  settled_total: number | string;
  aging: TreasuryAgingBucket[];
}

export interface TreasuryReceipts {
  total_count: number;
  total_amount: number | string;
  month_count: number;
  month_amount: number | string;
}

export interface TreasuryCash {
  open_sessions: number;
  total_registers: number;
  active_registers: number;
}

export interface TreasuryDashboardSummary {
  tenant_id: string;
  generated_at: string;
  liquidity: TreasuryLiquidity;
  receivables: TreasuryReceivables;
  receipts: TreasuryReceipts;
  cash: TreasuryCash;
}

export interface InvoicingTotals {
  invoicesCount: number;
  creditNotesCount: number;
  grossTotal: number | string;
  netTotal: number | string;
  taxTotal: number | string;
  withholdingTotal: number | string;
  stampDutyTotal: number | string;
  amountDue: number | string;
}

export interface InvoicingMonthlyPoint {
  month: number;
  grossTotal: number | string;
  netTotal: number | string;
  taxTotal: number | string;
  invoicesCount: number;
}

export interface InvoicingDailyPoint {
  date: string;
  day: number;
  month: number;
  grossTotal: number | string;
  netTotal: number | string;
  taxTotal: number | string;
  invoicesCount: number;
}

export interface InvoicingTopCustomer {
  customerName: string;
  customerNif: string;
  grossTotal: number | string;
  invoicesCount: number;
}

export interface InvoicingTaxBucket {
  taxRate: number | string;
  taxableBase: number | string;
  taxAmount: number | string;
}

export interface InvoicingAgt {
  lastDocumentNumber: string | null;
  lastValidationChars: string | null;
  lastIssuedAt: string | null;
  documentsThisMonth: number;
  currentMonth: number;
}

export interface InvoicingDashboardSummary {
  tenantId: string;
  year: number;
  generatedAt: string;
  totals: InvoicingTotals;
  monthlyTrend: InvoicingMonthlyPoint[];
  dailyTrend?: InvoicingDailyPoint[];
  topCustomers: InvoicingTopCustomer[];
  taxBreakdown: InvoicingTaxBucket[];
  agt: InvoicingAgt;
}

export interface DashboardState {
  invoicing: InvoicingDashboardSummary | null;
  treasury: TreasuryDashboardSummary | null;
  payroll: PayrollDashboardSummary | null;
  inventory: InventoryDashboardSummary | null;
  backoffice: import('./backoffice').PlatformSummary | null;
  loading: boolean;
  error: string | null;
}