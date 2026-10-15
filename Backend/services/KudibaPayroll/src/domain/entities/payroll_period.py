from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID, uuid4
from src.domain.value_objects.enums import PeriodStatus
from src.domain.entities.payslip import Payslip
from src.domain.error import PeriodClosedError


@dataclass
class PayrollPeriod:
    id: UUID
    tenant_id: UUID
    title: str
    year: int
    month: int
    start_date: date
    end_date: date
    status: PeriodStatus
    total_gross: Decimal = Decimal("0.00")
    total_net: Decimal = Decimal("0.00")
    total_irt: Decimal = Decimal("0.00")
    total_inss_employee: Decimal = Decimal("0.00")
    total_inss_employer: Decimal = Decimal("0.00")
    closed_at: Optional[datetime] = None
    payslips: List[Payslip] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        title: str,
        year: int,
        month: int,
        start_date: date,
        end_date: date,
    ) -> "PayrollPeriod":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            title=title,
            year=year,
            month=month,
            start_date=start_date,
            end_date=end_date,
            status=PeriodStatus.DRAFT,
            payslips=[],
        )

    def set_calculated(self, payslips: List[Payslip]) -> None:
        if self.status == PeriodStatus.CLOSED:
            raise PeriodClosedError()

        self.payslips = payslips
        self.status = PeriodStatus.CALCULATED

        gross = Decimal("0.00")
        net = Decimal("0.00")
        irt = Decimal("0.00")
        inss_emp = Decimal("0.00")
        inss_empr = Decimal("0.00")

        for p in payslips:
            gross += p.total_gross
            net += p.net_salary
            irt += p.irt
            inss_emp += p.inss_employee
            inss_empr += p.inss_employer

        self.total_gross = gross
        self.total_net = net
        self.total_irt = irt
        self.total_inss_employee = inss_emp
        self.total_inss_employer = inss_empr

    def close(self) -> None:
        if self.status == PeriodStatus.CLOSED:
            raise PeriodClosedError()
        self.status = PeriodStatus.CLOSED
        self.closed_at = datetime.now(timezone.utc)
