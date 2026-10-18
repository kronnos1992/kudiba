import { apiClient } from './client';

export type ContractType = 'PERMANENT' | 'FIXED_TERM' | 'PROBATION' | 'PART_TIME' | 'INTERNSHIP';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
export type PeriodStatus = 'DRAFT' | 'CALCULATED' | 'CLOSED';
export type PayslipStatus = 'DRAFT' | 'APPROVED' | 'PAID';
export type ComponentType =
  | 'BASE_SALARY'
  | 'FOOD_ALLOWANCE'
  | 'TRANSPORT_ALLOWANCE'
  | 'HOUSING_ALLOWANCE'
  | 'FUNCTION_ALLOWANCE'
  | 'OVERTIME_50'
  | 'OVERTIME_75'
  | 'BONUS'
  | 'DEDUCTION_ADVANCE'
  | 'DEDUCTION_LOAN'
  | 'OTHER_EARNING'
  | 'OTHER_DEDUCTION';

export interface Department {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface CreateDepartmentPayload {
  code: string;
  name: string;
  description?: string;
}

export interface JobPosition {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  department_id?: string | null;
  base_salary_min: string | number;
  base_salary_max: string | number;
}

export interface CreateJobPositionPayload {
  code: string;
  title: string;
  department_id?: string;
  base_salary_min: string | number;
  base_salary_max: string | number;
}

export interface Employee {
  id: string;
  tenant_id: string;
  code: string;
  full_name: string;
  nif: string;
  identity_card_number: string;
  iban: string;
  hire_date: string;
  status: EmployeeStatus;
  inss_number?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  dependents_count: number;
  email?: string | null;
  phone?: string | null;
  bank_code?: string | null;
  address?: string | null;
  termination_date?: string | null;
  created_at?: string | null;
}

export interface CreateEmployeePayload {
  code: string;
  full_name: string;
  nif: string;
  identity_card_number: string;
  iban: string;
  hire_date: string;
  inss_number?: string;
  birth_date?: string;
  gender?: string;
  marital_status?: string;
  dependents_count?: number;
  email?: string;
  phone?: string;
  bank_code?: string;
  address?: string;
}

export interface SalaryComponent {
  id: string;
  contract_id: string;
  component_type: ComponentType;
  name: string;
  amount: string | number;
  is_taxable_irt: boolean;
  is_taxable_inss: boolean;
  is_active: boolean;
}

export interface Contract {
  id: string;
  tenant_id: string;
  employee_id: string;
  contract_type: ContractType;
  start_date: string;
  end_date?: string | null;
  base_salary: string | number;
  status: string;
  job_position_id?: string | null;
  components: SalaryComponent[];
}

export interface CreateContractPayload {
  employee_id: string;
  contract_type?: ContractType;
  start_date: string;
  base_salary: string | number;
  job_position_id?: string;
  end_date?: string;
  components?: Array<{
    component_type: ComponentType;
    name: string;
    amount: string | number;
    is_taxable_irt: boolean;
    is_taxable_inss: boolean;
  }>;
}

export interface PayrollPeriod {
  id: string;
  tenant_id: string;
  title: string;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  total_gross: string | number;
  total_net: string | number;
  total_irt: string | number;
  total_inss_employee: string | number;
  total_inss_employer: string | number;
  closed_at?: string | null;
}

export interface OpenPeriodPayload {
  title: string;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
}

export interface PayslipLine {
  id: string;
  line_type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_COST';
  code: string;
  description: string;
  reference_value: string | number;
  quantity: string | number;
  rate: string | number;
  amount: string | number;
}

export interface Payslip {
  id: string;
  tenant_id: string;
  period_id: string;
  employee_id: string;
  contract_id: string;
  days_worked: number;
  base_salary: string | number;
  total_gross: string | number;
  total_allowances: string | number;
  total_overtime: string | number;
  base_inss: string | number;
  inss_employee: string | number;
  inss_employer: string | number;
  materia_coletavel_irt: string | number;
  irt: string | number;
  total_deductions: string | number;
  net_salary: string | number;
  status: PayslipStatus;
  lines: PayslipLine[];
}

export interface Ps2ExportResponse {
  filename: string;
  content: string;
  total_records: number;
  total_amount: string | number;
}

export interface VacationRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  days: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string | null;
}

export interface CreateVacationPayload {
  employee_id: string;
  start_date: string;
  end_date: string;
  days?: number;
  notes?: string;
}

