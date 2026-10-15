from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4
from src.domain.value_objects.enums import PayslipStatus, PayslipLineType


@dataclass
class PayslipLine:
    id: UUID
    tenant_id: UUID
    payslip_id: UUID
    line_type: PayslipLineType
    code: str
    description: str
    reference_value: Decimal
    quantity: Decimal
    rate: Decimal
    amount: Decimal
    created_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        payslip_id: UUID,
        line_type: PayslipLineType,
        code: str,
        description: str,
        reference_value: Decimal,
        quantity: Decimal,
        rate: Decimal,
        amount: Decimal,
    ) -> "PayslipLine":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            payslip_id=payslip_id,
            line_type=line_type,
            code=code,
            description=description,
            reference_value=reference_value,
            quantity=quantity,
            rate=rate,
            amount=amount,
        )


@dataclass
class Payslip:
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
    lines: List[PayslipLine] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        period_id: UUID,
        employee_id: UUID,
        contract_id: UUID,
        days_worked: int,
        base_salary: Decimal,
        total_gross: Decimal,
        total_allowances: Decimal,
        total_overtime: Decimal,
        base_inss: Decimal,
        inss_employee: Decimal,
        inss_employer: Decimal,
        materia_coletavel_irt: Decimal,
        irt: Decimal,
        total_deductions: Decimal,
        net_salary: Decimal,
    ) -> "Payslip":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            period_id=period_id,
            employee_id=employee_id,
            contract_id=contract_id,
            days_worked=days_worked,
            base_salary=base_salary,
            total_gross=total_gross,
            total_allowances=total_allowances,
            total_overtime=total_overtime,
            base_inss=base_inss,
            inss_employee=inss_employee,
            inss_employer=inss_employer,
            materia_coletavel_irt=materia_coletavel_irt,
            irt=irt,
            total_deductions=total_deductions,
            net_salary=net_salary,
            status=PayslipStatus.DRAFT,
            lines=[],
        )

    def approve(self) -> None:
        self.status = PayslipStatus.APPROVED

    def mark_paid(self) -> None:
        self.status = PayslipStatus.PAID
