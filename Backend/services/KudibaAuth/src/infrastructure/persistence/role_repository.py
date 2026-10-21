import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities.role import Permission, Role
from src.domain.ports.role_repository import IRoleRepository
from src.infrastructure.persistence.models import (
    PermissionModel,
    RoleModel,
    RolePermissionModel,
    RolePermissionOverrideModel,
    UserRoleModel,
)
from src.infrastructure.persistence.unit_of_work import session_scope


def _visibility_clause(tenant_id: uuid.UUID):
    return or_(RoleModel.tenant_id.is_(None), RoleModel.tenant_id == tenant_id)


def _scope_filter(scope: Optional[uuid.UUID]):
    if scope is None:
        return RolePermissionOverrideModel.tenant_id.is_(None)
    return RolePermissionOverrideModel.tenant_id == scope


class SqlAlchemyRoleRepository(IRoleRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def list_roles(self, tenant_id: uuid.UUID) -> List[Role]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(RoleModel)
                .where(_visibility_clause(tenant_id))
                .order_by(RoleModel.is_system.desc(), RoleModel.id)
            )
            roles = res.scalars().all()
            role_ids = [r.id for r in roles]
            perms_by_role, overrides = await self._permissions_map(session, role_ids, tenant_id)
            return [
                Role(
                    id=r.id,
                    name=r.name,
                    description=r.description,
                    is_system=r.is_system,
                    tenant_id=r.tenant_id,
                    permissions=perms_by_role.get(r.id, []),
                    has_override=r.id in overrides,
                )
                for r in roles
            ]

    async def find_role(self, role_id: str, tenant_id: uuid.UUID) -> Optional[Role]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(RoleModel).where(
                    RoleModel.id == role_id.strip().upper(), _visibility_clause(tenant_id)
                )
            )
            r = res.scalar_one_or_none()
            if not r:
                return None
            perms_by_role, overrides = await self._permissions_map(session, [r.id], tenant_id)
            return Role(
                id=r.id,
                name=r.name,
                description=r.description,
                is_system=r.is_system,
                tenant_id=r.tenant_id,
                permissions=perms_by_role.get(r.id, []),
                has_override=r.id in overrides,
            )

    async def find_role_owned(self, role_id: str, tenant_id: uuid.UUID) -> Optional[Role]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(RoleModel).where(
                    RoleModel.id == role_id.strip().upper(), RoleModel.tenant_id == tenant_id
                )
            )
            r = res.scalar_one_or_none()
            if not r:
                return None
            perms_by_role, _ = await self._permissions_map(session, [r.id], tenant_id)
            return Role(
                id=r.id,
                name=r.name,
                description=r.description,
                is_system=r.is_system,
                tenant_id=r.tenant_id,
                permissions=perms_by_role.get(r.id, []),
            )

    async def list_permissions(self) -> List[Permission]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(PermissionModel).order_by(PermissionModel.module, PermissionModel.id)
            )
            return [
                Permission(id=p.id, module=p.module, name=p.name, description=p.description)
                for p in res.scalars().all()
            ]

    async def list_role_ids(self, tenant_id: uuid.UUID) -> List[str]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(select(RoleModel.id).where(_visibility_clause(tenant_id)))
            return sorted(res.scalars().all())

    async def save_role(self, role: Role, permission_ids: List[str]) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            session.add(
                RoleModel(
                    id=role.id,
                    name=role.name,
                    description=role.description,
                    is_system=False,
                    tenant_id=role.tenant_id,
                )
            )
            for perm_id in dict.fromkeys(p.strip() for p in permission_ids if p.strip()):
                session.add(RolePermissionModel(role_id=role.id, permission_id=perm_id))
            if owns_session:
                await session.commit()

    async def update_role(self, role_id: str, name: str, description: Optional[str]) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            res = await session.execute(select(RoleModel).where(RoleModel.id == role_id))
            r = res.scalar_one()
            r.name = name
            r.description = description
            await session.flush()
            if owns_session:
                await session.commit()

    async def replace_role_permissions(
        self,
        role_id: str,
        permission_ids: List[str],
        tenant_id: uuid.UUID,
        scope: Optional[uuid.UUID] = None,
    ) -> None:
        """Substitui as permissões do perfil no âmbito indicado.

        Perfil personalizado da empresa -> grava nas permissões do próprio perfil.
        Perfil de Sistema -> grava um override no âmbito da empresa (scope = tenant_id)
        ou no âmbito global (scope = None, definido pelo SYSADMIN).
        """
        normalized = role_id.strip().upper()
        clean = list(dict.fromkeys(p.strip() for p in permission_ids if p.strip()))
        async with session_scope(self._session_factory) as (session, owns_session):
            res = await session.execute(select(RoleModel).where(RoleModel.id == normalized))
            role = res.scalar_one_or_none()
            if role is not None and role.tenant_id is None:
                existing = await session.execute(
                    select(RolePermissionOverrideModel).where(
                        _scope_filter(scope),
                        RolePermissionOverrideModel.role_id == normalized,
                    )
                )
                override = existing.scalar_one_or_none()
                if override is None:
                    session.add(
                        RolePermissionOverrideModel(
                            tenant_id=scope, role_id=normalized, permissions=clean
                        )
                    )
                else:
                    override.permissions = clean
                    override.updated_at = datetime.now(timezone.utc)
            else:
                await session.execute(
                    delete(RolePermissionModel).where(RolePermissionModel.role_id == normalized)
                )
                for perm_id in clean:
                    session.add(RolePermissionModel(role_id=normalized, permission_id=perm_id))
            if owns_session:
                await session.commit()

    async def reset_role_permissions(
        self, role_id: str, tenant_id: uuid.UUID, include_global: bool = False
    ) -> None:
        """Remove as personalizações do perfil, repondo as permissões predefinidas do ERP."""
        normalized = role_id.strip().upper()
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(
                delete(RolePermissionOverrideModel).where(
                    RolePermissionOverrideModel.tenant_id == tenant_id,
                    RolePermissionOverrideModel.role_id == normalized,
                )
            )
            if include_global:
                await session.execute(
                    delete(RolePermissionOverrideModel).where(
                        RolePermissionOverrideModel.tenant_id.is_(None),
                        RolePermissionOverrideModel.role_id == normalized,
                    )
                )
            if owns_session:
                await session.commit()

    async def role_override_scope(self, role_id: str, tenant_id: uuid.UUID) -> Optional[str]:
        normalized = role_id.strip().upper()
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(RolePermissionOverrideModel.tenant_id).where(
                    RolePermissionOverrideModel.role_id == normalized,
                    or_(
                        RolePermissionOverrideModel.tenant_id == tenant_id,
                        RolePermissionOverrideModel.tenant_id.is_(None),
                    ),
                )
            )
            rows = res.all()
            if any(row[0] == tenant_id for row in rows):
                return "tenant"
            if rows:
                return "global"
            return None

    async def delete_role(self, role_id: str) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(delete(RolePermissionModel).where(RolePermissionModel.role_id == role_id))
            await session.execute(
                delete(RolePermissionOverrideModel).where(
                    RolePermissionOverrideModel.role_id == role_id
                )
            )
            await session.execute(delete(RoleModel).where(RoleModel.id == role_id))
            if owns_session:
                await session.commit()

    async def count_role_assignments(self, role_id: str, tenant_id: Optional[uuid.UUID] = None) -> int:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(func.count()).select_from(UserRoleModel).where(UserRoleModel.role_id == role_id)
            if tenant_id is not None:
                stmt = stmt.where(UserRoleModel.tenant_id == tenant_id)
            res = await session.execute(stmt)
            return int(res.scalar_one())

    @staticmethod
    async def _permissions_map(
        session: AsyncSession, role_ids: List[str], tenant_id: uuid.UUID
    ) -> Tuple[Dict[str, List[Permission]], Set[str]]:
        """Permissões efectivas por perfil no tenant.

        Hierarquia: override da empresa > override global > predefinições do ERP.
        Devolve também o conjunto de perfis com personalização activa.
        """
        if not role_ids:
            return {}, set()
        normalized_ids = [r.strip().upper() for r in role_ids]

        override_rows = await session.execute(
            select(
                RolePermissionOverrideModel.tenant_id,
                RolePermissionOverrideModel.role_id,
                RolePermissionOverrideModel.permissions,
            ).where(RolePermissionOverrideModel.role_id.in_(normalized_ids))
        )
        tenant_overrides: Dict[str, Set[str]] = {}
        global_overrides: Dict[str, Set[str]] = {}
        for row_tenant_id, role_id, permissions in override_rows.all():
            if row_tenant_id == tenant_id:
                tenant_overrides[role_id] = set(permissions)
            elif row_tenant_id is None:
                global_overrides[role_id] = set(permissions)

        default_rows = await session.execute(
            select(RolePermissionModel.role_id, RolePermissionModel.permission_id).where(
                RolePermissionModel.role_id.in_(normalized_ids)
            )
        )
        defaults: Dict[str, Set[str]] = {}
        for role_id, permission_id in default_rows.all():
            defaults.setdefault(role_id, set()).add(permission_id)

        effective_ids: Set[str] = set()
        for role_id in normalized_ids:
            effective_ids |= _effective_permission_ids(
                role_id, tenant_overrides, global_overrides, defaults
            )

        permissions_by_id: Dict[str, Permission] = {}
        if effective_ids:
            perm_rows = await session.execute(
                select(PermissionModel).where(PermissionModel.id.in_(effective_ids))
            )
            for p in perm_rows.scalars().all():
                permissions_by_id[p.id] = Permission(
                    id=p.id, module=p.module, name=p.name, description=p.description
                )

        mapping: Dict[str, List[Permission]] = {}
        overridden: Set[str] = set()
        for role_id in normalized_ids:
            selected_ids = _effective_permission_ids(
                role_id, tenant_overrides, global_overrides, defaults
            )
            if selected_ids != defaults.get(role_id, set()):
                overridden.add(role_id)
            selected = [permissions_by_id[i] for i in selected_ids if i in permissions_by_id]
            selected.sort(key=lambda p: (p.module, p.id))
            mapping[role_id] = selected
        return mapping, overridden


def _effective_permission_ids(
    role_id: str,
    tenant_overrides: Dict[str, Set[str]],
    global_overrides: Dict[str, Set[str]],
    defaults: Dict[str, Set[str]],
) -> Set[str]:
    if role_id in tenant_overrides:
        return set(tenant_overrides[role_id])
    if role_id in global_overrides:
        return set(global_overrides[role_id])
    return set(defaults.get(role_id, set()))
