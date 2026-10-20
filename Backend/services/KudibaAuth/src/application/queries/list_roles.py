import uuid
from typing import List

from src.application.dto import RoleDto
from src.domain.ports.role_repository import IRoleRepository


class ListRolesUseCase:
    """Caso de uso de listagem do catálogo de perfis e permissões RBAC do tenant activo."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(self, tenant_id: uuid.UUID) -> List[RoleDto]:
        roles = await self.role_repo.list_roles(tenant_id)
        results: List[RoleDto] = []
        for r in roles:
            users_count = await self.role_repo.count_role_assignments(r.id, tenant_id)
            results.append(
                RoleDto(
                    id=r.id,
                    name=r.name,
                    description=r.description,
                    is_system=r.is_system,
                    permissions=[p.id for p in r.permissions],
                    users_count=users_count,
                )
            )
        return results
