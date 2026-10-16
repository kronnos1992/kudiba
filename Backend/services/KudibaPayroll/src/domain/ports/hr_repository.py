from abc import ABC, abstractmethod
from datetime import date
from typing import List, Optional
from uuid import UUID
from src.domain.entities.hr import (
    AbsenceRecord,
    AttendanceRecord,
    VacationBalance,
    VacationRequest,
)


class HrRepository(ABC):
    @abstractmethod
    async def get_vacation_by_id(self, tenant_id: UUID, vacation_id: UUID) -> Optional[VacationRequest]:
        pass

    @abstractmethod
    async def list_vacations(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> List[VacationRequest]:
        pass

    @abstractmethod
    async def save_vacation(self, vacation: VacationRequest) -> None:
        pass

    @abstractmethod
    async def get_vacation_balance(self, tenant_id: UUID, employee_id: UUID, year: int) -> VacationBalance:
        pass

    @abstractmethod
    async def list_absences(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AbsenceRecord]:
        pass

    @abstractmethod
    async def save_absence(self, absence: AbsenceRecord) -> None:
        pass

    @abstractmethod
    async def count_unpaid_absence_days(
        self,
        tenant_id: UUID,
        employee_id: UUID,
        date_from: date,
        date_to: date,
    ) -> int:
        pass

    @abstractmethod
    async def get_attendance_by_external_id(
        self, tenant_id: UUID, external_id: str
    ) -> Optional[AttendanceRecord]:
        pass

    @abstractmethod
    async def list_attendance(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AttendanceRecord]:
        pass

    @abstractmethod
    async def save_attendance(self, record: AttendanceRecord) -> None:
        pass
