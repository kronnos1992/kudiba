from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from src.domain.entities.integration import (
    IntegrationEndpoint,
    IntegrationMapping,
    IntegrationRun,
)


class IntegrationRepository(ABC):
    @abstractmethod
    async def save_endpoint(self, endpoint: IntegrationEndpoint) -> None:
        pass

    @abstractmethod
    async def get_endpoint(self, tenant_id: UUID, endpoint_id: UUID) -> Optional[IntegrationEndpoint]:
        pass

    @abstractmethod
    async def get_endpoint_by_webhook_key(self, webhook_key: str) -> Optional[IntegrationEndpoint]:
        pass

    @abstractmethod
    async def list_endpoints(self, tenant_id: UUID) -> List[IntegrationEndpoint]:
        pass

    @abstractmethod
    async def list_due_endpoints(self, now) -> List[IntegrationEndpoint]:
        pass

    @abstractmethod
    async def delete_endpoint(self, tenant_id: UUID, endpoint_id: UUID) -> bool:
        pass

    @abstractmethod
    async def save_mapping(self, mapping: IntegrationMapping) -> None:
        pass

    @abstractmethod
    async def get_mapping(self, tenant_id: UUID, mapping_id: UUID) -> Optional[IntegrationMapping]:
        pass

    @abstractmethod
    async def list_mappings(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None
    ) -> List[IntegrationMapping]:
        pass

    @abstractmethod
    async def delete_mapping(self, tenant_id: UUID, mapping_id: UUID) -> bool:
        pass

    @abstractmethod
    async def save_run(self, run: IntegrationRun) -> None:
        pass

    @abstractmethod
    async def list_runs(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None, limit: int = 50
    ) -> List[IntegrationRun]:
        pass

    @abstractmethod
    async def dedup_exists(self, tenant_id: UUID, mapping_id: UUID, dedup_hash: str) -> bool:
        pass

    @abstractmethod
    async def mark_ingested(
        self, tenant_id: UUID, mapping_id: UUID, dedup_hash: str, entity_type: str
    ) -> None:
        pass
