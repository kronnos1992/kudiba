from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip


class PayrollRepository(ABC):
    @abstractmethod
    async def get_period_by_id(self, tenant_id: UUID, period_id: UUID) -> Optional[PayrollPeriod]:
        pass

    @abstractmethod
    async def get_period_by_year_month(self, tenant_id: UUID, year: int, month: int) -> Optional[PayrollPeriod]:
        pass

    @abstractmethod
    async def list_periods(self, tenant_id: UUID) -> List[PayrollPeriod]:
        pass

    @abstractmethod
    async def save_period(self, period: PayrollPeriod) -> None:
        pass

    @abstractmethod
    async def save_payslips(self, period_id: UUID, payslips: List[Payslip]) -> None:
        pass

    @abstractmethod
    async def list_payslips_by_period(self, tenant_id: UUID, period_id: UUID) -> List[Payslip]:
        pass

    @abstractmethod
    async def get_payslip_by_id(self, tenant_id: UUID, payslip_id: UUID) -> Optional[Payslip]:
        pass
