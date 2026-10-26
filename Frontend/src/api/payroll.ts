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

  // =========================================================================
  // GESTÃO DE CONFLITOS & MEDIAÇÃO LABORAL
  // =========================================================================
  getConflictDashboard: async (): Promise<ConflictDashboard> => {
    const res = await apiClient.get<ConflictDashboard>('/api/v1/payroll/conflicts/dashboard');
    return res.data;
  },

  listConflicts: async (params?: {
    status?: string;
    severity?: string;
    conflict_type?: string;
    search?: string;
  }): Promise<ConflictCaseSummary[]> => {
    const res = await apiClient.get<ConflictCaseSummary[]>('/api/v1/payroll/conflicts', { params });
    return res.data;
  },

  getConflict: async (id: string): Promise<ConflictCaseDetail> => {
    const res = await apiClient.get<ConflictCaseDetail>(`/api/v1/payroll/conflicts/${id}`);
    return res.data;
  },

  createConflict: async (payload: CreateConflictPayload): Promise<ConflictCaseDetail> => {
    const res = await apiClient.post<ConflictCaseDetail>('/api/v1/payroll/conflicts', payload);
    return res.data;
  },

  updateConflictStatus: async (
    id: string,
    payload: UpdateConflictStatusPayload
  ): Promise<ConflictCaseDetail> => {
    const res = await apiClient.patch<ConflictCaseDetail>(`/api/v1/payroll/conflicts/${id}/status`, payload);
    return res.data;
  },

  triageConflict: async (id: string, payload: TriageConflictPayload): Promise<ConflictCaseDetail> => {
    const res = await apiClient.post<ConflictCaseDetail>(`/api/v1/payroll/conflicts/${id}/triage`, payload);
    return res.data;
  },

  addConflictParticipant: async (
    id: string,
    payload: AddParticipantPayload
  ): Promise<ConflictParticipant> => {
    const res = await apiClient.post<ConflictParticipant>(
      `/api/v1/payroll/conflicts/${id}/participants`,
      payload
    );
    return res.data;
  },

  createConflictMeeting: async (
    id: string,
    payload: CreateMeetingPayload
  ): Promise<ConflictMeeting> => {
    const res = await apiClient.post<ConflictMeeting>(
      `/api/v1/payroll/conflicts/${id}/meetings`,
      payload
    );
    return res.data;
  },

  createConflictAction: async (
    id: string,
    payload: CreateActionPayload
  ): Promise<ConflictAction> => {
    const res = await apiClient.post<ConflictAction>(
      `/api/v1/payroll/conflicts/${id}/actions`,
      payload
    );
    return res.data;
  },

  updateConflictAction: async (
    actionId: string,
    payload: UpdateActionPayload
  ): Promise<ConflictAction> => {
    const res = await apiClient.patch<ConflictAction>(
      `/api/v1/payroll/conflicts/actions/${actionId}`,
      payload
    );
    return res.data;
  },

  createConflictFollowUp: async (
    id: string,
    payload: CreateFollowUpPayload
  ): Promise<ConflictFollowUp> => {
    const res = await apiClient.post<ConflictFollowUp>(
      `/api/v1/payroll/conflicts/${id}/follow-ups`,
      payload
    );
    return res.data;
  },
};

export type ConflictType =
  | 'INTERPESSOAL'
  | 'ASSEDIO_MORAL'
  | 'ASSEDIO_SEXUAL'
  | 'CONDICOES_TRABALHO'
  | 'SALARIAL'
  | 'DISCIPLINAR'
  | 'OUTRO';

export type ConflictSeverity = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type ConflictStatus =
  | 'EM_TRIAGEM'
  | 'EM_MEDIACAO'
  | 'EM_INVESTIGACAO'
  | 'EM_ACOMPANHAMENTO'
  | 'RESOLVIDO'
  | 'ENCAMINHADO_DISCIPLINAR'
  | 'ENCERRADO';

export type ConflictParticipantRole =
  | 'COMPLAINANT'
  | 'RESPONDENT'
  | 'WITNESS'
  | 'MEDIATOR'
  | 'INVESTIGATOR'
  | 'DEPARTMENT_HEAD';

export type ConflictMeetingType =
  | 'INDIVIDUAL_HEARING'
  | 'JOINT_MEDIATION'
  | 'CONCILIATION_SESSION'
  | 'PRELIMINARY_INTERVIEW';

