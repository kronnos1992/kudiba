from typing import Tuple
from uuid import UUID
from src.domain.error import EntityNotFoundError
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.payroll_repository import PayrollRepository
from src.infrastructure.reports.payslip_pdf import PayslipPdfExporter


class GeneratePayslipPdfUseCase:
    def __init__(self, payroll_repo: PayrollRepository, employee_repo: EmployeeRepository):
        self.payroll_repo = payroll_repo
        self.employee_repo = employee_repo

    async def execute(
        self,
        tenant_id: UUID,
        payslip_id: UUID,
        company_name: str,
        company_nif: str,
    ) -> Tuple[bytes, str]:
        payslip = await self.payroll_repo.get_payslip_by_id(tenant_id, payslip_id)
        if not payslip:
            raise EntityNotFoundError("Recibo de Vencimento", str(payslip_id))

        employee = await self.employee_repo.get_by_id(tenant_id, payslip.employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(payslip.employee_id))

        period = await self.payroll_repo.get_period_by_id(tenant_id, payslip.period_id)
        if not period:
            raise EntityNotFoundError("Período de Processamento", str(payslip.period_id))

        content = PayslipPdfExporter.generate(
            payslip=payslip,
            employee=employee,
            period=period,
            company_name=company_name,
            company_nif=company_nif,
        )
        filename = PayslipPdfExporter.filename(employee.code, period)
        return content, filename
