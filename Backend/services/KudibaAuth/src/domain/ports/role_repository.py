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
    async def replace_role_permissions(
        self,
        role_id: str,
        permission_ids: List[str],
        tenant_id: uuid.UUID,
        scope: Optional[uuid.UUID] = None,
    ) -> None:
        """Substitui as permissões do perfil.

        Perfis personalizados gravam nas permissões do próprio perfil.
        Perfis de Sistema gravam um override no âmbito indicado: a empresa
        (scope = tenant_id) ou global (scope = None, definido pelo SYSADMIN).
        """
        pass

    @abstractmethod
    async def reset_role_permissions(
        self, role_id: str, tenant_id: uuid.UUID, include_global: bool = False
    ) -> None:
        """Remove as personalizações do perfil, repondo as permissões predefinidas do ERP."""
        pass

    @abstractmethod
    async def role_override_scope(self, role_id: str, tenant_id: uuid.UUID) -> Optional[str]:
        """Âmbito da personalização que afecta o perfil nesta empresa.

        Devolve 'tenant' (personalização da empresa), 'global' (personalização do
        SYSADMIN) ou None quando o perfil usa as permissões predefinidas do ERP.
        """
        pass

    @abstractmethod
    async def delete_role(self, role_id: str) -> None:
        pass

    @abstractmethod
    async def count_role_assignments(self, role_id: str, tenant_id: Optional[uuid.UUID] = None) -> int:
        """Contagem de atribuições; com tenant_id conta apenas nessa empresa."""
        pass
