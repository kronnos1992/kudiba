from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from src.application.dto import (
    AnnualPayrollSummary,
    EmployeePayslipSummary,
    EmployeeStatusCounts,
    MonthlyPayrollPoint,
    OrganizationSummary,
    PayrollDashboardSummaryResponse,
    PayrollPeriodTotals,
    PeriodSummaryResponse,
    VacationBalanceResponse,
)
from src.domain.entities.contract import Contract
from src.domain.entities.employee import Employee
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip
from src.domain.error import EntityNotFoundError
from src.domain.ports.contract_repository import ContractRepository
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.hr_repository import HrRepository
from src.domain.ports.organization_repository import OrganizationRepository
from src.domain.ports.payroll_repository import PayrollRepository
from src.domain.value_objects.enums import EmployeeStatus


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


class ListContractsUseCase:
    def __init__(self, contract_repo: ContractRepository):
        self.contract_repo = contract_repo

    async def execute(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
    ) -> List[Contract]:
        return await self.contract_repo.list_contracts(tenant_id, employee_id=employee_id)


class GetContractUseCase:
    def __init__(self, contract_repo: ContractRepository):
        self.contract_repo = contract_repo

    async def execute(self, tenant_id: UUID, contract_id: UUID) -> Contract:
        contract = await self.contract_repo.get_by_id(tenant_id, contract_id)
        if not contract:
            raise EntityNotFoundError("Contrato", str(contract_id))
        return contract


class GetPeriodSummaryUseCase:
    def __init__(
        self,
        payroll_repo: PayrollRepository,
        employee_repo: EmployeeRepository,
    ):
        self.payroll_repo = payroll_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, period_id: UUID) -> PeriodSummaryResponse:
        period = await self.payroll_repo.get_period_by_id(tenant_id, period_id)
        if not period:
            raise EntityNotFoundError("Período de Processamento", str(period_id))

        payslips = await self.payroll_repo.list_payslips_by_period(tenant_id, period_id)

        summaries: List[EmployeePayslipSummary] = []
        for p in payslips:
            employee = await self.employee_repo.get_by_id(tenant_id, p.employee_id)
            summaries.append(
                EmployeePayslipSummary(
                    payslip_id=p.id,
                    employee_id=p.employee_id,
                    full_name=employee.full_name if employee else "Colaborador",
                    total_gross=p.total_gross,
                    total_deductions=p.total_deductions,
                    net_salary=p.net_salary,
                    status=p.status,
                )
            )

        return PeriodSummaryResponse(
            period_id=period.id,
            title=period.title,
            year=period.year,
            month=period.month,
            status=period.status,
            employee_count=len(payslips),
            total_gross=period.total_gross,
            total_irt=period.total_irt,
            total_inss_employee=period.total_inss_employee,
            total_inss_employer=period.total_inss_employer,
            total_net=period.total_net,
            payslips=summaries,
        )


class GetVacationBalanceUseCase:
    def __init__(self, hr_repo: HrRepository, employee_repo: EmployeeRepository):
        self.hr_repo = hr_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, employee_id: UUID, year: int) -> VacationBalanceResponse:
        employee = await self.employee_repo.get_by_id(tenant_id, employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(employee_id))

        balance = await self.hr_repo.get_vacation_balance(tenant_id, employee_id, year)
        return VacationBalanceResponse(
            employee_id=balance.employee_id,
            year=balance.year,
            entitled_days=balance.entitled_days,
            used_days=balance.used_days,
            pending_days=balance.pending_days,
            available_days=balance.available_days,
        )


class GetDashboardSummaryUseCase:
    def __init__(
        self,
        employee_repo: EmployeeRepository,
        payroll_repo: PayrollRepository,
        org_repo: OrganizationRepository,
    ):
        self.employee_repo = employee_repo
        self.payroll_repo = payroll_repo
        self.org_repo = org_repo

    async def execute(
        self, tenant_id: UUID, year: Optional[int] = None
    ) -> PayrollDashboardSummaryResponse:
        target_year = year or datetime.now(timezone.utc).year

        status_counts = await self.employee_repo.count_by_status(tenant_id)
        employees = EmployeeStatusCounts(
            total=sum(status_counts.values()),
            active=status_counts.get(EmployeeStatus.ACTIVE.value, 0),
            on_leave=status_counts.get(EmployeeStatus.ON_LEAVE.value, 0),
            suspended=status_counts.get(EmployeeStatus.SUSPENDED.value, 0),
            terminated=status_counts.get(EmployeeStatus.TERMINATED.value, 0),
        )

        departments = await self.org_repo.list_departments(tenant_id)
        job_positions = await self.org_repo.list_job_positions(tenant_id)

        periods = await self.payroll_repo.list_periods(tenant_id)
        latest = periods[0] if periods else None
        latest_period = (
            PayrollPeriodTotals(
                period_id=latest.id,
                title=latest.title,
                year=latest.year,
                month=latest.month,
                status=latest.status,
                total_gross=latest.total_gross,
                total_net=latest.total_net,
                total_irt=latest.total_irt,
                total_inss_employee=latest.total_inss_employee,
                total_inss_employer=latest.total_inss_employer,
            )
            if latest
            else None
        )

        year_periods = [p for p in periods if p.year == target_year]
        monthly = sorted(
            [
                MonthlyPayrollPoint(
                    month=p.month,
                    status=p.status,
                    total_gross=p.total_gross,
                    total_net=p.total_net,
                )
                for p in year_periods
            ],
            key=lambda point: point.month,
        )

        annual = AnnualPayrollSummary(
            year=target_year,
            periods_processed=len(year_periods),
            total_gross=sum((p.total_gross for p in year_periods), Decimal("0.00")),
            total_net=sum((p.total_net for p in year_periods), Decimal("0.00")),
            total_irt=sum((p.total_irt for p in year_periods), Decimal("0.00")),
            total_inss_employee=sum(
                (p.total_inss_employee for p in year_periods), Decimal("0.00")
            ),
            total_inss_employer=sum(
                (p.total_inss_employer for p in year_periods), Decimal("0.00")
            ),
            monthly=monthly,
        )

        return PayrollDashboardSummaryResponse(
            generated_at=datetime.now(timezone.utc),
            employees=employees,
            organization=OrganizationSummary(
                departments=len(departments),
                job_positions=len(job_positions),
            ),
            latest_period=latest_period,
            annual=annual,
        )
