import uuid
from typing import List, Optional

from src.application.dto import (
    CreateRoleCommand,
    RoleDto,
    UpdateRoleCommand,
    UpdateRolePermissionsCommand,
)
from src.domain.entities.role import Role
from src.domain.error import AuthorizationError, ConflictError, DomainError, EntityNotFoundError
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.role_repository import IRoleRepository
from src.domain.value_objects.role_type import ADMIN_ROLE_IDS, IMMUTABLE_ADMIN_ROLE_IDS, RoleType

RESERVED_ROLE_IDS = set(IMMUTABLE_ADMIN_ROLE_IDS)
SYSTEM_SCOPE_ROLE_IDS = {"SUPER_ADMIN", "SYSADMIN"}
ADMIN_GUARDED_PERMISSIONS = {"users:read", "users:invite", "users:manage_roles", "tenant:settings:manage"}


def _normalize_role_id(role_id: str) -> str:
    return role_id.strip().upper()


def _is_editable(role_id: str) -> bool:
    """Perfis imutáveis: apenas SYSADMIN e SUPER_ADMIN. O ADMIN pode ser editado."""
    return not RoleType.is_immutable_admin(role_id)


def _is_system_manager(actor_roles: Optional[List[str]]) -> bool:
    """O SYSADMIN gere o sistema em geral: as suas alterações alcançam todos os tenants."""
    roles = {r.strip().upper() for r in (actor_roles or [])}
    return bool(roles & SYSTEM_SCOPE_ROLE_IDS)


async def _ensure_permissions_exist(role_repo: IRoleRepository, permission_ids: List[str]) -> List[str]:
    clean = list(dict.fromkeys(p.strip() for p in permission_ids if p.strip()))
    if not clean:
        return []
    known = {p.id for p in await role_repo.list_permissions()}
    unknown = [p for p in clean if p not in known]
    if unknown:
        raise DomainError(f"Permissões desconhecidas: {', '.join(unknown)}.", code="INVALID_PERMISSION")
    return clean


def _ensure_admin_guardrails(role_id: str, permission_ids: List[str]) -> List[str]:
    """Garante que o ADMIN conserva sempre o acesso à gestão da empresa."""
    if role_id not in ADMIN_ROLE_IDS:
        return permission_ids
    merged = set(permission_ids) | ADMIN_GUARDED_PERMISSIONS
    return sorted(merged)


async def _load_owned_role(role_repo: IRoleRepository, role_id: str, tenant_id: uuid.UUID) -> Role:
    role = await role_repo.find_role_owned(role_id, tenant_id)
    if not role:
        exists_globally = await role_repo.find_role(role_id, tenant_id)
        if exists_globally:
            raise AuthorizationError(
                "Os perfis de Sistema não podem ser renomeados nem eliminados. "
                "Apenas as permissões podem ser ajustadas."
            )
        raise EntityNotFoundError("Perfil", role_id)
    return role


async def _load_editable_role(role_repo: IRoleRepository, role_id: str, tenant_id: uuid.UUID) -> Role:
    """Perfil visível para o tenant e cujas permissões podem ser alteradas."""
    role = await role_repo.find_role(role_id, tenant_id)
    if not role:
        raise EntityNotFoundError("Perfil", role_id)
    if not _is_editable(role.id):
        raise AuthorizationError(
            "Os perfis de administrador (SYSADMIN, SUPER_ADMIN) têm acesso total "
            "e as suas permissões são imutáveis."
        )
    return role


class CreateRoleUseCase:
    """Caso de uso de criação de um perfil de acesso personalizado no âmbito do tenant."""

    def __init__(self, role_repo: IRoleRepository, audit_repo: Optional[IAuditRepository] = None):
        self.role_repo = role_repo
        self.audit_repo = audit_repo

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
        if self.audit_repo is not None:
            await self.audit_repo.record_event(
                action="ROLE_CREATED",
                tenant_id=cmd.tenant_id,
                details={"role_id": role.id, "name": role.name, "permissions": permission_ids},
            )
        return RoleDto(
            id=role.id,
            name=role.name,
            description=role.description,
            is_system=False,
            permissions=permission_ids,
            users_count=0,
            is_editable=True,
            has_override=False,
            can_reset_override=False,
        )


class UpdateRoleUseCase:
    """Caso de uso de actualização dos dados de um perfil personalizado do tenant."""

    def __init__(self, role_repo: IRoleRepository, audit_repo: Optional[IAuditRepository] = None):
        self.role_repo = role_repo
        self.audit_repo = audit_repo

    async def execute(self, cmd: UpdateRoleCommand) -> RoleDto:
        role_id = _normalize_role_id(cmd.role_id)
        role = await _load_owned_role(self.role_repo, role_id, cmd.tenant_id)

        name = cmd.name.strip()
        if not 2 <= len(name) <= 64:
            raise DomainError("O nome do perfil deve ter entre 2 e 64 caracteres.", code="INVALID_ROLE_NAME")
        description = (cmd.description or "").strip() or None
        await self.role_repo.update_role(role_id, name, description)
        if self.audit_repo is not None:
            await self.audit_repo.record_event(
                action="ROLE_UPDATED",
                tenant_id=cmd.tenant_id,
                details={"role_id": role_id, "name": name},
            )
        users_count = await self.role_repo.count_role_assignments(role_id, cmd.tenant_id)
        return RoleDto(
            id=role_id,
            name=name,
            description=description,
            is_system=False,
            permissions=[p.id for p in role.permissions],
            users_count=users_count,
            is_editable=_is_editable(role_id),
            has_override=False,
            can_reset_override=False,
        )


