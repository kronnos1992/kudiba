import uuid
from typing import List, Optional

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities.role import Permission, Role
from src.domain.ports.role_repository import IRoleRepository
from src.infrastructure.persistence.models import (
    PermissionModel,
    RoleModel,
    RolePermissionModel,
    UserRoleModel,
)
from src.infrastructure.persistence.unit_of_work import session_scope


def _visibility_clause(tenant_id: uuid.UUID):
    return or_(RoleModel.tenant_id.is_(None), RoleModel.tenant_id == tenant_id)


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
            perms_by_role = await self._permissions_map(session, role_ids)
            return [
                Role(
                    id=r.id,
                    name=r.name,
                    description=r.description,
                    is_system=r.is_system,
                    tenant_id=r.tenant_id,
                    permissions=perms_by_role.get(r.id, []),
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
            perms_by_role = await self._permissions_map(session, [r.id])
            return Role(
                id=r.id,
                name=r.name,
                description=r.description,
                is_system=r.is_system,
                tenant_id=r.tenant_id,
                permissions=perms_by_role.get(r.id, []),
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
            perms_by_role = await self._permissions_map(session, [r.id])
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

    async def replace_role_permissions(self, role_id: str, permission_ids: List[str]) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(delete(RolePermissionModel).where(RolePermissionModel.role_id == role_id))
            for perm_id in dict.fromkeys(p.strip() for p in permission_ids if p.strip()):
                session.add(RolePermissionModel(role_id=role_id, permission_id=perm_id))
            if owns_session:
                await session.commit()

    async def delete_role(self, role_id: str) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(delete(RolePermissionModel).where(RolePermissionModel.role_id == role_id))
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
    async def _permissions_map(session: AsyncSession, role_ids: List[str]) -> dict:
        if not role_ids:
            return {}
        res = await session.execute(
            select(RolePermissionModel.role_id, PermissionModel)
            .join(PermissionModel, PermissionModel.id == RolePermissionModel.permission_id)
            .where(RolePermissionModel.role_id.in_(role_ids))
            .order_by(PermissionModel.module, PermissionModel.id)
        )
        mapping: dict = {}
        for role_id, p in res.all():
            mapping.setdefault(role_id, []).append(
                Permission(id=p.id, module=p.module, name=p.name, description=p.description)
            )
        return mapping
