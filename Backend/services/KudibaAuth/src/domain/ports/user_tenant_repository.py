import uuid
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from src.domain.entities.user_tenant import UserTenant


class IUserTenantRepository(ABC):
    @abstractmethod
    async def find_membership(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[UserTenant]:
        pass

    @abstractmethod
    async def find_user_memberships(self, user_id: uuid.UUID) -> List[UserTenant]:
        pass

    @abstractmethod
    async def find_tenant_members(self, tenant_id: uuid.UUID) -> List[Tuple[UserTenant, str, str]]:
        """Retorna lista de tuplas (membership, email, full_name)."""
        pass

    @abstractmethod
    async def save_membership(self, membership: UserTenant) -> None:
        pass

    @abstractmethod
    async def get_user_roles_in_tenant(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> List[str]:
        pass

    @abstractmethod
    async def get_roles_permissions(self, role_ids: List[str]) -> List[str]:
        pass

    @abstractmethod
    async def assign_roles(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: List[str]) -> None:
        pass

    @abstractmethod
    async def update_roles(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: List[str]) -> None:
        pass

    @abstractmethod
    async def lock_tenant_role_updates(self, tenant_id: uuid.UUID) -> None:
        """Serializa alterações de papéis para impedir remoção concorrente do último ADMIN."""
        pass

    @abstractmethod
    async def count_active_admins(self, tenant_id: uuid.UUID) -> int:
        pass
