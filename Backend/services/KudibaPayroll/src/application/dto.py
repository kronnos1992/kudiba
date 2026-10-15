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
    days_worked: int = Field(22, ge=0, le=31)
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
