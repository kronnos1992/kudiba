from typing import List, Optional
from uuid import UUID

from src.domain.entities.integration import (
    IntegrationEndpoint,
    IntegrationMapping,
    IntegrationRun,
)
from src.domain.error import EntityNotFoundError
from src.domain.ports.integration_repository import IntegrationRepository


class ListEndpointsUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(self, tenant_id: UUID) -> List[IntegrationEndpoint]:
        return await self.repository.list_endpoints(tenant_id)


class GetEndpointUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(self, tenant_id: UUID, endpoint_id: UUID) -> IntegrationEndpoint:
        endpoint = await self.repository.get_endpoint(tenant_id, endpoint_id)
        if not endpoint:
            raise EntityNotFoundError("Ponto de Integração", str(endpoint_id))
        return endpoint


class ListMappingsUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None
    ) -> List[IntegrationMapping]:
        return await self.repository.list_mappings(tenant_id, endpoint_id=endpoint_id)


class ListRunsUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(
        self, tenant_id: UUID, endpoint_id: Optional[UUID] = None, limit: int = 50
    ) -> List[IntegrationRun]:
        return await self.repository.list_runs(tenant_id, endpoint_id=endpoint_id, limit=limit)
