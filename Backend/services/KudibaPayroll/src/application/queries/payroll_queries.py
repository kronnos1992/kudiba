from typing import List, Optional
from uuid import UUID
from src.domain.entities.employee import Employee
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip
from src.domain.error import EntityNotFoundError
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.payroll_repository import PayrollRepository


class GetEmployeeUseCase:
    def __init__(self, employee_repo: EmployeeRepository):
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, employee_id: UUID) -> Employee:
        employee = await self.employee_repo.get_by_id(tenant_id, employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(employee_id))
        return employee


class ListEmployeesUseCase:
    def __init__(self, employee_repo: EmployeeRepository):
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID) -> List[Employee]:
        return await self.employee_repo.list_active(tenant_id)


class GetPayrollPeriodUseCase:
    def __init__(self, payroll_repo: PayrollRepository):
        self.payroll_repo = payroll_repo

    async def execute(self, tenant_id: UUID, period_id: UUID) -> PayrollPeriod:
        period = await self.payroll_repo.get_period_by_id(tenant_id, period_id)
        if not period:
            raise EntityNotFoundError("Período de Processamento", str(period_id))
        return period


class ListPayrollPeriodsUseCase:
    def __init__(self, payroll_repo: PayrollRepository):
        self.payroll_repo = payroll_repo

    async def execute(self, tenant_id: UUID) -> List[PayrollPeriod]:
        return await self.payroll_repo.list_periods(tenant_id)


class ListPayslipsUseCase:
    def __init__(self, payroll_repo: PayrollRepository):
        self.payroll_repo = payroll_repo

    async def execute(self, tenant_id: UUID, period_id: UUID) -> List[Payslip]:
        return await self.payroll_repo.list_payslips_by_period(tenant_id, period_id)


class GetPayslipUseCase:
    def __init__(self, payroll_repo: PayrollRepository):
        self.payroll_repo = payroll_repo

    async def execute(self, tenant_id: UUID, payslip_id: UUID) -> Payslip:
        payslip = await self.payroll_repo.get_payslip_by_id(tenant_id, payslip_id)
        if not payslip:
            raise EntityNotFoundError("Recibo de Vencimento", str(payslip_id))
        return payslip
