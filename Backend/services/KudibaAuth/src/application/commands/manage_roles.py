import uuid
from typing import List

from src.application.dto import (
    CreateRoleCommand,
    RoleDto,
    UpdateRoleCommand,
    UpdateRolePermissionsCommand,
)
from src.domain.entities.role import Role
from src.domain.error import AuthorizationError, ConflictError, DomainError, EntityNotFoundError
from src.domain.ports.role_repository import IRoleRepository

RESERVED_ROLE_IDS = {"SUPER_ADMIN"}


def _normalize_role_id(role_id: str) -> str:
    return role_id.strip().upper()


async def _ensure_permissions_exist(role_repo: IRoleRepository, permission_ids: List[str]) -> List[str]:
    clean = list(dict.fromkeys(p.strip() for p in permission_ids if p.strip()))
    if not clean:
        return []
    known = {p.id for p in await role_repo.list_permissions()}
    unknown = [p for p in clean if p not in known]
    if unknown:
        raise DomainError(f"Permissões desconhecidas: {', '.join(unknown)}.", code="INVALID_PERMISSION")
    return clean


async def _load_owned_role(role_repo: IRoleRepository, role_id: str, tenant_id: uuid.UUID) -> Role:
    role = await role_repo.find_role_owned(role_id, tenant_id)
    if not role:
        exists_globally = await role_repo.find_role(role_id, tenant_id)
        if exists_globally:
            raise AuthorizationError("Os papéis do sistema não podem ser alterados.")
        raise EntityNotFoundError("Perfil", role_id)
    return role


class CreateRoleUseCase:
    """Caso de uso de criação de um perfil de acesso personalizado no âmbito do tenant."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(self, cmd: CreateRoleCommand) -> RoleDto:
        role_id = _normalize_role_id(cmd.role_id)
        if role_id in RESERVED_ROLE_IDS:
            raise DomainError(f"O identificador '{role_id}' é reservado.", code="RESERVED_ROLE_ID")
        name = cmd.name.strip()
        if not 2 <= len(name) <= 64:
            raise DomainError("O nome do perfil deve ter entre 2 e 64 caracteres.", code="INVALID_ROLE_NAME")

        permission_ids = await _ensure_permissions_exist(self.role_repo, cmd.permissions)
        if await self.role_repo.find_role(role_id, cmd.tenant_id):
            raise ConflictError(
                f"O código '{role_id}' já está em uso. Escolha outro código (ex.: {role_id}_B)."
            )

        role = Role(
            id=role_id,
            name=name,
            description=(cmd.description or "").strip() or None,
            is_system=False,
            tenant_id=cmd.tenant_id,
        )
        await self.role_repo.save_role(role, permission_ids)
        return RoleDto(
            id=role.id,
            name=role.name,
            description=role.description,
            is_system=False,
            permissions=permission_ids,
            users_count=0,
        )


class UpdateRoleUseCase:
    """Caso de uso de actualização dos dados de um perfil personalizado do tenant."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(self, cmd: UpdateRoleCommand) -> RoleDto:
        role_id = _normalize_role_id(cmd.role_id)
        role = await _load_owned_role(self.role_repo, role_id, cmd.tenant_id)

        name = cmd.name.strip()
        if not 2 <= len(name) <= 64:
            raise DomainError("O nome do perfil deve ter entre 2 e 64 caracteres.", code="INVALID_ROLE_NAME")
        description = (cmd.description or "").strip() or None
        await self.role_repo.update_role(role_id, name, description)
        users_count = await self.role_repo.count_role_assignments(role_id, cmd.tenant_id)
        return RoleDto(
            id=role_id,
            name=name,
            description=description,
            is_system=False,
            permissions=[p.id for p in role.permissions],
            users_count=users_count,
        )


class UpdateRolePermissionsUseCase:
    """Caso de uso de substituição das permissões de um perfil personalizado do tenant."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(self, cmd: UpdateRolePermissionsCommand) -> RoleDto:
        role_id = _normalize_role_id(cmd.role_id)
        role = await _load_owned_role(self.role_repo, role_id, cmd.tenant_id)

        permission_ids = await _ensure_permissions_exist(self.role_repo, cmd.permissions)
        await self.role_repo.replace_role_permissions(role_id, permission_ids)
        users_count = await self.role_repo.count_role_assignments(role_id, cmd.tenant_id)
        return RoleDto(
            id=role_id,
            name=role.name,
            description=role.description,
            is_system=False,
            permissions=permission_ids,
            users_count=users_count,
        )


class DeleteRoleUseCase:
    """Caso de uso de remoção de um perfil personalizado do tenant (sem utilizadores atribuídos)."""

    def __init__(self, role_repo: IRoleRepository):
        self.role_repo = role_repo

    async def execute(self, role_id: str, tenant_id: uuid.UUID) -> None:
        normalized = _normalize_role_id(role_id)
        role = await _load_owned_role(self.role_repo, normalized, tenant_id)
        if role.is_system:
            raise AuthorizationError("Os perfis de sistema não podem ser eliminados.")
        if await self.role_repo.count_role_assignments(normalized) > 0:
            raise ConflictError("Não é possível eliminar um perfil que está atribuído a utilizadores.")
        await self.role_repo.delete_role(normalized)
