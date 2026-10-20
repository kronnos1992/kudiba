import uuid
from abc import ABC, abstractmethod
from typing import List, Optional

from src.domain.entities.role import Permission, Role


class IRoleRepository(ABC):
    @abstractmethod
    async def list_roles(self, tenant_id: uuid.UUID) -> List[Role]:
        """Retorna perfis de sistema (globais) + perfis personalizados do tenant indicado."""
        pass

    @abstractmethod
    async def find_role(self, role_id: str, tenant_id: uuid.UUID) -> Optional[Role]:
        """Localiza um perfil visível para o tenant (sistema ou do próprio tenant)."""
        pass

    @abstractmethod
    async def find_role_owned(self, role_id: str, tenant_id: uuid.UUID) -> Optional[Role]:
        """Localiza um perfil personalizado detido pelo tenant (para mutações)."""
        pass

    @abstractmethod
    async def list_permissions(self) -> List[Permission]:
        pass

    @abstractmethod
    async def list_role_ids(self, tenant_id: uuid.UUID) -> List[str]:
        """Identificadores de perfis atribuíveis no tenant (sistema + do tenant)."""
        pass

    @abstractmethod
    async def save_role(self, role: Role, permission_ids: List[str]) -> None:
        pass

    @abstractmethod
    async def update_role(self, role_id: str, name: str, description: Optional[str]) -> None:
        pass

    @abstractmethod
    async def replace_role_permissions(self, role_id: str, permission_ids: List[str]) -> None:
        pass

    @abstractmethod
    async def delete_role(self, role_id: str) -> None:
        pass

    @abstractmethod
    async def count_role_assignments(self, role_id: str, tenant_id: Optional[uuid.UUID] = None) -> int:
        """Contagem de atribuições; com tenant_id conta apenas nessa empresa."""
        pass
