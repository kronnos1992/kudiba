from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.domain.value_objects.enums import (
    AuthType,
    ConflictPolicy,
    ConnectorType,
    DataFormat,
)


class CreateEndpointRequest(BaseModel):
    name: str = Field(..., max_length=150)
    system_type: str = Field(..., max_length=50)
    connector_type: ConnectorType
    description: Optional[str] = None
    is_enabled: bool = True

    auth_type: AuthType = AuthType.NONE
    credentials: Optional[Dict[str, Any]] = None

    webhook_header_name: Optional[str] = Field(None, max_length=80)
    webhook_secret: Optional[str] = Field(None, max_length=255)

    source_url: Optional[str] = Field(None, max_length=500)
    http_method: str = Field("GET", max_length=10)
    request_headers: Dict[str, Any] = Field(default_factory=dict)
    query_params: Dict[str, Any] = Field(default_factory=dict)
    schedule_interval_seconds: Optional[int] = Field(None, ge=1)

    data_format: DataFormat = DataFormat.JSON
    file_delimiter: Optional[str] = Field(None, max_length=5)
    file_has_header: bool = True
    file_encoding: str = Field("utf-8", max_length=20)
    column_widths: List[Dict[str, Any]] = Field(default_factory=list)


class UpdateEndpointRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    system_type: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_enabled: Optional[bool] = None

    auth_type: Optional[AuthType] = None
    credentials: Optional[Dict[str, Any]] = None

    webhook_header_name: Optional[str] = Field(None, max_length=80)
    webhook_secret: Optional[str] = Field(None, max_length=255)

    source_url: Optional[str] = Field(None, max_length=500)
    http_method: Optional[str] = Field(None, max_length=10)
    request_headers: Optional[Dict[str, Any]] = None
    query_params: Optional[Dict[str, Any]] = None
    schedule_interval_seconds: Optional[int] = Field(None, ge=1)

    data_format: Optional[DataFormat] = None
    file_delimiter: Optional[str] = Field(None, max_length=5)
    file_has_header: Optional[bool] = None
    file_encoding: Optional[str] = Field(None, max_length=20)
    column_widths: Optional[List[Dict[str, Any]]] = None


class EndpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    name: str
    system_type: str
    connector_type: ConnectorType
    description: Optional[str] = None
    is_enabled: bool
    auth_type: AuthType
    has_credentials: bool = False
    webhook_key: Optional[str] = None
    webhook_header_name: Optional[str] = None
    source_url: Optional[str] = None
    http_method: str
    request_headers: Dict[str, Any] = Field(default_factory=dict)
    query_params: Dict[str, Any] = Field(default_factory=dict)
    schedule_interval_seconds: Optional[int] = None
    data_format: DataFormat
    file_delimiter: Optional[str] = None
    file_has_header: bool
    file_encoding: str
    column_widths: List[Dict[str, Any]] = Field(default_factory=list)
    last_run_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CreateMappingRequest(BaseModel):
    name: str = Field(..., max_length=150)
    entity_type: str = Field(..., max_length=60)
    target_event_type: str = Field(..., max_length=120)
    target_routing_key: str = Field(..., max_length=160)
    is_enabled: bool = True
    record_path: Optional[str] = Field(None, max_length=255)
    field_mappings: List[Dict[str, Any]] = Field(default_factory=list)
    static_payload: Dict[str, Any] = Field(default_factory=dict)
    dedup_fields: List[str] = Field(default_factory=list)
    conflict_policy: ConflictPolicy = ConflictPolicy.SKIP


class UpdateMappingRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    entity_type: Optional[str] = Field(None, max_length=60)
    target_event_type: Optional[str] = Field(None, max_length=120)
    target_routing_key: Optional[str] = Field(None, max_length=160)
    is_enabled: Optional[bool] = None
    record_path: Optional[str] = Field(None, max_length=255)
    field_mappings: Optional[List[Dict[str, Any]]] = None
    static_payload: Optional[Dict[str, Any]] = None
    dedup_fields: Optional[List[str]] = None
    conflict_policy: Optional[ConflictPolicy] = None


class MappingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    endpoint_id: UUID
    name: str
    entity_type: str
    is_enabled: bool
    record_path: Optional[str] = None
    field_mappings: List[Dict[str, Any]] = Field(default_factory=list)
    static_payload: Dict[str, Any] = Field(default_factory=dict)
    dedup_fields: List[str] = Field(default_factory=list)
    conflict_policy: ConflictPolicy
    target_event_type: str
    target_routing_key: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    endpoint_id: UUID
    mapping_id: Optional[UUID] = None
    trigger: str
    status: str
    records_received: int
    records_succeeded: int
    records_failed: int
    records_skipped: int
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class WebhookAcceptedResponse(BaseModel):
    accepted: bool
    run_id: UUID
    status: str
    records_received: int
    records_succeeded: int
    records_failed: int
    records_skipped: int
