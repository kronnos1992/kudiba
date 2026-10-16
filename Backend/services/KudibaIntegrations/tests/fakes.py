from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from src.domain.entities.integration import (
    IntegrationEndpoint,
    IntegrationMapping,
    IntegrationRun,
)
from src.domain.ports.integration_repository import IntegrationRepository


class FakeEventPublisher:
    def __init__(self):
        self.published: List[Dict[str, Any]] = []

    async def publish(self, routing_key: str, payload: Dict[str, Any]) -> None:
        self.published.append({"routing_key": routing_key, "payload": payload})


class InMemoryIntegrationRepository(IntegrationRepository):
    def __init__(self):
        self.endpoints: Dict[UUID, IntegrationEndpoint] = {}
        self.mappings: Dict[UUID, IntegrationMapping] = {}
        self.runs: List[IntegrationRun] = []
        self.ingested: List[tuple] = []

    async def save_endpoint(self, endpoint: IntegrationEndpoint) -> None:
        self.endpoints[endpoint.id] = endpoint

    async def get_endpoint(self, tenant_id: UUID, endpoint_id: UUID) -> Optional[IntegrationEndpoint]:
        endpoint = self.endpoints.get(endpoint_id)
        if endpoint and endpoint.tenant_id == tenant_id:
            return endpoint
        return None

    async def get_endpoint_by_webhook_key(self, webhook_key: str) -> Optional[IntegrationEndpoint]:
        for endpoint in self.endpoints.values():
            if endpoint.webhook_key == webhook_key:
                return endpoint
        return None

    async def list_endpoints(self, tenant_id: UUID) -> List[IntegrationEndpoint]:
        return [e for e in self.endpoints.values() if e.tenant_id == tenant_id]

    async def list_due_endpoints(self, now: datetime) -> List[IntegrationEndpoint]:
        return [e for e in self.endpoints.values() if e.is_due_at(now)]

    async def delete_endpoint(self, tenant_id: UUID, endpoint_id: UUID) -> bool:
        endpoint = self.endpoints.get(endpoint_id)
        if not endpoint or endpoint.tenant_id != tenant_id:
            return False
        del self.endpoints[endpoint_id]
        return True

    async def save_mapping(self, mapping: IntegrationMapping) -> None:
        self.mappings[mapping.id] = mapping

    async def get_mapping(self, tenant_id: UUID, mapping_id: UUID) -> Optional[IntegrationMapping]:
        mapping = self.mappings.get(mapping_id)
        if mapping and mapping.tenant_id == tenant_id:
            return mapping
        return None

    async def list_mappings(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None
    ) -> List[IntegrationMapping]:
        result = [m for m in self.mappings.values() if m.tenant_id == tenant_id]
        if endpoint_id:
            result = [m for m in result if m.endpoint_id == endpoint_id]
        return result

    async def delete_mapping(self, tenant_id: UUID, mapping_id: UUID) -> bool:
        mapping = self.mappings.get(mapping_id)
        if not mapping or mapping.tenant_id != tenant_id:
            return False
        del self.mappings[mapping_id]
        return True

    async def save_run(self, run: IntegrationRun) -> None:
        self.runs.append(run)

    async def list_runs(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None, limit: int = 50
    ) -> List[IntegrationRun]:
        result = [r for r in self.runs if r.tenant_id == tenant_id]
        if endpoint_id:
            result = [r for r in result if r.endpoint_id == endpoint_id]
        return result[:limit]

    async def dedup_exists(self, tenant_id: UUID, mapping_id: UUID, dedup_hash: str) -> bool:
        return (tenant_id, mapping_id, dedup_hash) in self.ingested

    async def mark_ingested(
        self, tenant_id: UUID, mapping_id: UUID, dedup_hash: str, entity_type: str
    ) -> None:
        self.ingested.append((tenant_id, mapping_id, dedup_hash))
