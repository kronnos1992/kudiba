from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from src.domain.value_objects.enums import (
    ContractType,
    EmployeeStatus,
    ContractStatus,
    PeriodStatus,
    ComponentType,
    PayslipStatus,
    PayslipLineType,
    VacationStatus,
    AbsenceType,
    AttendanceDirection,
)


class CreateEmployeeRequest(BaseModel):
    code: str = Field(..., max_length=50)
    full_name: str = Field(..., max_length=255)
    nif: str = Field(..., max_length=20)
    identity_card_number: str = Field(..., max_length=30)
    iban: str = Field(..., min_length=25, max_length=34)
    hire_date: date
    inss_number: Optional[str] = Field(None, max_length=30)
    birth_date: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=10)
    marital_status: Optional[str] = Field(None, max_length=20)
    dependents_count: int = Field(0, ge=0)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    bank_code: Optional[str] = Field(None, max_length=10)
    address: Optional[str] = None


class TerminateEmployeeRequest(BaseModel):
    termination_date: date


class UpdateEmployeeRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    identity_card_number: Optional[str] = Field(None, max_length=30)
    iban: Optional[str] = Field(None, min_length=25, max_length=34)
    inss_number: Optional[str] = Field(None, max_length=30)
    birth_date: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=10)
    marital_status: Optional[str] = Field(None, max_length=20)
    dependents_count: Optional[int] = Field(None, ge=0)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    bank_code: Optional[str] = Field(None, max_length=10)
    address: Optional[str] = None


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    code: str
    full_name: str
    nif: str
    identity_card_number: str
    iban: str
    hire_date: date
    status: EmployeeStatus
    inss_number: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    dependents_count: int = 0
    email: Optional[str] = None
    phone: Optional[str] = None
    bank_code: Optional[str] = None
    address: Optional[str] = None
    termination_date: Optional[date] = None
    created_at: Optional[datetime] = None


class AddSalaryComponentRequest(BaseModel):
    component_type: ComponentType
    name: str = Field(..., max_length=100)
    amount: Decimal = Field(..., ge=Decimal("0.00"))
    is_taxable_irt: bool = True
    is_taxable_inss: bool = True


class SalaryComponentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contract_id: UUID
    component_type: ComponentType
    name: str
    amount: Decimal
    is_taxable_irt: bool
    is_taxable_inss: bool
    is_active: bool


class CreateContractRequest(BaseModel):
    employee_id: UUID
    contract_type: ContractType = ContractType.PERMANENT
    start_date: date
    base_salary: Decimal = Field(..., ge=Decimal("0.00"))
    job_position_id: Optional[UUID] = None
    end_date: Optional[date] = None
    components: List[AddSalaryComponentRequest] = Field(default_factory=list)


class ContractResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    employee_id: UUID
    contract_type: ContractType
    start_date: date
    end_date: Optional[date] = None
    base_salary: Decimal
    status: ContractStatus
    job_position_id: Optional[UUID] = None
    components: List[SalaryComponentResponse] = Field(default_factory=list)


class OpenPayrollPeriodRequest(BaseModel):
    title: str = Field(..., max_length=150)
    year: int = Field(..., ge=2020)
    month: int = Field(..., ge=1, le=12)
    start_date: date
    end_date: date


class EmployeeOvertimeInput(BaseModel):
    employee_id: UUID
    overtime_50_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    overtime_75_hours: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    days_worked: Optional[int] = Field(None, ge=0, le=31)
    advances: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    other_deductions: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))


class CalculatePayrollPeriodRequest(BaseModel):
    overtime_data: List[EmployeeOvertimeInput] = Field(default_factory=list)


class PayslipLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    line_type: PayslipLineType
    code: str
    description: str
    reference_value: Decimal
    quantity: Decimal
    rate: Decimal
    amount: Decimal


class PayslipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    period_id: UUID
    employee_id: UUID
    contract_id: UUID
    days_worked: int
    base_salary: Decimal
    total_gross: Decimal
    total_allowances: Decimal
    total_overtime: Decimal
    base_inss: Decimal
    inss_employee: Decimal
    inss_employer: Decimal
    materia_coletavel_irt: Decimal
    irt: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: PayslipStatus
    lines: List[PayslipLineResponse] = Field(default_factory=list)


class PayrollPeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    title: str
    year: int
    month: int
    start_date: date
    end_date: date
    status: PeriodStatus
    total_gross: Decimal
    total_net: Decimal
    total_irt: Decimal
    total_inss_employee: Decimal
    total_inss_employer: Decimal
    closed_at: Optional[datetime] = None


