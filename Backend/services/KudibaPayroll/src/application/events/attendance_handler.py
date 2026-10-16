import logging
from typing import Any, Dict
from uuid import UUID

from pydantic import ValidationError as PydanticValidationError

from src.application.commands.hr_commands import RecordAttendanceUseCase
from src.application.dto import CreateAttendanceRequest
from src.domain.error import ConflictError, DomainError, EntityNotFoundError, ValidationError

logger = logging.getLogger(__name__)

ATTENDANCE_EVENT_TYPE = "attendance.recorded"


class AttendanceEventHandler:
    def __init__(self, record_attendance: RecordAttendanceUseCase):
        self.record_attendance = record_attendance

    async def handle(self, routing_key: str, envelope: Dict[str, Any]) -> None:
        event_type = envelope.get("event_type")
        if event_type != ATTENDANCE_EVENT_TYPE:
            logger.debug("Ignoring event of type '%s' on key '%s'.", event_type, routing_key)
            return

        raw_tenant_id = envelope.get("tenant_id")
        payload = envelope.get("payload") or {}
        if not isinstance(payload, dict):
            logger.error("Attendance event payload is not an object; discarding.")
            return

        try:
            tenant_id = UUID(str(raw_tenant_id))
        except (TypeError, ValueError):
            logger.error("Attendance event carries an invalid tenant_id '%s'; discarding.", raw_tenant_id)
            return

        payload.setdefault("source", envelope.get("source"))
        payload.setdefault("external_id", envelope.get("event_id"))

        try:
            request = CreateAttendanceRequest(**payload)
        except PydanticValidationError as exc:
            logger.error("Invalid attendance event payload: %s", exc)
            return

        try:
            record = await self.record_attendance.execute(tenant_id, request)
            logger.info(
                "Attendance recorded for employee %s at %s (%s).",
                record.employee_id,
                record.punched_at.isoformat(),
                record.direction.value,
            )
        except ConflictError as exc:
            logger.info("Skipping duplicate attendance event: %s", exc.message)
        except EntityNotFoundError as exc:
            logger.warning("Attendance event references an unknown employee: %s", exc.message)
        except (ValidationError, DomainError) as exc:
            logger.error("Attendance event rejected: %s", exc.message)