class UpdateRolePermissionsUseCase:
    """Caso de uso de substituição das permissões de um perfil.

    Âmbito da alteração:
      * SYSADMIN -> global, afecta todos os tenants;
      * ADMIN da empresa -> apenas a empresa em que está autenticado.
    """

    def __init__(self, role_repo: IRoleRepository, audit_repo: Optional[IAuditRepository] = None):
        self.role_repo = role_repo
        self.audit_repo = audit_repo

    async def execute(self, cmd: UpdateRolePermissionsCommand) -> RoleDto:
        role_id = _normalize_role_id(cmd.role_id)
        role = await _load_editable_role(self.role_repo, role_id, cmd.tenant_id)

        permission_ids = await _ensure_permissions_exist(self.role_repo, cmd.permissions)
        permission_ids = _ensure_admin_guardrails(role_id, permission_ids)
        global_scope = _is_system_manager(cmd.actor_roles)
        scope = None if global_scope else cmd.tenant_id
        await self.role_repo.replace_role_permissions(role_id, permission_ids, cmd.tenant_id, scope)
        if self.audit_repo is not None:
            await self.audit_repo.record_event(
                action="ROLE_PERMISSIONS_UPDATED",
                tenant_id=cmd.tenant_id,
                details={
                    "role_id": role_id,
                    "permissions": permission_ids,
                    "scope": "global" if global_scope else str(cmd.tenant_id),
                },
            )
        users_count = await self.role_repo.count_role_assignments(role_id, cmd.tenant_id)
        refreshed = await self.role_repo.find_role(role_id, cmd.tenant_id)
        override_scope = await self.role_repo.role_override_scope(role_id, cmd.tenant_id)
        return RoleDto(
            id=role_id,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=permission_ids,
            users_count=users_count,
            is_editable=True,
            has_override=bool(refreshed and refreshed.has_override),
            can_reset_override=override_scope is not None,
        )


class ResetRolePermissionsUseCase:
    """Caso de uso de reposição das permissões predefinidas de um perfil."""

    def __init__(self, role_repo: IRoleRepository, audit_repo: Optional[IAuditRepository] = None):
        self.role_repo = role_repo
        self.audit_repo = audit_repo

    async def execute(
        self, role_id: str, tenant_id: uuid.UUID, actor_roles: Optional[List[str]] = None
    ) -> RoleDto:
        normalized = _normalize_role_id(role_id)
        role = await _load_editable_role(self.role_repo, normalized, tenant_id)
        include_global = _is_system_manager(actor_roles)
        await self.role_repo.reset_role_permissions(normalized, tenant_id, include_global)
        if self.audit_repo is not None:
            await self.audit_repo.record_event(
                action="ROLE_PERMISSIONS_RESET",
                tenant_id=tenant_id,
                details={"role_id": normalized},
            )
        users_count = await self.role_repo.count_role_assignments(normalized, tenant_id)
        refreshed = await self.role_repo.find_role(normalized, tenant_id)
        override_scope = await self.role_repo.role_override_scope(normalized, tenant_id)
        return RoleDto(
            id=normalized,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=[p.id for p in (refreshed.permissions if refreshed else role.permissions)],
            users_count=users_count,
            is_editable=True,
            has_override=bool(refreshed and refreshed.has_override),
            can_reset_override=override_scope is not None,
        )


class DeleteRoleUseCase:
    """Caso de uso de remoção de um perfil personalizado do tenant (sem utilizadores atribuídos)."""

    def __init__(self, role_repo: IRoleRepository, audit_repo: Optional[IAuditRepository] = None):
        self.role_repo = role_repo
        self.audit_repo = audit_repo

    async def execute(self, role_id: str, tenant_id: uuid.UUID) -> None:
        normalized = _normalize_role_id(role_id)
        role = await _load_owned_role(self.role_repo, normalized, tenant_id)
        if role.is_system:
            raise AuthorizationError("Os perfis de sistema não podem ser eliminados.")
        if await self.role_repo.count_role_assignments(normalized) > 0:
            raise ConflictError("Não é possível eliminar um perfil que está atribuído a utilizadores.")
        await self.role_repo.delete_role(normalized)
        if self.audit_repo is not None:
            await self.audit_repo.record_event(
                action="ROLE_DELETED",
                tenant_id=tenant_id,
                details={"role_id": normalized},
            )
