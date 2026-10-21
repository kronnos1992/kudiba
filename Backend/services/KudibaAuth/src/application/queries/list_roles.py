import uuid
from typing import List, Optional

from src.application.dto import RoleDto
from src.domain.ports.role_repository import IRoleRepository
from src.domain.value_objects.role_type import RoleType


class ListRolesUseCase:
    """Caso de uso de listagem do catálogo de perfis e permissões RBAC do tenant activo."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(
        self, tenant_id: uuid.UUID, actor_roles: Optional[List[str]] = None
    ) -> List[RoleDto]:
        roles = await self.role_repo.list_roles(tenant_id)
        system_manager = bool(
            {r.strip().upper() for r in (actor_roles or [])} & {"SUPER_ADMIN", "SYSADMIN"}
        )
        results: List[RoleDto] = []
        for r in roles:
            users_count = await self.role_repo.count_role_assignments(r.id, tenant_id)
            override_scope = await self.role_repo.role_override_scope(r.id, tenant_id)
            results.append(
                RoleDto(
                    id=r.id,
                    name=r.name,
                    description=r.description,
                    is_system=r.is_system,
                    permissions=[p.id for p in r.permissions],
                    users_count=users_count,
                    is_editable=not RoleType.is_immutable_admin(r.id),
                    has_override=r.has_override,
                    can_reset_override=override_scope is not None
                    and (system_manager or override_scope == "tenant"),
                )
            )
        return results
