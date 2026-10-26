import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ENUM as PgEnum
from sqlalchemy.orm import declarative_base, Mapped, mapped_column, relationship

Base = declarative_base()


def pg_enum(name: str, *values: str) -> PgEnum:
    """Mapeia um tipo ENUM nativo já existente no schema `kudiba_payroll`.

    `create_type=False` impede o SQLAlchemy de tentar emitir `CREATE TYPE`,
    já que os tipos são geridos pelo DDL em `Backend/deploy/07-payroll-schema.sql`.
    """
    return PgEnum(*values, name=name, schema="kudiba_payroll", create_type=False)


class DepartmentModel(Base):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_dept_tenant_code"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class JobPositionModel(Base):
    __tablename__ = "job_positions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_job_tenant_code"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.departments.id"), nullable=True
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    base_salary_min: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    base_salary_max: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class EmployeeModel(Base):
    __tablename__ = "employees"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_emp_tenant_code"),
        UniqueConstraint("tenant_id", "nif", name="uq_emp_tenant_nif"),
        UniqueConstraint("tenant_id", "identity_card_number", name="uq_emp_tenant_bi"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    nif: Mapped[str] = mapped_column(String(20), nullable=False)
    inss_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    identity_card_number: Mapped[str] = mapped_column(String(30), nullable=False)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    marital_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    dependents_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    iban: Mapped[str] = mapped_column(String(34), nullable=False)
    bank_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        pg_enum("employee_status", "ACTIVE", "ON_LEAVE", "SUSPENDED", "TERMINATED"),
        default="ACTIVE",
        nullable=False,
    )
    hire_date: Mapped[date] = mapped_column(Date, nullable=False)
    termination_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class ContractModel(Base):
    __tablename__ = "contracts"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=False, index=True
    )
    job_position_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.job_positions.id"), nullable=True
    )
    contract_type: Mapped[str] = mapped_column(
        pg_enum("contract_type", "PERMANENT", "FIXED_TERM", "PROBATION", "PART_TIME", "INTERNSHIP"),
        default="PERMANENT",
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    base_salary: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        pg_enum("contract_status", "ACTIVE", "SUSPENDED", "TERMINATED"),
        default="ACTIVE",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    components: Mapped[List["SalaryComponentModel"]] = relationship(
        "SalaryComponentModel", back_populates="contract", cascade="all, delete-orphan", lazy="selectin"
    )


class SalaryComponentModel(Base):
    __tablename__ = "salary_components"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.contracts.id"), nullable=False, index=True
    )
    component_type: Mapped[str] = mapped_column(
        pg_enum(
            "component_type",
            "BASE_SALARY",
            "FOOD_ALLOWANCE",
            "TRANSPORT_ALLOWANCE",
            "HOUSING_ALLOWANCE",
            "FUNCTION_ALLOWANCE",
            "OVERTIME_50",
            "OVERTIME_75",
            "BONUS",
            "DEDUCTION_ADVANCE",
            "DEDUCTION_LOAN",
            "OTHER_EARNING",
            "OTHER_DEDUCTION",
        ),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    is_taxable_irt: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_taxable_inss: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    contract: Mapped["ContractModel"] = relationship("ContractModel", back_populates="components")


class PayrollPeriodModel(Base):
    __tablename__ = "payroll_periods"
    __table_args__ = (
        UniqueConstraint("tenant_id", "year", "month", name="uq_period_tenant_year_month"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        pg_enum("period_status", "DRAFT", "CALCULATED", "CLOSED"),
        default="DRAFT",
        nullable=False,
    )
    total_gross: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_net: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_irt: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_inss_employee: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_inss_employer: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class PayslipModel(Base):
    __tablename__ = "payslips"
    __table_args__ = (
        UniqueConstraint("period_id", "employee_id", name="uq_payslip_period_employee"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    period_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.payroll_periods.id"), nullable=False, index=True
    )
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=False, index=True
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.contracts.id"), nullable=False
    )
    days_worked: Mapped[int] = mapped_column(Integer, default=22, nullable=False)
    base_salary: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_gross: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_allowances: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    total_overtime: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    base_inss: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    inss_employee: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    inss_employer: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    materia_coletavel_irt: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    irt: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    net_salary: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        pg_enum("payslip_status", "DRAFT", "APPROVED", "PAID"),
        default="DRAFT",
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    lines: Mapped[List["PayslipLineModel"]] = relationship(
        "PayslipLineModel", back_populates="payslip", cascade="all, delete-orphan", lazy="selectin"
    )


class PayslipLineModel(Base):
    __tablename__ = "payslip_lines"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    payslip_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.payslips.id"), nullable=False, index=True
    )
    line_type: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_value: Mapped[Decimal] = mapped_column(Numeric(15, 2), default=Decimal("0.00"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1.00"), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), default=Decimal("0.0000"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    payslip: Mapped["PayslipModel"] = relationship("PayslipModel", back_populates="lines")


class VacationRequestModel(Base):
    __tablename__ = "vacation_requests"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=False, index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        pg_enum("vacation_status", "PENDING", "APPROVED", "REJECTED", "CANCELLED"),
        default="PENDING",
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decided_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    decided_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class AbsenceRecordModel(Base):
    __tablename__ = "absence_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "employee_id", "absence_date", name="uq_absence_employee_date"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=False, index=True
    )
    absence_date: Mapped[date] = mapped_column(Date, nullable=False)
    absence_type: Mapped[str] = mapped_column(
        pg_enum(
            "absence_type",
            "UNJUSTIFIED",
            "JUSTIFIED",
            "SICKNESS",
            "MATERNITY",
            "PATERNITY",
            "BEREAVEMENT",
        ),
        default="UNJUSTIFIED",
        nullable=False,
    )
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class AttendanceRecordModel(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "employee_id", "punched_at", "direction", name="uq_attendance_employee_punch"
        ),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=False, index=True
    )
    employee_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    punched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    direction: Mapped[str] = mapped_column(
        pg_enum("attendance_direction", "IN", "OUT", "UNKNOWN"),
        default="UNKNOWN",
        nullable=False,
    )
    device_id: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    external_id: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class PayrollOutboxModel(Base):
    __tablename__ = "payroll_outbox"
    __table_args__ = {"schema": "kudiba_payroll"}

    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    aggregate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    routing_key: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class ConflictCaseModel(Base):
    __tablename__ = "conflict_cases"
    __table_args__ = (
        UniqueConstraint("tenant_id", "reference_code", name="uq_conflict_case_ref"),
        {"schema": "kudiba_payroll"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    reference_code: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    conflict_type: Mapped[str] = mapped_column(String(50), nullable=False, default="INTERPESSOAL")
    severity: Mapped[str] = mapped_column(String(30), nullable=False, default="MEDIA")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="EM_TRIAGEM")
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.departments.id"), nullable=True
    )
    department_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    incident_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    is_confidential: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    complainant_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=True
    )
    complainant_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    respondent_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=True
    )
    respondent_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assigned_mediator_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_mediator_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    resolution_route: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="MEDIACAO")
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    retaliation_risk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    urgent_protection_measures: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    participants: Mapped[List["ConflictParticipantModel"]] = relationship(
        "ConflictParticipantModel", back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
    meetings: Mapped[List["ConflictMeetingModel"]] = relationship(
        "ConflictMeetingModel", back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
    actions: Mapped[List["ConflictActionModel"]] = relationship(
        "ConflictActionModel", back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
    follow_ups: Mapped[List["ConflictFollowUpModel"]] = relationship(
        "ConflictFollowUpModel", back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
    audit_logs: Mapped[List["ConflictAuditLogModel"]] = relationship(
        "ConflictAuditLogModel", back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )


class ConflictParticipantModel(Base):
    __tablename__ = "conflict_participants"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.conflict_cases.id"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.employees.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(40), nullable=False)
    statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    statement_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    has_conflict_of_interest: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    conflict_of_interest_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    case: Mapped["ConflictCaseModel"] = relationship("ConflictCaseModel", back_populates="participants")


class ConflictMeetingModel(Base):
    __tablename__ = "conflict_meetings"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.conflict_cases.id"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    meeting_type: Mapped[str] = mapped_column(String(50), nullable=False, default="INDIVIDUAL_HEARING")
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False, default="Gabinete RH Confidencial")
    conducted_by: Mapped[str] = mapped_column(String(255), nullable=False)
    attendees: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    minutes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agreed_points: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="SCHEDULED")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    case: Mapped["ConflictCaseModel"] = relationship("ConflictCaseModel", back_populates="meetings")


class ConflictActionModel(Base):
    __tablename__ = "conflict_actions"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.conflict_cases.id"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False, default="COMPROMISSO_CONDUTA")
    assigned_to: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    completion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    case: Mapped["ConflictCaseModel"] = relationship("ConflictCaseModel", back_populates="actions")


class ConflictFollowUpModel(Base):
    __tablename__ = "conflict_follow_ups"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.conflict_cases.id"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    review_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    reviewed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    feedback_complainant: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    feedback_respondent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retaliation_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_stable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    case: Mapped["ConflictCaseModel"] = relationship("ConflictCaseModel", back_populates="follow_ups")


class ConflictAuditLogModel(Base):
    __tablename__ = "conflict_audit_logs"
    __table_args__ = {"schema": "kudiba_payroll"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("kudiba_payroll.conflict_cases.id"), nullable=False, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    performed_by: Mapped[str] = mapped_column(String(255), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    case: Mapped["ConflictCaseModel"] = relationship("ConflictCaseModel", back_populates="audit_logs")


