import uuid
from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.entities.branch import Branch
from src.domain.entities.tenant import Tenant


class ITenantRepository(ABC):
    @abstractmethod
    async def find_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        pass

    @abstractmethod
    async def find_by_slug(self, slug: str) -> Optional[Tenant]:
        pass

    @abstractmethod
    async def find_branches(self, tenant_id: uuid.UUID) -> List[Branch]:
        pass

    @abstractmethod
    async def find_branch_by_id(self, branch_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[Branch]:
        pass

    @abstractmethod
    async def save_branch(self, branch: Branch) -> None:
        pass