class Ps2ExportResponse(BaseModel):
    filename: str
    content: str
    total_records: int
    total_amount: Decimal


class CreateDepartmentRequest(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    code: str
    name: str
    description: Optional[str] = None


class CreateJobPositionRequest(BaseModel):
    code: str = Field(..., max_length=50)
    title: str = Field(..., max_length=255)
    department_id: Optional[UUID] = None
    base_salary_min: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))
    base_salary_max: Decimal = Field(Decimal("0.00"), ge=Decimal("0.00"))


class JobPositionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    code: str
    title: str
    department_id: Optional[UUID] = None
    base_salary_min: Decimal
    base_salary_max: Decimal


class EmployeePayslipSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    payslip_id: UUID
    employee_id: UUID
    full_name: str
    total_gross: Decimal
    total_deductions: Decimal
    net_salary: Decimal
    status: PayslipStatus


class PeriodSummaryResponse(BaseModel):
    period_id: UUID
    title: str
    year: int
    month: int
    status: PeriodStatus
    employee_count: int
    total_gross: Decimal
    total_irt: Decimal
    total_inss_employee: Decimal
    total_inss_employer: Decimal
    total_net: Decimal
    payslips: List[EmployeePayslipSummary] = Field(default_factory=list)


class CreateVacationRequest(BaseModel):
    employee_id: UUID
    start_date: date
    end_date: date
    days: Optional[int] = Field(None, ge=1, le=60)
    notes: Optional[str] = None


class VacationDecisionRequest(BaseModel):
    decided_by: UUID


class VacationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    employee_id: UUID
    start_date: date
    end_date: date
    days: int
    status: VacationStatus
    notes: Optional[str] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None


class VacationBalanceResponse(BaseModel):
    employee_id: UUID
    year: int
    entitled_days: Decimal
    used_days: Decimal
    pending_days: Decimal
    available_days: Decimal


class CreateAbsenceRequest(BaseModel):
    employee_id: UUID
    absence_date: date
    absence_type: AbsenceType = AbsenceType.UNJUSTIFIED
    is_paid: bool = False
    notes: Optional[str] = None


class AbsenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    employee_id: UUID
    absence_date: date
    absence_type: str
    is_paid: bool
    notes: Optional[str] = None


class CreateAttendanceRequest(BaseModel):
    employee_id: Optional[UUID] = None
    employee_code: Optional[str] = Field(None, max_length=50)
    punched_at: datetime
    direction: AttendanceDirection = AttendanceDirection.UNKNOWN
    device_id: Optional[str] = Field(None, max_length=120)
    source: Optional[str] = Field(None, max_length=120)
    external_id: Optional[str] = Field(None, max_length=160)
    notes: Optional[str] = None


class AttendanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    employee_id: UUID
    employee_code: Optional[str] = None
    punched_at: datetime
    direction: AttendanceDirection
    device_id: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None


class EmployeeStatusCounts(BaseModel):
    total: int
    active: int
    on_leave: int
    suspended: int
    terminated: int


class OrganizationSummary(BaseModel):
    departments: int
    job_positions: int


class PayrollPeriodTotals(BaseModel):
    period_id: UUID
    title: str
    year: int
    month: int
    status: PeriodStatus
    total_gross: Decimal
    total_net: Decimal
    total_irt: Decimal
    total_inss_employee: Decimal
    total_inss_employer: Decimal


class MonthlyPayrollPoint(BaseModel):
    month: int
    status: PeriodStatus
    total_gross: Decimal
    total_net: Decimal


class AnnualPayrollSummary(BaseModel):
    year: int
    periods_processed: int
    total_gross: Decimal
    total_net: Decimal
    total_irt: Decimal
    total_inss_employee: Decimal
    total_inss_employer: Decimal
    monthly: List[MonthlyPayrollPoint] = Field(default_factory=list)


class PayrollDashboardSummaryResponse(BaseModel):
    generated_at: datetime
    employees: EmployeeStatusCounts
    organization: OrganizationSummary
    latest_period: Optional[PayrollPeriodTotals] = None
    annual: AnnualPayrollSummary


class ConflictParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    tenant_id: UUID
    employee_id: Optional[UUID] = None
    name: str
    role: str
    statement: Optional[str] = None
    statement_date: Optional[datetime] = None
    has_conflict_of_interest: bool = False
    conflict_of_interest_details: Optional[str] = None
    created_at: datetime


class AddParticipantRequest(BaseModel):
    employee_id: Optional[UUID] = None
    name: str = Field(..., max_length=255)
    role: str = Field(..., max_length=40)
    statement: Optional[str] = None
    has_conflict_of_interest: bool = False
    conflict_of_interest_details: Optional[str] = None


class ConflictMeetingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    tenant_id: UUID
    meeting_type: str
    scheduled_at: datetime
    location: str
    conducted_by: str
    attendees: Optional[str] = None
    minutes: Optional[str] = None
    agreed_points: Optional[str] = None
    status: str
    created_at: datetime


class CreateMeetingRequest(BaseModel):
    meeting_type: str = "INDIVIDUAL_HEARING"
    scheduled_at: datetime
    location: str = "Gabinete RH Confidencial"
    conducted_by: str = Field(..., max_length=255)
    attendees: Optional[str] = None
    minutes: Optional[str] = None
    agreed_points: Optional[str] = None
    status: str = "SCHEDULED"


class ConflictActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    tenant_id: UUID
    title: str
    description: str
    action_type: str
    assigned_to: str
    due_date: date
    status: str
    completion_notes: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class CreateActionRequest(BaseModel):
    title: str = Field(..., max_length=255)
    description: str
    action_type: str = "COMPROMISSO_CONDUTA"
    assigned_to: str = Field(..., max_length=255)
    due_date: date


class UpdateActionRequest(BaseModel):
    status: str
    completion_notes: Optional[str] = None


class ConflictFollowUpResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    tenant_id: UUID
    review_date: date
    reviewed_by: str
    feedback_complainant: Optional[str] = None
    feedback_respondent: Optional[str] = None
    retaliation_detected: bool = False
    is_stable: bool = True
    notes: str
    created_at: datetime


class CreateFollowUpRequest(BaseModel):
    review_date: date = Field(default_factory=date.today)
    reviewed_by: str = Field(..., max_length=255)
    feedback_complainant: Optional[str] = None
    feedback_respondent: Optional[str] = None
    retaliation_detected: bool = False
    is_stable: bool = True
    notes: str


class ConflictAuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    case_id: UUID
    tenant_id: UUID
    action: str
    performed_by: str
    details: Optional[str] = None
    created_at: datetime


class ConflictCaseSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    reference_code: str
    title: str
    conflict_type: str
    severity: str
    status: str
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
    incident_date: date
    reported_at: datetime
    is_confidential: bool
    complainant_employee_id: Optional[UUID] = None
    complainant_name: Optional[str] = None
    respondent_employee_id: Optional[UUID] = None
    respondent_name: Optional[str] = None
    assigned_mediator_id: Optional[str] = None
    assigned_mediator_name: Optional[str] = None
    resolution_route: Optional[str] = None
    summary: str
    retaliation_risk: bool
    urgent_protection_measures: Optional[str] = None
    closure_reason: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    participants_count: int = 0
    meetings_count: int = 0
    actions_count: int = 0


class ConflictCaseDetailResponse(ConflictCaseSummaryResponse):
    participants: List[ConflictParticipantResponse] = Field(default_factory=list)
    meetings: List[ConflictMeetingResponse] = Field(default_factory=list)
    actions: List[ConflictActionResponse] = Field(default_factory=list)
    follow_ups: List[ConflictFollowUpResponse] = Field(default_factory=list)
    audit_logs: List[ConflictAuditLogResponse] = Field(default_factory=list)


class CreateConflictCaseRequest(BaseModel):
    title: str = Field(..., max_length=255)
    conflict_type: str = "INTERPESSOAL"
    severity: str = "MEDIA"
    department_id: Optional[UUID] = None
    incident_date: date = Field(default_factory=date.today)
    is_confidential: bool = False
    complainant_employee_id: Optional[UUID] = None
    complainant_name: Optional[str] = None
    respondent_employee_id: Optional[UUID] = None
    respondent_name: Optional[str] = None
    summary: str
    retaliation_risk: bool = False
    urgent_protection_measures: Optional[str] = None


class TriageConflictCaseRequest(BaseModel):
    severity: str
    resolution_route: str
    assigned_mediator_id: Optional[str] = None
    assigned_mediator_name: Optional[str] = None
    retaliation_risk: bool = False
    urgent_protection_measures: Optional[str] = None
    status: Optional[str] = None


class UpdateConflictStatusRequest(BaseModel):
    status: str
    closure_reason: Optional[str] = None


class ConflictDashboardResponse(BaseModel):
    total_cases: int
    open_cases: int
    in_mediation: int
    in_investigation: int
    resolved: int
    high_retaliation_risk: int
    avg_resolution_days: float
    by_type: dict[str, int]
    by_severity: dict[str, int]
    by_department: dict[str, int]