export type ConflictActionType =
  | 'COMPROMISSO_CONDUTA'
  | 'MUDANCA_EQUIPA'
  | 'FORMACAO_SENSIBILIZACAO'
  | 'AJUSTE_CARGA'
  | 'PROCESSO_DISCIPLINAR'
  | 'MELHORIA_PROCESSO';

export interface ConflictParticipant {
  id: string;
  case_id: string;
  tenant_id: string;
  employee_id?: string | null;
  name: string;
  role: string;
  statement?: string | null;
  statement_date?: string | null;
  has_conflict_of_interest: boolean;
  conflict_of_interest_details?: string | null;
  created_at: string;
}

export interface ConflictMeeting {
  id: string;
  case_id: string;
  tenant_id: string;
  meeting_type: string;
  scheduled_at: string;
  location: string;
  conducted_by: string;
  attendees?: string | null;
  minutes?: string | null;
  agreed_points?: string | null;
  status: string;
  created_at: string;
}

export interface ConflictAction {
  id: string;
  case_id: string;
  tenant_id: string;
  title: string;
  description: string;
  action_type: string;
  assigned_to: string;
  due_date: string;
  status: string;
  completion_notes?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface ConflictFollowUp {
  id: string;
  case_id: string;
  tenant_id: string;
  review_date: string;
  reviewed_by: string;
  feedback_complainant?: string | null;
  feedback_respondent?: string | null;
  retaliation_detected: boolean;
  is_stable: boolean;
  notes: string;
  created_at: string;
}

export interface ConflictAuditLog {
  id: string;
  case_id: string;
  tenant_id: string;
  action: string;
  performed_by: string;
  details?: string | null;
  created_at: string;
}

export interface ConflictCaseSummary {
  id: string;
  tenant_id: string;
  reference_code: string;
  title: string;
  conflict_type: string;
  severity: string;
  status: string;
  department_id?: string | null;
  department_name?: string | null;
  incident_date: string;
  reported_at: string;
  is_confidential: boolean;
  complainant_employee_id?: string | null;
  complainant_name?: string | null;
  respondent_employee_id?: string | null;
  respondent_name?: string | null;
  assigned_mediator_id?: string | null;
  assigned_mediator_name?: string | null;
  resolution_route?: string | null;
  summary: string;
  retaliation_risk: boolean;
  urgent_protection_measures?: string | null;
  closure_reason?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  participants_count: number;
  meetings_count: number;
  actions_count: number;
}

export interface ConflictCaseDetail extends ConflictCaseSummary {
  participants: ConflictParticipant[];
  meetings: ConflictMeeting[];
  actions: ConflictAction[];
  follow_ups: ConflictFollowUp[];
  audit_logs: ConflictAuditLog[];
}

export interface ConflictDashboard {
  total_cases: number;
  open_cases: number;
  in_mediation: number;
  in_investigation: number;
  resolved: number;
  high_retaliation_risk: number;
  avg_resolution_days: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_department: Record<string, number>;
}

export interface CreateConflictPayload {
  title: string;
  conflict_type?: string;
  severity?: string;
  department_id?: string;
  incident_date?: string;
  is_confidential?: boolean;
  complainant_employee_id?: string;
  complainant_name?: string;
  respondent_employee_id?: string;
  respondent_name?: string;
  summary: string;
  retaliation_risk?: boolean;
  urgent_protection_measures?: string;
}

export interface TriageConflictPayload {
  severity: string;
  resolution_route: string;
  assigned_mediator_id?: string;
  assigned_mediator_name?: string;
  retaliation_risk?: boolean;
  urgent_protection_measures?: string;
  status?: string;
}

export interface UpdateConflictStatusPayload {
  status: string;
  closure_reason?: string;
}

export interface AddParticipantPayload {
  employee_id?: string;
  name: string;
  role: string;
  statement?: string;
  has_conflict_of_interest?: boolean;
  conflict_of_interest_details?: string;
}

export interface CreateMeetingPayload {
  meeting_type?: string;
  scheduled_at: string;
  location?: string;
  conducted_by: string;
  attendees?: string;
  minutes?: string;
  agreed_points?: string;
  status?: string;
}

export interface CreateActionPayload {
  title: string;
  description: string;
  action_type?: string;
  assigned_to: string;
  due_date: string;
}

export interface UpdateActionPayload {
  status: string;
  completion_notes?: string;
}

export interface CreateFollowUpPayload {
  review_date?: string;
  reviewed_by: string;
  feedback_complainant?: string;
  feedback_respondent?: string;
  retaliation_detected?: boolean;
  is_stable?: boolean;
  notes: string;
}

