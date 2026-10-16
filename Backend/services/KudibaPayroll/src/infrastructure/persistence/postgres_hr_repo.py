from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.hr import (
    AbsenceRecord,
    AttendanceRecord,
    VacationBalance,
    VacationRequest,
)
from src.domain.ports.hr_repository import HrRepository
from src.domain.value_objects.enums import AttendanceDirection, VacationStatus
from src.infrastructure.persistence.models import (
    AbsenceRecordModel,
    AttendanceRecordModel,
    EmployeeModel,
    VacationRequestModel,
)

ANNUAL_ENTITLEMENT_DAYS = Decimal("30")
MONTHS_PER_YEAR = Decimal("12")


class PostgresHrRepository(HrRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    @staticmethod
    def _to_vacation(model: VacationRequestModel) -> VacationRequest:
        return VacationRequest(
            id=model.id,
            tenant_id=model.tenant_id,
            employee_id=model.employee_id,
            start_date=model.start_date,
            end_date=model.end_date,
            days=model.days,
            status=VacationStatus(model.status),
            notes=model.notes,
            decided_by=model.decided_by,
            decided_at=model.decided_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_absence(model: AbsenceRecordModel) -> AbsenceRecord:
        return AbsenceRecord(
            id=model.id,
            tenant_id=model.tenant_id,
            employee_id=model.employee_id,
            absence_date=model.absence_date,
            absence_type=model.absence_type,
            is_paid=model.is_paid,
            notes=model.notes,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_attendance(model: AttendanceRecordModel) -> AttendanceRecord:
        return AttendanceRecord(
            id=model.id,
            tenant_id=model.tenant_id,
            employee_id=model.employee_id,
            employee_code=model.employee_code,
            punched_at=model.punched_at,
            direction=AttendanceDirection(model.direction),
            device_id=model.device_id,
            source=model.source,
            external_id=model.external_id,
            notes=model.notes,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_vacation_by_id(self, tenant_id: UUID, vacation_id: UUID) -> Optional[VacationRequest]:
        async with self.session_factory() as session:
            stmt = select(VacationRequestModel).where(
                VacationRequestModel.tenant_id == tenant_id,
                VacationRequestModel.id == vacation_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_vacation(model) if model else None

    async def list_vacations(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> List[VacationRequest]:
        async with self.session_factory() as session:
            stmt = select(VacationRequestModel).where(VacationRequestModel.tenant_id == tenant_id)
            if employee_id:
                stmt = stmt.where(VacationRequestModel.employee_id == employee_id)
            if status:
                stmt = stmt.where(VacationRequestModel.status == status)
            stmt = stmt.order_by(VacationRequestModel.start_date.desc())
            res = await session.execute(stmt)
            return [self._to_vacation(m) for m in res.scalars().all()]

    async def save_vacation(self, vacation: VacationRequest) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(VacationRequestModel).where(VacationRequestModel.id == vacation.id)
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()
                if model:
                    model.status = vacation.status.value
                    model.notes = vacation.notes
                    model.decided_by = vacation.decided_by
                    model.decided_at = vacation.decided_at
                else:
                    session.add(VacationRequestModel(
                        id=vacation.id,
                        tenant_id=vacation.tenant_id,
                        employee_id=vacation.employee_id,
                        start_date=vacation.start_date,
                        end_date=vacation.end_date,
                        days=vacation.days,
                        status=vacation.status.value,
                        notes=vacation.notes,
                        decided_by=vacation.decided_by,
                        decided_at=vacation.decided_at,
                    ))

    async def get_vacation_balance(self, tenant_id: UUID, employee_id: UUID, year: int) -> VacationBalance:
        async with self.session_factory() as session:
            emp_stmt = select(EmployeeModel).where(
                EmployeeModel.tenant_id == tenant_id,
                EmployeeModel.id == employee_id,
            )
            emp_res = await session.execute(emp_stmt)
            employee = emp_res.scalar_one_or_none()

            year_start = date(year, 1, 1)
            year_end = date(year, 12, 31)

            entitled = Decimal("0.00")
            if employee and employee.hire_date <= year_end:
                effective_start = max(employee.hire_date, year_start)
                months_worked = Decimal(
                    str((year_end.year - effective_start.year) * 12 + (year_end.month - effective_start.month) + 1)
                )
                months_worked = max(Decimal("0.00"), min(months_worked, MONTHS_PER_YEAR))
                entitled = (ANNUAL_ENTITLEMENT_DAYS * months_worked / MONTHS_PER_YEAR).quantize(Decimal("0.01"))

            totals_stmt = select(
                VacationRequestModel.status,
                func.coalesce(func.sum(VacationRequestModel.days), 0),
            ).where(
                VacationRequestModel.tenant_id == tenant_id,
                VacationRequestModel.employee_id == employee_id,
                func.extract("year", VacationRequestModel.start_date) == year,
            ).group_by(VacationRequestModel.status)

            used = Decimal("0.00")
            pending = Decimal("0.00")
            res = await session.execute(totals_stmt)
            for status_value, days_total in res.all():
                if status_value == VacationStatus.APPROVED.value:
                    used = Decimal(str(days_total))
                elif status_value == VacationStatus.PENDING.value:
                    pending = Decimal(str(days_total))

            return VacationBalance(
                employee_id=employee_id,
                year=year,
                entitled_days=entitled,
                used_days=used,
                pending_days=pending,
            )

    async def list_absences(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AbsenceRecord]:
        async with self.session_factory() as session:
            stmt = select(AbsenceRecordModel).where(AbsenceRecordModel.tenant_id == tenant_id)
            if employee_id:
                stmt = stmt.where(AbsenceRecordModel.employee_id == employee_id)
            if date_from:
                stmt = stmt.where(AbsenceRecordModel.absence_date >= date_from)
            if date_to:
                stmt = stmt.where(AbsenceRecordModel.absence_date <= date_to)
            stmt = stmt.order_by(AbsenceRecordModel.absence_date.desc())
            res = await session.execute(stmt)
            return [self._to_absence(m) for m in res.scalars().all()]

    async def save_absence(self, absence: AbsenceRecord) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                session.add(AbsenceRecordModel(
                    id=absence.id,
                    tenant_id=absence.tenant_id,
                    employee_id=absence.employee_id,
                    absence_date=absence.absence_date,
                    absence_type=absence.absence_type,
                    is_paid=absence.is_paid,
                    notes=absence.notes,
                ))

    async def count_unpaid_absence_days(
        self,
        tenant_id: UUID,
        employee_id: UUID,
        date_from: date,
        date_to: date,
    ) -> int:
        async with self.session_factory() as session:
            stmt = select(func.count(AbsenceRecordModel.id)).where(
                AbsenceRecordModel.tenant_id == tenant_id,
                AbsenceRecordModel.employee_id == employee_id,
                AbsenceRecordModel.is_paid.is_(False),
                AbsenceRecordModel.absence_date >= date_from,
                AbsenceRecordModel.absence_date <= date_to,
            )
            res = await session.execute(stmt)
            return int(res.scalar_one())

    async def get_attendance_by_external_id(
        self, tenant_id: UUID, external_id: str
    ) -> Optional[AttendanceRecord]:
        async with self.session_factory() as session:
            stmt = select(AttendanceRecordModel).where(
                AttendanceRecordModel.tenant_id == tenant_id,
                AttendanceRecordModel.external_id == external_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_attendance(model) if model else None

    async def list_attendance(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AttendanceRecord]:
        async with self.session_factory() as session:
            stmt = select(AttendanceRecordModel).where(AttendanceRecordModel.tenant_id == tenant_id)
            if employee_id:
                stmt = stmt.where(AttendanceRecordModel.employee_id == employee_id)
            if date_from:
                stmt = stmt.where(func.date(AttendanceRecordModel.punched_at) >= date_from)
            if date_to:
                stmt = stmt.where(func.date(AttendanceRecordModel.punched_at) <= date_to)
            stmt = stmt.order_by(AttendanceRecordModel.punched_at.desc())
            res = await session.execute(stmt)
            return [self._to_attendance(m) for m in res.scalars().all()]

    async def save_attendance(self, record: AttendanceRecord) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                session.add(AttendanceRecordModel(
                    id=record.id,
                    tenant_id=record.tenant_id,
                    employee_id=record.employee_id,
                    employee_code=record.employee_code,
                    punched_at=record.punched_at,
                    direction=record.direction.value,
                    device_id=record.device_id,
                    source=record.source,
                    external_id=record.external_id,
                    notes=record.notes,
                ))
