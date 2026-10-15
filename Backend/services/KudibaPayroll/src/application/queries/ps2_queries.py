from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID
from src.application.dto import Ps2ExportResponse
from src.domain.error import EntityNotFoundError
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.payroll_repository import PayrollRepository
from src.infrastructure.exporters.ps2_exporter import Ps2Exporter


class ExportPs2UseCase:
    def __init__(self, payroll_repo: PayrollRepository, employee_repo: EmployeeRepository):
        self.payroll_repo = payroll_repo
        self.employee_repo = employee_repo

    async def execute(
        self,
        tenant_id: UUID,
        period_id: UUID,
        company_name: str,
        company_nif: str,
        company_iban: str,
        execution_date: Optional[date] = None,
    ) -> Ps2ExportResponse:
        period = await self.payroll_repo.get_period_by_id(tenant_id, period_id)
        if not period:
            raise EntityNotFoundError("Período de Processamento", str(period_id))

        payslips = await self.payroll_repo.list_payslips_by_period(tenant_id, period_id)
        if not payslips:
            raise EntityNotFoundError("Recibos do Período", str(period_id))

        exec_date = execution_date or period.end_date

        payslips_data: List[Dict[str, Any]] = []
        total_amount = Decimal("0.00")

        for p in payslips:
            employee = await self.employee_repo.get_by_id(tenant_id, p.employee_id)
            iban = employee.iban if employee else ""
            full_name = employee.full_name if employee else "Colaborador"

            total_amount += p.net_salary
            payslips_data.append({
                "iban": iban,
                "full_name": full_name,
                "net_salary": p.net_salary,
                "reference": f"SALARIO-{period.year}{period.month:02d}",
            })

        content = Ps2Exporter.generate(
            ordenante_empresa=company_name,
            ordenante_nif=company_nif,
            ordenante_iban=company_iban,
            data_execucao=exec_date,
            payslips_data=payslips_data,
        )

        filename = f"PS2_VENCIMENTOS_{period.year}_{period.month:02d}.txt"

        return Ps2ExportResponse(
            filename=filename,
            content=content,
            total_records=len(payslips_data),
            total_amount=total_amount,
        )