export const payrollApi = {
  // Departamentos e Cargos
  listDepartments: async (): Promise<Department[]> => {
    const res = await apiClient.get<Department[]>('/api/v1/payroll/departments');
    return res.data;
  },

  createDepartment: async (payload: CreateDepartmentPayload): Promise<Department> => {
    const res = await apiClient.post<Department>('/api/v1/payroll/departments', payload);
    return res.data;
  },

  listJobPositions: async (): Promise<JobPosition[]> => {
    const res = await apiClient.get<JobPosition[]>('/api/v1/payroll/job-positions');
    return res.data;
  },

  createJobPosition: async (payload: CreateJobPositionPayload): Promise<JobPosition> => {
    const res = await apiClient.post<JobPosition>('/api/v1/payroll/job-positions', payload);
    return res.data;
  },

  // Colaboradores
  listEmployees: async (): Promise<Employee[]> => {
    const res = await apiClient.get<Employee[]>('/api/v1/payroll/employees');
    return res.data;
  },

  getEmployee: async (id: string): Promise<Employee> => {
    const res = await apiClient.get<Employee>(`/api/v1/payroll/employees/${id}`);
    return res.data;
  },

  createEmployee: async (payload: CreateEmployeePayload): Promise<Employee> => {
    const res = await apiClient.post<Employee>('/api/v1/payroll/employees', payload);
    return res.data;
  },

  updateEmployee: async (id: string, payload: Partial<CreateEmployeePayload>): Promise<Employee> => {
    const res = await apiClient.put<Employee>(`/api/v1/payroll/employees/${id}`, payload);
    return res.data;
  },

  terminateEmployee: async (
    id: string,
    payload: string | { termination_date: string; reason?: string }
  ): Promise<Employee> => {
    const data = typeof payload === 'string' ? { termination_date: payload } : payload;
    const res = await apiClient.post<Employee>(`/api/v1/payroll/employees/${id}/terminate`, data);
    return res.data;
  },

  // Contratos
  listContracts: async (employeeId?: string): Promise<Contract[]> => {
    const res = await apiClient.get<Contract[]>('/api/v1/payroll/contracts', {
      params: { employee_id: employeeId },
    });
    return res.data;
  },

  createContract: async (payload: CreateContractPayload): Promise<Contract> => {
    const res = await apiClient.post<Contract>('/api/v1/payroll/contracts', payload);
    return res.data;
  },

  // Períodos de Processamento
  listPeriods: async (): Promise<PayrollPeriod[]> => {
    const res = await apiClient.get<PayrollPeriod[]>('/api/v1/payroll/periods');
    return res.data;
  },

  getPeriod: async (id: string): Promise<PayrollPeriod> => {
    const res = await apiClient.get<PayrollPeriod>(`/api/v1/payroll/periods/${id}`);
    return res.data;
  },

  openPeriod: async (payload: OpenPeriodPayload): Promise<PayrollPeriod> => {
    const res = await apiClient.post<PayrollPeriod>('/api/v1/payroll/periods', payload);
    return res.data;
  },

  calculatePeriod: async (id: string, overtimeData: any[] = []): Promise<PayrollPeriod> => {
    const res = await apiClient.post<PayrollPeriod>(`/api/v1/payroll/periods/${id}/calculate`, {
      overtime_data: overtimeData,
    });
    return res.data;
  },

  closePeriod: async (id: string): Promise<PayrollPeriod> => {
    const res = await apiClient.post<PayrollPeriod>(`/api/v1/payroll/periods/${id}/close`);
    return res.data;
  },

  listPeriodPayslips: async (periodId: string): Promise<Payslip[]> => {
    const res = await apiClient.get<Payslip[]>(`/api/v1/payroll/periods/${periodId}/payslips`);
    return res.data;
  },

  exportPs2: async (
    periodId: string,
    companyData?: { company_name?: string; company_nif?: string; company_iban?: string }
  ): Promise<Ps2ExportResponse> => {
    const res = await apiClient.get<Ps2ExportResponse>(`/api/v1/payroll/periods/${periodId}/ps2`, {
      params: companyData,
    });
    return res.data;
  },

  getPayslipPdfBlob: async (payslipId: string): Promise<Blob> => {
    const res = await apiClient.get(`/api/v1/payroll/payslips/${payslipId}/pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  markPayslipPaid: async (payslipId: string): Promise<Payslip> => {
    const res = await apiClient.post<Payslip>(`/api/v1/payroll/payslips/${payslipId}/pay`);
    return res.data;
  },

  // Férias
  listVacations: async (params?: { employee_id?: string; status?: string }): Promise<VacationRequest[]> => {
    const res = await apiClient.get<VacationRequest[]>('/api/v1/payroll/vacations', { params });
    return res.data;
  },

  requestVacation: async (payload: CreateVacationPayload): Promise<VacationRequest> => {
    const res = await apiClient.post<VacationRequest>('/api/v1/payroll/vacations', payload);
    return res.data;
  },

  approveVacation: async (vacationId: string): Promise<VacationRequest> => {
    const res = await apiClient.post<VacationRequest>(`/api/v1/payroll/vacations/${vacationId}/approve`);
    return res.data;
  },

  rejectVacation: async (vacationId: string, notes?: string): Promise<VacationRequest> => {
    const res = await apiClient.post<VacationRequest>(`/api/v1/payroll/vacations/${vacationId}/reject`, { notes });
    return res.data;
  },

  // Assiduidade e Faltas
  listAbsences: async (params?: { employee_id?: string; from_date?: string; to_date?: string }): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/api/v1/payroll/absences', { params });
    return res.data;
  },

  createAbsence: async (payload: {
    employee_id: string;
    absence_date: string;
    absence_type?: string;
    is_paid?: boolean;
    notes?: string;
  }): Promise<any> => {
    const res = await apiClient.post('/api/v1/payroll/absences', payload);
    return res.data;
  },

  getDashboardSummary: async (year?: number): Promise<any> => {
    const res = await apiClient.get('/api/v1/payroll/dashboard/summary', {
      params: year ? { year } : undefined,
    });
    return res.data;
  },
};
