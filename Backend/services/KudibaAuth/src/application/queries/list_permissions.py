from typing import List

from src.application.dto import PermissionDto
from src.domain.ports.role_repository import IRoleRepository


class ListPermissionsUseCase:
    """Caso de uso de listagem do catálogo de permissões disponíveis no sistema."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(self) -> List[PermissionDto]:
        perms = await self.role_repo.list_permissions()
        return [PermissionDto(id=p.id, module=p.module, name=p.name, description=p.description) for p in perms]
