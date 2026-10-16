from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities.integration import (
    IntegrationEndpoint,
    IntegrationMapping,
    IntegrationRun,
)
from src.domain.error import ConflictError
from src.domain.ports.integration_repository import IntegrationRepository
from src.domain.value_objects.enums import (
    AuthType,
    ConflictPolicy,
    ConnectorType,
    DataFormat,
    RunStatus,
    RunTrigger,
)
from src.infrastructure.persistence.models import (
    IngestedRecordModel,
    IntegrationEndpointModel,
    IntegrationMappingModel,
    IntegrationRunModel,
)


class PostgresIntegrationRepository(IntegrationRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    @staticmethod
    def _to_endpoint(model: IntegrationEndpointModel) -> IntegrationEndpoint:
        return IntegrationEndpoint(
            id=model.id,
            tenant_id=model.tenant_id,
            name=model.name,
            system_type=model.system_type,
            connector_type=ConnectorType(model.connector_type),
            is_enabled=model.is_enabled,
            description=model.description,
            auth_type=AuthType(model.auth_type),
            encrypted_credentials=model.encrypted_credentials,
            webhook_key=model.webhook_key,
            webhook_header_name=model.webhook_header_name,
            webhook_secret=model.webhook_secret,
            source_url=model.source_url,
            http_method=model.http_method,
            request_headers=model.request_headers or {},
            query_params=model.query_params or {},
            schedule_interval_seconds=model.schedule_interval_seconds,
            data_format=DataFormat(model.data_format),
            file_delimiter=model.file_delimiter,
            file_has_header=model.file_has_header,
            file_encoding=model.file_encoding,
            column_widths=model.column_widths or [],
            last_run_at=model.last_run_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_mapping(model: IntegrationMappingModel) -> IntegrationMapping:
        return IntegrationMapping(
            id=model.id,
            tenant_id=model.tenant_id,
            endpoint_id=model.endpoint_id,
            name=model.name,
            entity_type=model.entity_type,
            target_event_type=model.target_event_type,
            target_routing_key=model.target_routing_key,
            is_enabled=model.is_enabled,
            record_path=model.record_path,
            field_mappings=model.field_mappings or [],
            static_payload=model.static_payload or {},
            dedup_fields=model.dedup_fields or [],
            conflict_policy=ConflictPolicy(model.conflict_policy),
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    @staticmethod
    def _to_run(model: IntegrationRunModel) -> IntegrationRun:
        return IntegrationRun(
            id=model.id,
            tenant_id=model.tenant_id,
            endpoint_id=model.endpoint_id,
            trigger=RunTrigger(model.trigger),
            status=RunStatus(model.status),
            mapping_id=model.mapping_id,
            records_received=model.records_received,
            records_succeeded=model.records_succeeded,
            records_failed=model.records_failed,
            records_skipped=model.records_skipped,
            message=model.message,
            started_at=model.started_at,
            finished_at=model.finished_at,
            created_at=model.created_at,
        )

    async def save_endpoint(self, endpoint: IntegrationEndpoint) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(IntegrationEndpointModel).where(
                    IntegrationEndpointModel.id == endpoint.id
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()
                if model:
                    model.name = endpoint.name
                    model.system_type = endpoint.system_type
                    model.connector_type = endpoint.connector_type.value
                    model.description = endpoint.description
                    model.is_enabled = endpoint.is_enabled
                    model.auth_type = endpoint.auth_type.value
                    model.encrypted_credentials = endpoint.encrypted_credentials
                    model.webhook_key = endpoint.webhook_key
                    model.webhook_header_name = endpoint.webhook_header_name
                    model.webhook_secret = endpoint.webhook_secret
                    model.source_url = endpoint.source_url
                    model.http_method = endpoint.http_method
                    model.request_headers = endpoint.request_headers
                    model.query_params = endpoint.query_params
                    model.schedule_interval_seconds = endpoint.schedule_interval_seconds
                    model.data_format = endpoint.data_format.value
                    model.file_delimiter = endpoint.file_delimiter
                    model.file_has_header = endpoint.file_has_header
                    model.file_encoding = endpoint.file_encoding
                    model.column_widths = endpoint.column_widths
                    model.last_run_at = endpoint.last_run_at
                else:
                    session.add(
                        IntegrationEndpointModel(
                            id=endpoint.id,
                            tenant_id=endpoint.tenant_id,
                            name=endpoint.name,
                            system_type=endpoint.system_type,
                            connector_type=endpoint.connector_type.value,
                            description=endpoint.description,
                            is_enabled=endpoint.is_enabled,
                            auth_type=endpoint.auth_type.value,
                            encrypted_credentials=endpoint.encrypted_credentials,
                            webhook_key=endpoint.webhook_key,
                            webhook_header_name=endpoint.webhook_header_name,
                            webhook_secret=endpoint.webhook_secret,
                            source_url=endpoint.source_url,
                            http_method=endpoint.http_method,
                            request_headers=endpoint.request_headers,
                            query_params=endpoint.query_params,
                            schedule_interval_seconds=endpoint.schedule_interval_seconds,
                            data_format=endpoint.data_format.value,
                            file_delimiter=endpoint.file_delimiter,
                            file_has_header=endpoint.file_has_header,
                            file_encoding=endpoint.file_encoding,
                            column_widths=endpoint.column_widths,
                            last_run_at=endpoint.last_run_at,
                        )
                    )
                try:
                    await session.flush()
                except IntegrityError:
                    raise ConflictError(
                        f"Já existe um ponto de integração com o nome '{endpoint.name}'."
                    )

    async def get_endpoint(
        self, tenant_id: UUID, endpoint_id: UUID
    ) -> Optional[IntegrationEndpoint]:
        async with self.session_factory() as session:
            stmt = select(IntegrationEndpointModel).where(
                IntegrationEndpointModel.tenant_id == tenant_id,
                IntegrationEndpointModel.id == endpoint_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_endpoint(model) if model else None

    async def get_endpoint_by_webhook_key(
        self, webhook_key: str
    ) -> Optional[IntegrationEndpoint]:
        async with self.session_factory() as session:
            stmt = select(IntegrationEndpointModel).where(
                IntegrationEndpointModel.webhook_key == webhook_key
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_endpoint(model) if model else None

    async def list_endpoints(self, tenant_id: UUID) -> List[IntegrationEndpoint]:
        async with self.session_factory() as session:
            stmt = (
                select(IntegrationEndpointModel)
                .where(IntegrationEndpointModel.tenant_id == tenant_id)
                .order_by(IntegrationEndpointModel.name)
            )
            res = await session.execute(stmt)
            return [self._to_endpoint(m) for m in res.scalars().all()]

    async def list_due_endpoints(self, now: datetime) -> List[IntegrationEndpoint]:
        async with self.session_factory() as session:
            stmt = select(IntegrationEndpointModel).where(
                IntegrationEndpointModel.is_enabled.is_(True),
                IntegrationEndpointModel.connector_type == ConnectorType.REST_PULL.value,
                IntegrationEndpointModel.schedule_interval_seconds.is_not(None),
            )
            res = await session.execute(stmt)
            endpoints = [self._to_endpoint(m) for m in res.scalars().all()]
            return [endpoint for endpoint in endpoints if endpoint.is_due_at(now)]

    async def delete_endpoint(self, tenant_id: UUID, endpoint_id: UUID) -> bool:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(IntegrationEndpointModel).where(
                    IntegrationEndpointModel.tenant_id == tenant_id,
                    IntegrationEndpointModel.id == endpoint_id,
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()
                if not model:
                    return False
                await session.delete(model)
                return True

    async def save_mapping(self, mapping: IntegrationMapping) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(IntegrationMappingModel).where(
                    IntegrationMappingModel.id == mapping.id
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()
                if model:
                    model.name = mapping.name
                    model.entity_type = mapping.entity_type
                    model.is_enabled = mapping.is_enabled
                    model.record_path = mapping.record_path
                    model.field_mappings = mapping.field_mappings
                    model.static_payload = mapping.static_payload
                    model.dedup_fields = mapping.dedup_fields
                    model.conflict_policy = mapping.conflict_policy.value
                    model.target_event_type = mapping.target_event_type
                    model.target_routing_key = mapping.target_routing_key
                else:
                    session.add(
                        IntegrationMappingModel(
                            id=mapping.id,
                            tenant_id=mapping.tenant_id,
                            endpoint_id=mapping.endpoint_id,
                            name=mapping.name,
                            entity_type=mapping.entity_type,
                            is_enabled=mapping.is_enabled,
                            record_path=mapping.record_path,
                            field_mappings=mapping.field_mappings,
                            static_payload=mapping.static_payload,
                            dedup_fields=mapping.dedup_fields,
                            conflict_policy=mapping.conflict_policy.value,
                            target_event_type=mapping.target_event_type,
                            target_routing_key=mapping.target_routing_key,
                        )
                    )
                try:
                    await session.flush()
                except IntegrityError:
                    raise ConflictError(
                        f"Já existe um mapeamento com o nome '{mapping.name}' para este ponto de integração."
                    )

    async def get_mapping(self, tenant_id: UUID, mapping_id: UUID) -> Optional[IntegrationMapping]:
        async with self.session_factory() as session:
            stmt = select(IntegrationMappingModel).where(
                IntegrationMappingModel.tenant_id == tenant_id,
                IntegrationMappingModel.id == mapping_id,
            )
            res = await session.execute(stmt)
            model = res.scalar_one_or_none()
            return self._to_mapping(model) if model else None

    async def list_mappings(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None
    ) -> List[IntegrationMapping]:
        async with self.session_factory() as session:
            stmt = select(IntegrationMappingModel).where(
                IntegrationMappingModel.tenant_id == tenant_id
            )
            if endpoint_id:
                stmt = stmt.where(IntegrationMappingModel.endpoint_id == endpoint_id)
            stmt = stmt.order_by(IntegrationMappingModel.name)
            res = await session.execute(stmt)
            return [self._to_mapping(m) for m in res.scalars().all()]

    async def delete_mapping(self, tenant_id: UUID, mapping_id: UUID) -> bool:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(IntegrationMappingModel).where(
                    IntegrationMappingModel.tenant_id == tenant_id,
                    IntegrationMappingModel.id == mapping_id,
                )
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()
                if not model:
                    return False
                await session.delete(model)
                return True

    async def save_run(self, run: IntegrationRun) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                stmt = select(IntegrationRunModel).where(IntegrationRunModel.id == run.id)
                res = await session.execute(stmt)
                model = res.scalar_one_or_none()
                if model:
                    model.status = run.status.value
                    model.mapping_id = run.mapping_id
                    model.records_received = run.records_received
                    model.records_succeeded = run.records_succeeded
                    model.records_failed = run.records_failed
                    model.records_skipped = run.records_skipped
                    model.message = run.message
                    model.finished_at = run.finished_at
                else:
                    session.add(
                        IntegrationRunModel(
                            id=run.id,
                            tenant_id=run.tenant_id,
                            endpoint_id=run.endpoint_id,
                            mapping_id=run.mapping_id,
                            trigger=run.trigger.value,
                            status=run.status.value,
                            records_received=run.records_received,
                            records_succeeded=run.records_succeeded,
                            records_failed=run.records_failed,
                            records_skipped=run.records_skipped,
                            message=run.message,
                            started_at=run.started_at,
                            finished_at=run.finished_at,
                        )
                    )

    async def list_runs(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None, limit: int = 50
    ) -> List[IntegrationRun]:
        async with self.session_factory() as session:
            stmt = select(IntegrationRunModel).where(IntegrationRunModel.tenant_id == tenant_id)
            if endpoint_id:
                stmt = stmt.where(IntegrationRunModel.endpoint_id == endpoint_id)
            stmt = stmt.order_by(IntegrationRunModel.created_at.desc()).limit(limit)
            res = await session.execute(stmt)
            return [self._to_run(m) for m in res.scalars().all()]

    async def dedup_exists(self, tenant_id: UUID, mapping_id: UUID, dedup_hash: str) -> bool:
        async with self.session_factory() as session:
            stmt = select(IngestedRecordModel.id).where(
                IngestedRecordModel.tenant_id == tenant_id,
                IngestedRecordModel.mapping_id == mapping_id,
                IngestedRecordModel.dedup_hash == dedup_hash,
            )
            res = await session.execute(stmt)
            return res.scalar_one_or_none() is not None

    async def mark_ingested(
        self, tenant_id: UUID, mapping_id: UUID, dedup_hash: str, entity_type: str
    ) -> None:
        async with self.session_factory() as session:
            async with session.begin():
                session.add(
                    IngestedRecordModel(
                        tenant_id=tenant_id,
                        mapping_id=mapping_id,
                        dedup_hash=dedup_hash,
                        entity_type=entity_type,
                    )
                )
