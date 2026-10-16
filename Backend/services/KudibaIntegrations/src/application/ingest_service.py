from typing import Any, List
from uuid import uuid4
from datetime import datetime, timezone

from src.domain.entities.integration import IntegrationEndpoint, IntegrationMapping, IntegrationRun
from src.domain.error import ValidationError
from src.domain.ports.event_publisher import EventPublisher
from src.domain.ports.integration_repository import IntegrationRepository
from src.domain.services.mapping_engine import (
    apply_field_mappings,
    compute_dedup_hash,
    extract_records,
)
from src.domain.value_objects.enums import RunStatus, RunTrigger


class IngestService:
    def __init__(self, repository: IntegrationRepository, publisher: EventPublisher):
        self.repository = repository
        self.publisher = publisher

    @staticmethod
    def _build_envelope(
        endpoint: IntegrationEndpoint,
        mapping: IntegrationMapping,
        body: dict,
    ) -> dict:
        return {
            "event_id": str(uuid4()),
            "tenant_id": str(endpoint.tenant_id),
            "event_type": mapping.target_event_type,
            "source": endpoint.name,
            "source_system_type": endpoint.system_type,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": body,
        }

    async def ingest_payload(
        self,
        endpoint: IntegrationEndpoint,
        payload: Any,
        trigger: RunTrigger,
        entity_type: str | None = None,
    ) -> IntegrationRun:
        mappings = await self.repository.list_mappings(endpoint.tenant_id, endpoint.id)
        mappings = [m for m in mappings if m.is_enabled]
        if entity_type:
            mappings = [m for m in mappings if m.entity_type == entity_type]

        run = IntegrationRun.start(endpoint.tenant_id, endpoint.id, trigger)
        received = succeeded = failed = skipped = 0
        errors: List[str] = []

        for mapping in mappings:
            records = extract_records(payload, mapping.record_path)
            received += len(records)
            for record in records:
                try:
                    mapped = apply_field_mappings(record, mapping.field_mappings)
                except ValidationError as exc:
                    failed += 1
                    errors.append(str(exc.message))
                    continue

                body = {**mapping.static_payload, **mapped}
                dedup = compute_dedup_hash(mapping.dedup_fields, body)
                if dedup and await self.repository.dedup_exists(
                    endpoint.tenant_id, mapping.id, dedup
                ):
                    skipped += 1
                    continue

                envelope = self._build_envelope(endpoint, mapping, body)
                await self.publisher.publish(mapping.target_routing_key, envelope)

                if dedup:
                    await self.repository.mark_ingested(
                        endpoint.tenant_id, mapping.id, dedup, mapping.entity_type
                    )
                succeeded += 1

        run.records_received = received
        run.records_succeeded = succeeded
        run.records_failed = failed
        run.records_skipped = skipped

        if failed == 0:
            status = RunStatus.SUCCESS
        elif succeeded > 0:
            status = RunStatus.PARTIAL
        else:
            status = RunStatus.FAILED

        message = None
        if errors:
            message = "; ".join(errors[:5])
        elif received == 0:
            message = "Nenhum registo encontrado no payload para os mapeamentos ativos."
        run.complete(status, message)

        await self.repository.save_run(run)
        return run
