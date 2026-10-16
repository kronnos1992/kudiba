from datetime import date
from typing import List, Optional
from uuid import UUID
from src.domain.entities.hr import AbsenceRecord, AttendanceRecord, VacationRequest
from src.domain.ports.hr_repository import HrRepository


class ListVacationsUseCase:
    def __init__(self, hr_repo: HrRepository):
        self.hr_repo = hr_repo

    async def execute(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> List[VacationRequest]:
        return await self.hr_repo.list_vacations(tenant_id, employee_id=employee_id, status=status)


class ListAbsencesUseCase:
    def __init__(self, hr_repo: HrRepository):
        self.hr_repo = hr_repo

    async def execute(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AbsenceRecord]:
        return await self.hr_repo.list_absences(
            tenant_id, employee_id=employee_id, date_from=date_from, date_to=date_to
        )


class ListAttendanceUseCase:
    def __init__(self, hr_repo: HrRepository):
        self.hr_repo = hr_repo

    async def execute(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AttendanceRecord]:
        return await self.hr_repo.list_attendance(
            tenant_id, employee_id=employee_id, date_from=date_from, date_to=date_to
        )
