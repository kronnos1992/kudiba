from datetime import date
from typing import List, Optional
from uuid import UUID

from src.domain.entities.employee import Employee
from src.domain.entities.hr import (
    AbsenceRecord,
    AttendanceRecord,
    VacationBalance,
    VacationRequest,
)
from src.domain.ports.employee_repository import EmployeeRepository
from src.domain.ports.hr_repository import HrRepository


class FakeEmployeeRepository(EmployeeRepository):
    def __init__(self, employees: Optional[List[Employee]] = None):
        self._by_id = {}
        self._by_code = {}
        for employee in employees or []:
            self._by_id[employee.id] = employee
            self._by_code[(employee.tenant_id, employee.code)] = employee

    async def get_by_id(self, tenant_id: UUID, employee_id: UUID) -> Optional[Employee]:
        employee = self._by_id.get(employee_id)
        if employee and employee.tenant_id == tenant_id:
            return employee
        return None

    async def get_by_code(self, tenant_id: UUID, code: str) -> Optional[Employee]:
        return self._by_code.get((tenant_id, code))

    async def get_by_nif(self, tenant_id: UUID, nif: str) -> Optional[Employee]:
        for employee in self._by_id.values():
            if employee.tenant_id == tenant_id and employee.nif == nif:
                return employee
        return None

    async def get_by_identity_card(
        self, tenant_id: UUID, identity_card_number: str
    ) -> Optional[Employee]:
        for employee in self._by_id.values():
            if employee.tenant_id == tenant_id and employee.identity_card_number == identity_card_number:
                return employee
        return None

    async def list_active(self, tenant_id: UUID) -> List[Employee]:
        return [e for e in self._by_id.values() if e.tenant_id == tenant_id]

    async def save(self, employee: Employee) -> None:
        self._by_id[employee.id] = employee
        self._by_code[(employee.tenant_id, employee.code)] = employee


class InMemoryHrRepository(HrRepository):
    def __init__(self):
        self.attendance: List[AttendanceRecord] = []
        self.absences: List[AbsenceRecord] = []
        self.vacations: List[VacationRequest] = []

    async def get_vacation_by_id(self, tenant_id: UUID, vacation_id: UUID) -> Optional[VacationRequest]:
        for vacation in self.vacations:
            if vacation.tenant_id == tenant_id and vacation.id == vacation_id:
                return vacation
        return None

    async def list_vacations(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> List[VacationRequest]:
        return [v for v in self.vacations if v.tenant_id == tenant_id]

    async def save_vacation(self, vacation: VacationRequest) -> None:
        self.vacations.append(vacation)

    async def get_vacation_balance(
        self, tenant_id: UUID, employee_id: UUID, year: int
    ) -> VacationBalance:
        return VacationBalance(
            employee_id=employee_id,
            year=year,
            entitled_days=0,
            used_days=0,
            pending_days=0,
        )

    async def list_absences(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AbsenceRecord]:
        return [a for a in self.absences if a.tenant_id == tenant_id]

    async def save_absence(self, absence: AbsenceRecord) -> None:
        self.absences.append(absence)

    async def count_unpaid_absence_days(
        self, tenant_id: UUID, employee_id: UUID, date_from: date, date_to: date
    ) -> int:
        return 0

    async def get_attendance_by_external_id(
        self, tenant_id: UUID, external_id: str
    ) -> Optional[AttendanceRecord]:
        for record in self.attendance:
            if record.tenant_id == tenant_id and record.external_id == external_id:
                return record
        return None

    async def list_attendance(
        self,
        tenant_id: UUID,
        employee_id: Optional[UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[AttendanceRecord]:
        return [r for r in self.attendance if r.tenant_id == tenant_id]

    async def save_attendance(self, record: AttendanceRecord) -> None:
        self.attendance.append(record)
