from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4
from src.domain.value_objects.enums import AttendanceDirection, VacationStatus


@dataclass
class VacationRequest:
    id: UUID
    tenant_id: UUID
    employee_id: UUID
    start_date: date
    end_date: date
    days: int
    status: VacationStatus
    notes: Optional[str] = None
    decided_by: Optional[UUID] = None
    decided_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        employee_id: UUID,
        start_date: date,
        end_date: date,
        days: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> "VacationRequest":
        computed_days = days if days is not None else (end_date - start_date).days + 1
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
            days=computed_days,
            status=VacationStatus.PENDING,
            notes=notes,
        )

    def approve(self, decided_by: UUID) -> None:
        self.status = VacationStatus.APPROVED
        self.decided_by = decided_by
        self.decided_at = datetime.now(timezone.utc)

    def reject(self, decided_by: UUID) -> None:
        self.status = VacationStatus.REJECTED
        self.decided_by = decided_by
        self.decided_at = datetime.now(timezone.utc)


@dataclass
class VacationBalance:
    employee_id: UUID
    year: int
    entitled_days: Decimal
    used_days: Decimal
    pending_days: Decimal

    @property
    def available_days(self) -> Decimal:
        return self.entitled_days - self.used_days - self.pending_days


@dataclass
class AbsenceRecord:
    id: UUID
    tenant_id: UUID
    employee_id: UUID
    absence_date: date
    absence_type: str
    is_paid: bool
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        employee_id: UUID,
        absence_date: date,
        absence_type: str,
        is_paid: bool,
        notes: Optional[str] = None,
    ) -> "AbsenceRecord":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            employee_id=employee_id,
            absence_date=absence_date,
            absence_type=absence_type,
            is_paid=is_paid,
            notes=notes,
        )


@dataclass
class AttendanceRecord:
    id: UUID
    tenant_id: UUID
    employee_id: UUID
    punched_at: datetime
    direction: AttendanceDirection
    employee_code: Optional[str] = None
    device_id: Optional[str] = None
    source: Optional[str] = None
    external_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        employee_id: UUID,
        punched_at: datetime,
        direction: AttendanceDirection,
        employee_code: Optional[str] = None,
        device_id: Optional[str] = None,
        source: Optional[str] = None,
        external_id: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> "AttendanceRecord":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            employee_id=employee_id,
            punched_at=punched_at,
            direction=direction,
            employee_code=employee_code,
            device_id=device_id,
            source=source,
            external_id=external_id,
            notes=notes,
        )
