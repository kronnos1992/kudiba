from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from src.application.commands.hr_commands import RecordAttendanceUseCase
from src.application.dto import CreateAttendanceRequest
from src.application.events.attendance_handler import AttendanceEventHandler
from src.application.queries.hr_queries import ListAttendanceUseCase
from src.domain.entities.employee import Employee
from src.domain.error import ConflictError, EntityNotFoundError, ValidationError
from src.domain.value_objects.enums import AttendanceDirection
from tests.fakes import FakeEmployeeRepository, InMemoryHrRepository

TENANT = uuid4()


def make_employee(code: str = "EMP001") -> Employee:
    return Employee.create(
        tenant_id=TENANT,
        code=code,
        full_name="Ana Silva",
        nif="000111222",
        identity_card_number="BI-123",
        iban="AO06000600000000000000000",
        hire_date=date(2024, 1, 1),
    )


def build_use_case(employee_code: str = "EMP001"):
    hr_repo = InMemoryHrRepository()
    employee = make_employee(employee_code)
    employee_repo = FakeEmployeeRepository([employee])
    use_case = RecordAttendanceUseCase(hr_repo, employee_repo)
    return use_case, hr_repo, employee


@pytest.mark.asyncio
async def test_record_attendance_by_employee_code():
    use_case, hr_repo, employee = build_use_case()
    req = CreateAttendanceRequest(
        employee_code="EMP001",
        punched_at=datetime(2025, 3, 1, 7, 59, tzinfo=timezone.utc),
        direction=AttendanceDirection.IN,
        device_id="RELOGIO-01",
    )

    record = await use_case.execute(TENANT, req)

    assert record.employee_id == employee.id
    assert record.employee_code == "EMP001"
    assert record.direction == AttendanceDirection.IN
    assert len(hr_repo.attendance) == 1


@pytest.mark.asyncio
async def test_record_attendance_by_employee_id_fills_code():
    use_case, hr_repo, employee = build_use_case()
    req = CreateAttendanceRequest(
        employee_id=employee.id,
        punched_at=datetime(2025, 3, 1, 17, 1, tzinfo=timezone.utc),
        direction=AttendanceDirection.OUT,
    )

    record = await use_case.execute(TENANT, req)
    assert record.employee_code == employee.code


@pytest.mark.asyncio
async def test_record_attendance_requires_identifier():
    use_case, _, _ = build_use_case()
    with pytest.raises(ValidationError):
        await use_case.execute(
            TENANT,
            CreateAttendanceRequest(punched_at=datetime(2025, 3, 1, tzinfo=timezone.utc)),
        )


@pytest.mark.asyncio
async def test_record_attendance_unknown_employee():
    use_case, _, _ = build_use_case()
    with pytest.raises(EntityNotFoundError):
        await use_case.execute(
            TENANT,
            CreateAttendanceRequest(
                employee_code="NOPE",
                punched_at=datetime(2025, 3, 1, tzinfo=timezone.utc),
            ),
        )


@pytest.mark.asyncio
async def test_record_attendance_is_idempotent_by_external_id():
    use_case, _, _ = build_use_case()
    req = CreateAttendanceRequest(
        employee_code="EMP001",
        punched_at=datetime(2025, 3, 1, 7, 59, tzinfo=timezone.utc),
        direction=AttendanceDirection.IN,
        external_id="evt-123",
    )

    await use_case.execute(TENANT, req)
    with pytest.raises(ConflictError):
        await use_case.execute(TENANT, req)


@pytest.mark.asyncio
async def test_list_attendance_query():
    use_case, hr_repo, _ = build_use_case()
    await use_case.execute(
        TENANT,
        CreateAttendanceRequest(
            employee_code="EMP001",
            punched_at=datetime(2025, 3, 1, 7, 59, tzinfo=timezone.utc),
            direction=AttendanceDirection.IN,
        ),
    )

    records = await ListAttendanceUseCase(hr_repo).execute(TENANT)
    assert len(records) == 1


def make_envelope(payload: dict, event_type: str = "attendance.recorded") -> dict:
    return {
        "event_id": str(uuid4()),
        "tenant_id": str(TENANT),
        "event_type": event_type,
        "source": "Relógio de Ponto",
        "source_system_type": "ATTENDANCE",
        "occurred_at": "2025-03-01T07:59:00+00:00",
        "payload": payload,
    }


@pytest.mark.asyncio
async def test_handler_records_attendance_from_event():
    use_case, hr_repo, employee = build_use_case()
    handler = AttendanceEventHandler(use_case)
    envelope = make_envelope(
        {
            "employee_code": "EMP001",
            "punched_at": "2025-03-01T07:59:00+00:00",
            "direction": "IN",
            "device_id": "RELOGIO-01",
        }
    )

    await handler.handle("payroll.event.attendance.recorded", envelope)

    assert len(hr_repo.attendance) == 1
    assert hr_repo.attendance[0].employee_id == employee.id
    assert hr_repo.attendance[0].external_id == envelope["event_id"]


@pytest.mark.asyncio
async def test_handler_ignores_unrelated_event_type():
    use_case, hr_repo, _ = build_use_case()
    handler = AttendanceEventHandler(use_case)

    await handler.handle("payroll.event.period.closed", make_envelope({}, event_type="period.closed"))
    assert hr_repo.attendance == []


@pytest.mark.asyncio
async def test_handler_handles_unknown_employee_without_raising():
    use_case, hr_repo, _ = build_use_case()
    handler = AttendanceEventHandler(use_case)
    envelope = make_envelope(
        {
            "employee_code": "UNKNOWN",
            "punched_at": "2025-03-01T07:59:00+00:00",
            "direction": "IN",
        }
    )

    await handler.handle("payroll.event.attendance.recorded", envelope)
    assert hr_repo.attendance == []


@pytest.mark.asyncio
async def test_handler_handles_invalid_payload_without_raising():
    use_case, hr_repo, _ = build_use_case()
    handler = AttendanceEventHandler(use_case)
    envelope = make_envelope({"employee_code": "EMP001"})

    await handler.handle("payroll.event.attendance.recorded", envelope)
    assert hr_repo.attendance == []


@pytest.mark.asyncio
async def test_handler_deduplicates_repeated_event():
    use_case, hr_repo, _ = build_use_case()
    handler = AttendanceEventHandler(use_case)
    envelope = make_envelope(
        {
            "employee_code": "EMP001",
            "punched_at": "2025-03-01T07:59:00+00:00",
            "direction": "IN",
        }
    )

    await handler.handle("payroll.event.attendance.recorded", envelope)
    await handler.handle("payroll.event.attendance.recorded", envelope)
    assert len(hr_repo.attendance) == 1
