from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from src.domain.value_objects.enums import (
    AuthType,
    ConflictPolicy,
    ConnectorType,
    DataFormat,
    RunStatus,
    RunTrigger,
)


@dataclass
class IntegrationEndpoint:
    id: UUID
    tenant_id: UUID
    name: str
    system_type: str
    connector_type: ConnectorType
    is_enabled: bool = True
    description: Optional[str] = None

    auth_type: AuthType = AuthType.NONE
    encrypted_credentials: Optional[str] = None

    webhook_key: Optional[str] = None
    webhook_header_name: Optional[str] = None
    webhook_secret: Optional[str] = None

    source_url: Optional[str] = None
    http_method: str = "GET"
    request_headers: Dict[str, Any] = field(default_factory=dict)
    query_params: Dict[str, Any] = field(default_factory=dict)
    schedule_interval_seconds: Optional[int] = None

    data_format: DataFormat = DataFormat.JSON
    file_delimiter: Optional[str] = None
    file_has_header: bool = True
    file_encoding: str = "utf-8"
    column_widths: List[Dict[str, Any]] = field(default_factory=list)

    last_run_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        name: str,
        system_type: str,
        connector_type: ConnectorType,
        **kwargs: Any,
    ) -> "IntegrationEndpoint":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            name=name,
            system_type=system_type,
            connector_type=connector_type,
            **kwargs,
        )

    @property
    def is_due(self) -> bool:
        return self.is_due_at(datetime.now(timezone.utc))

    def is_due_at(self, now: datetime) -> bool:
        if not self.is_enabled or self.connector_type != ConnectorType.REST_PULL:
            return False
        if not self.schedule_interval_seconds or self.schedule_interval_seconds <= 0:
            return False
        if self.last_run_at is None:
            return True
        elapsed = (now - self.last_run_at).total_seconds()
        return elapsed >= self.schedule_interval_seconds

    def mark_run(self, when: Optional[datetime] = None) -> None:
        self.last_run_at = when or datetime.now(timezone.utc)


@dataclass
class IntegrationMapping:
    id: UUID
    tenant_id: UUID
    endpoint_id: UUID
    name: str
    entity_type: str
    target_event_type: str
    target_routing_key: str
    is_enabled: bool = True
    record_path: Optional[str] = None
    field_mappings: List[Dict[str, Any]] = field(default_factory=list)
    static_payload: Dict[str, Any] = field(default_factory=dict)
    dedup_fields: List[str] = field(default_factory=list)
    conflict_policy: ConflictPolicy = ConflictPolicy.SKIP
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        tenant_id: UUID,
        endpoint_id: UUID,
        name: str,
        entity_type: str,
        target_event_type: str,
        target_routing_key: str,
        **kwargs: Any,
    ) -> "IntegrationMapping":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            endpoint_id=endpoint_id,
            name=name,
            entity_type=entity_type,
            target_event_type=target_event_type,
            target_routing_key=target_routing_key,
            **kwargs,
        )


@dataclass
class IntegrationRun:
    id: UUID
    tenant_id: UUID
    endpoint_id: UUID
    trigger: RunTrigger
    status: RunStatus
    mapping_id: Optional[UUID] = None
    records_received: int = 0
    records_succeeded: int = 0
    records_failed: int = 0
    records_skipped: int = 0
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @classmethod
    def start(cls, tenant_id: UUID, endpoint_id: UUID, trigger: RunTrigger) -> "IntegrationRun":
        return cls(
            id=uuid4(),
            tenant_id=tenant_id,
            endpoint_id=endpoint_id,
            trigger=trigger,
            status=RunStatus.FAILED,
            started_at=datetime.now(timezone.utc),
        )

    def complete(self, status: RunStatus, message: Optional[str] = None) -> None:
        self.status = status
        self.message = message
        self.finished_at = datetime.now(timezone.utc)
