import uuid
from typing import List
from src.application.dto import BranchSummaryDto
from src.domain.ports.tenant_repository import ITenantRepository


class ListBranchesUseCase:
    """Caso de uso de listagem de filiais de uma organização (CQRS Query)."""
    def __init__(self, tenant_repo: ITenantRepository):
        self.tenant_repo = tenant_repo

    async def execute(self, tenant_id: uuid.UUID) -> List[BranchSummaryDto]:
        branches = await self.tenant_repo.find_branches(tenant_id)
        return [
            BranchSummaryDto(id=b.id, code=b.code, name=b.name, city=b.city)
            for b in branches
            if b.is_active
        ]
