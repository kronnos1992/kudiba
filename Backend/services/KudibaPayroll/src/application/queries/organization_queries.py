from typing import List
from uuid import UUID
from src.domain.entities.organization import Department, JobPosition
from src.domain.ports.organization_repository import OrganizationRepository


class ListDepartmentsUseCase:
    def __init__(self, org_repo: OrganizationRepository):
        self.org_repo = org_repo

    async def execute(self, tenant_id: UUID) -> List[Department]:
        return await self.org_repo.list_departments(tenant_id)


class ListJobPositionsUseCase:
    def __init__(self, org_repo: OrganizationRepository):
        self.org_repo = org_repo

    async def execute(self, tenant_id: UUID) -> List[JobPosition]:
        return await self.org_repo.list_job_positions(tenant_id)
