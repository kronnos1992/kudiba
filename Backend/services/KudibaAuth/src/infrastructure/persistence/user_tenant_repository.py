import uuid
from typing import List, Optional, Tuple
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.user_tenant import UserTenant
from src.domain.ports.user_tenant_repository import IUserTenantRepository
from src.infrastructure.persistence.models import (
    RolePermissionModel,
    TenantModel,
    UserModel,
    UserRoleModel,
    UserTenantModel,
)
from src.infrastructure.persistence.unit_of_work import session_scope


class SqlAlchemyUserTenantRepository(IUserTenantRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_membership(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[UserTenant]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(UserTenantModel).where(
                UserTenantModel.user_id == user_id, UserTenantModel.tenant_id == tenant_id
            )
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._to_entity(m) if m else None

    async def find_user_memberships(self, user_id: uuid.UUID) -> List[UserTenant]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(UserTenantModel).where(UserTenantModel.user_id == user_id)
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._to_entity(m) for m in models]

    async def find_tenant_members(self, tenant_id: uuid.UUID) -> List[Tuple[UserTenant, str, str]]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(UserTenantModel, UserModel.email, UserModel.full_name)
                .join(UserModel, UserTenantModel.user_id == UserModel.id)
                .where(UserTenantModel.tenant_id == tenant_id)
            )
            res = await session.execute(stmt)
            rows = res.all()
            return [(self._to_entity(m), email, name) for m, email, name in rows]

    async def save_membership(self, membership: UserTenant) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            m = UserTenantModel(
                id=membership.id,
                user_id=membership.user_id,
                tenant_id=membership.tenant_id,
                default_branch_id=membership.default_branch_id,
                status=membership.status,
            )
            session.add(m)
            if owns_session:
                await session.commit()

    async def get_user_roles_in_tenant(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> List[str]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(UserRoleModel.role_id).where(
                UserRoleModel.user_id == user_id, UserRoleModel.tenant_id == tenant_id
            )
            res = await session.execute(stmt)
            return sorted(list(res.scalars().all()))

    async def get_roles_permissions(self, role_ids: List[str]) -> List[str]:
        if not role_ids:
            return []
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(RolePermissionModel.permission_id)
                .where(RolePermissionModel.role_id.in_([r.upper() for r in role_ids]))
                .distinct()
            )
            res = await session.execute(stmt)
            return sorted(list(res.scalars().all()))

    async def assign_roles(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: List[str]) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            normalized_roles = dict.fromkeys(r.strip().upper() for r in roles if r.strip())
            for role_id in normalized_roles:
                ur = UserRoleModel(user_id=user_id, tenant_id=tenant_id, role_id=role_id)
                session.add(ur)
            if owns_session:
                await session.commit()

    async def update_roles(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: List[str]) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(
                delete(UserRoleModel).where(
                    UserRoleModel.user_id == user_id, UserRoleModel.tenant_id == tenant_id
                )
            )
            normalized_roles = dict.fromkeys(r.strip().upper() for r in roles if r.strip())
            for role_id in normalized_roles:
                ur = UserRoleModel(user_id=user_id, tenant_id=tenant_id, role_id=role_id)
                session.add(ur)
            if owns_session:
                await session.commit()

    async def lock_tenant_role_updates(self, tenant_id: uuid.UUID) -> None:
        async with session_scope(self._session_factory) as (session, _):
            await session.execute(
                select(TenantModel.id)
                .where(TenantModel.id == tenant_id)
                .with_for_update()
            )

    async def count_active_admins(self, tenant_id: uuid.UUID) -> int:
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(func.count())
                .select_from(UserRoleModel)
                .join(
                    UserTenantModel,
                    (UserTenantModel.user_id == UserRoleModel.user_id)
                    & (UserTenantModel.tenant_id == UserRoleModel.tenant_id),
                )
                .join(UserModel, UserModel.id == UserRoleModel.user_id)
                .where(
                    UserRoleModel.tenant_id == tenant_id,
                    UserRoleModel.role_id == "ADMIN",
                    UserTenantModel.status == "ACTIVE",
                    UserModel.is_active.is_(True),
                )
            )
            result = await session.execute(stmt)
            return int(result.scalar_one())

    @staticmethod
    def _to_entity(m: UserTenantModel) -> UserTenant:
        return UserTenant(
            id=m.id,
            user_id=m.user_id,
            tenant_id=m.tenant_id,
            status=m.status,
            default_branch_id=m.default_branch_id,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
