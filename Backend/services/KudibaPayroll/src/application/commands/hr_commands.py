from uuid import UUID
from src.application.dto import (
    CreateAbsenceRequest,
    CreateAttendanceRequest,
    CreateVacationRequest,
    VacationDecisionRequest,
)
from src.domain.entities.hr import AbsenceRecord, AttendanceRecord, VacationRequest
from src.domain.entities.payslip import Payslip
from src.domain.error import ConflictError, EntityNotFoundError, ValidationError
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.hr_repository import HrRepository
from src.domain.ports.payroll_repository import PayrollRepository
from src.domain.value_objects.enums import PayslipStatus, VacationStatus

MAX_CONSECUTIVE_VACATION_DAYS = 30


class RequestVacationUseCase:
    def __init__(self, hr_repo: HrRepository, employee_repo: EmployeeRepository):
        self.hr_repo = hr_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, req: CreateVacationRequest) -> VacationRequest:
        employee = await self.employee_repo.get_by_id(tenant_id, req.employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(req.employee_id))

        if req.end_date < req.start_date:
            raise ValidationError("A data de fim das férias deve ser igual ou posterior à data de início.")

        vacation = VacationRequest.create(
            tenant_id=tenant_id,
            employee_id=req.employee_id,
            start_date=req.start_date,
            end_date=req.end_date,
            days=req.days,
            notes=req.notes,
        )

        if vacation.days > MAX_CONSECUTIVE_VACATION_DAYS:
            raise ValidationError(
                f"Um período de férias consecutivas não pode exceder {MAX_CONSECUTIVE_VACATION_DAYS} dias."
            )

        balance = await self.hr_repo.get_vacation_balance(tenant_id, req.employee_id, req.start_date.year)
        if vacation.days > balance.available_days:
            raise ValidationError(
                f"Saldo de férias insuficiente: disponível {balance.available_days} dia(s), "
                f"solicitado {vacation.days} dia(s)."
            )

        await self.hr_repo.save_vacation(vacation)
        return vacation


class DecideVacationUseCase:
    def __init__(self, hr_repo: HrRepository):
        self.hr_repo = hr_repo

    async def execute(
        self,
        tenant_id: UUID,
        vacation_id: UUID,
        req: VacationDecisionRequest,
        approve: bool,
    ) -> VacationRequest:
        vacation = await self.hr_repo.get_vacation_by_id(tenant_id, vacation_id)
        if not vacation:
            raise EntityNotFoundError("Pedido de Férias", str(vacation_id))

        if vacation.status != VacationStatus.PENDING:
            raise ConflictError(f"O pedido de férias já foi decidido (estado atual: {vacation.status.value}).")

        if approve:
            vacation.approve(req.decided_by)
        else:
            vacation.reject(req.decided_by)

        await self.hr_repo.save_vacation(vacation)
        return vacation


class RecordAbsenceUseCase:
    def __init__(self, hr_repo: HrRepository, employee_repo: EmployeeRepository):
        self.hr_repo = hr_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, req: CreateAbsenceRequest) -> AbsenceRecord:
        employee = await self.employee_repo.get_by_id(tenant_id, req.employee_id)
        if not employee:
            raise EntityNotFoundError("Colaborador", str(req.employee_id))

        existing = await self.hr_repo.list_absences(
            tenant_id,
            employee_id=req.employee_id,
            date_from=req.absence_date,
            date_to=req.absence_date,
        )
        if any(a.absence_date == req.absence_date for a in existing):
            raise ConflictError(
                f"Já existe um registo de assiduidade para o colaborador em {req.absence_date.isoformat()}."
            )

        absence = AbsenceRecord.create(
            tenant_id=tenant_id,
            employee_id=req.employee_id,
            absence_date=req.absence_date,
            absence_type=req.absence_type.value,
            is_paid=req.is_paid,
            notes=req.notes,
        )
        await self.hr_repo.save_absence(absence)
        return absence


class RecordAttendanceUseCase:
    def __init__(self, hr_repo: HrRepository, employee_repo: EmployeeRepository):
        self.hr_repo = hr_repo
        self.employee_repo = employee_repo

    async def execute(self, tenant_id: UUID, req: CreateAttendanceRequest) -> AttendanceRecord:
        if not req.employee_id and not req.employee_code:
            raise ValidationError("É necessário indicar 'employee_id' ou 'employee_code'.")

        employee = None
        if req.employee_id:
            employee = await self.employee_repo.get_by_id(tenant_id, req.employee_id)
        elif req.employee_code:
            employee = await self.employee_repo.get_by_code(tenant_id, req.employee_code)

        if not employee:
            reference = str(req.employee_id) if req.employee_id else str(req.employee_code)
            raise EntityNotFoundError("Colaborador", reference)

        if req.external_id:
            existing = await self.hr_repo.get_attendance_by_external_id(tenant_id, req.external_id)
            if existing:
                raise ConflictError(
                    f"Picagem com identificador externo '{req.external_id}' já se encontra registada."
                )

        record = AttendanceRecord.create(
            tenant_id=tenant_id,
            employee_id=employee.id,
            punched_at=req.punched_at,
            direction=req.direction,
            employee_code=req.employee_code or employee.code,
            device_id=req.device_id,
            source=req.source,
            external_id=req.external_id,
            notes=req.notes,
        )
        await self.hr_repo.save_attendance(record)
        return record


class MarkPayslipPaidUseCase:
    def __init__(self, payroll_repo: PayrollRepository):
        self.payroll_repo = payroll_repo

    async def execute(self, tenant_id: UUID, payslip_id: UUID) -> Payslip:
        payslip = await self.payroll_repo.get_payslip_by_id(tenant_id, payslip_id)
        if not payslip:
            raise EntityNotFoundError("Recibo de Vencimento", str(payslip_id))

        if payslip.status == PayslipStatus.PAID:
            raise ValidationError("O recibo de vencimento já se encontra liquidado/pago.")

        payslip.mark_paid()
        await self.payroll_repo.save_payslips(payslip.period_id, [payslip])
        return payslip
