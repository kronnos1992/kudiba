from decimal import Decimal
from typing import Dict, List
from uuid import UUID, uuid4
from src.application.dto import OpenPayrollPeriodRequest, CalculatePayrollPeriodRequest
from src.domain.entities.payroll_period import PayrollPeriod
from src.domain.entities.payslip import Payslip, PayslipLine
from src.domain.error import ConflictError, EntityNotFoundError, PeriodClosedError
from src.domain.ports.contract_repository import ContractRepository
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.payroll_repository import PayrollRepository
from src.domain.ports.event_publisher import EventPublisher
from src.domain.services.payroll_processor import PayrollProcessor
from src.domain.value_objects.enums import ComponentType, PeriodStatus


class OpenPayrollPeriodUseCase:
    def __init__(self, payroll_repo: PayrollRepository):
        self.payroll_repo = payroll_repo

    async def execute(self, tenant_id: UUID, req: OpenPayrollPeriodRequest) -> PayrollPeriod:
        existing = await self.payroll_repo.get_period_by_year_month(tenant_id, req.year, req.month)
        if existing:
            raise ConflictError(f"Já existe um período salarial para {req.month:02d}/{req.year}.")

        period = PayrollPeriod.create(
            tenant_id=tenant_id,
            title=req.title,
            year=req.year,
            month=req.month,
            start_date=req.start_date,
            end_date=req.end_date,
        )
        await self.payroll_repo.save_period(period)
        return period


class CalculatePayrollPeriodUseCase:
    def __init__(
        self,
        payroll_repo: PayrollRepository,
        contract_repo: ContractRepository,
        employee_repo: EmployeeRepository,
    ):
        self.payroll_repo = payroll_repo
        self.contract_repo = contract_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, period_id: UUID, req: CalculatePayrollPeriodRequest) -> PayrollPeriod:
        period = await self.payroll_repo.get_period_by_id(tenant_id, period_id)
        if not period:
            raise EntityNotFoundError("Período de Processamento", str(period_id))

        if period.status == PeriodStatus.CLOSED:
            raise PeriodClosedError()

        active_contracts = await self.contract_repo.list_active_contracts(tenant_id)

        overtime_map = {item.employee_id: item for item in req.overtime_data}

        payslips: List[Payslip] = []

        for contract in active_contracts:
            ot_input = overtime_map.get(contract.employee_id)
            days_worked = ot_input.days_worked if ot_input else 22
            ot_50_hours = ot_input.overtime_50_hours if ot_input else Decimal("0.00")
            ot_75_hours = ot_input.overtime_75_hours if ot_input else Decimal("0.00")
            advances = ot_input.advances if ot_input else Decimal("0.00")
            other_deductions = ot_input.other_deductions if ot_input else Decimal("0.00")

            food_allowance = Decimal("0.00")
            transport_allowance = Decimal("0.00")
            housing_allowance = Decimal("0.00")
            function_allowance = Decimal("0.00")
            other_allowances = Decimal("0.00")

            for comp in contract.components:
                if not comp.is_active:
                    continue
                if comp.component_type == ComponentType.FOOD_ALLOWANCE:
                    food_allowance += comp.amount
                elif comp.component_type == ComponentType.TRANSPORT_ALLOWANCE:
                    transport_allowance += comp.amount
                elif comp.component_type == ComponentType.HOUSING_ALLOWANCE:
                    housing_allowance += comp.amount
                elif comp.component_type == ComponentType.FUNCTION_ALLOWANCE:
                    function_allowance += comp.amount
                elif comp.component_type in (ComponentType.BONUS, ComponentType.OTHER_EARNING):
                    other_allowances += comp.amount
                elif comp.component_type == ComponentType.DEDUCTION_ADVANCE:
                    advances += comp.amount
                elif comp.component_type == ComponentType.DEDUCTION_LOAN:
                    other_deductions += comp.amount

            res = PayrollProcessor.process_employee_payroll(
                base_salary=contract.base_salary,
                food_allowance=food_allowance,
                transport_allowance=transport_allowance,
                housing_allowance=housing_allowance,
                function_allowance=function_allowance,
                other_allowances=other_allowances,
                overtime_50_hours=ot_50_hours,
                overtime_75_hours=ot_75_hours,
                advances=advances,
                other_deductions=other_deductions,
                days_worked=days_worked,
            )

            payslip = Payslip.create(
                tenant_id=tenant_id,
                period_id=period.id,
                employee_id=contract.employee_id,
                contract_id=contract.id,
                days_worked=res["days_worked"],
                base_salary=res["base_salary"],
                total_gross=res["total_gross"],
                total_allowances=res["total_allowances"],
                total_overtime=res["total_overtime"],
                base_inss=res["base_inss"],
                inss_employee=res["inss_employee"],
                inss_employer=res["inss_employer"],
                materia_coletavel_irt=res["materia_coletavel_irt"],
                irt=res["irt"],
                total_deductions=res["total_deductions"],
                net_salary=res["net_salary"],
            )

            for line_data in res["lines"]:
                line = PayslipLine.create(
                    tenant_id=tenant_id,
                    payslip_id=payslip.id,
                    line_type=line_data["line_type"],
                    code=line_data["code"],
                    description=line_data["description"],
                    reference_value=line_data["reference_value"],
                    quantity=line_data["quantity"],
                    rate=line_data["rate"],
                    amount=line_data["amount"],
                )
                payslip.lines.append(line)

            payslips.append(payslip)

        period.set_calculated(payslips)
        await self.payroll_repo.save_period(period)
        await self.payroll_repo.save_payslips(period.id, payslips)
        return period


class ClosePayrollPeriodUseCase:
    def __init__(self, payroll_repo: PayrollRepository, event_publisher: EventPublisher):
        self.payroll_repo = payroll_repo
        self.event_publisher = event_publisher

    async def execute(self, tenant_id: UUID, period_id: UUID) -> PayrollPeriod:
        period = await self.payroll_repo.get_period_by_id(tenant_id, period_id)
        if not period:
            raise EntityNotFoundError("Período de Processamento", str(period_id))

        if period.status == PeriodStatus.CLOSED:
            raise PeriodClosedError()

        payslips = await self.payroll_repo.list_payslips_by_period(tenant_id, period_id)
        for p in payslips:
            p.approve()

        period.close()
        await self.payroll_repo.save_period(period)
        await self.payroll_repo.save_payslips(period.id, payslips)

        # Emissão do evento de integração com a Contabilidade Geral
        event_payload = {
            "event_id": str(uuid4()),
            "tenant_id": str(tenant_id),
            "period_id": str(period.id),
            "event_type": "payroll.period.closed",
            "payload": {
                "periodTitle": period.title,
                "year": period.year,
                "month": period.month,
                "totalGross": str(period.total_gross),
                "totalNet": str(period.total_net),
                "totalInssEmployee": str(period.total_inss_employee),
                "totalInssEmployer": str(period.total_inss_employer),
                "totalIrt": str(period.total_irt),
                "employeeCount": len(payslips),
            },
        }
        await self.event_publisher.publish("payroll.period.closed", event_payload)

        return period
