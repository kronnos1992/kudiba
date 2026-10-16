import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import declarative_base, Mapped, mapped_column

Base = declarative_base()

SCHEMA = "kudiba_integrations"


class IntegrationEndpointModel(Base):
    __tablename__ = "integration_endpoints"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_endpoint_tenant_name"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    system_type: Mapped[str] = mapped_column(String(50), nullable=False)
    connector_type: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    auth_type: Mapped[str] = mapped_column(String(20), default="NONE", nullable=False)
    encrypted_credentials: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    webhook_key: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    webhook_header_name: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    webhook_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    source_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    http_method: Mapped[str] = mapped_column(String(10), default="GET", nullable=False)
    request_headers: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    query_params: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    schedule_interval_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    data_format: Mapped[str] = mapped_column(String(20), default="JSON", nullable=False)
    file_delimiter: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    file_has_header: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    file_encoding: Mapped[str] = mapped_column(String(20), default="utf-8", nullable=False)
    column_widths: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class IntegrationMappingModel(Base):
    __tablename__ = "integration_mappings"
    __table_args__ = (
        UniqueConstraint("tenant_id", "endpoint_id", "name", name="uq_mapping_tenant_endpoint_name"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    endpoint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.integration_endpoints.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    record_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    field_mappings: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    static_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    dedup_fields: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    conflict_policy: Mapped[str] = mapped_column(String(20), default="SKIP", nullable=False)
    target_event_type: Mapped[str] = mapped_column(String(120), nullable=False)
    target_routing_key: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class IntegrationRunModel(Base):
    __tablename__ = "integration_runs"
    __table_args__ = {"schema": SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    endpoint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.integration_endpoints.id", ondelete="CASCADE"),
        nullable=False,
    )
    mapping_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.integration_mappings.id", ondelete="SET NULL"),
        nullable=True,
    )
    trigger: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    records_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_succeeded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )


class IngestedRecordModel(Base):
    __tablename__ = "ingested_records"
    __table_args__ = (
        UniqueConstraint("tenant_id", "mapping_id", "dedup_hash", name="uq_ingested_dedup"),
        {"schema": SCHEMA},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    mapping_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.integration_mappings.id", ondelete="CASCADE"),
        nullable=False,
    )
    dedup_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
