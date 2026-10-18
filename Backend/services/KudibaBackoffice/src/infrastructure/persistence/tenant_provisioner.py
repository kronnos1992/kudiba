import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.ports import ITenantProvisioner
from src.infrastructure.persistence import session_scope
from src.infrastructure.persistence.auth_models import (
    BranchModel,
    TenantModel,
    UserModel,
    UserRoleModel,
    UserTenantModel,
)


class SqlAlchemyTenantProvisioner(ITenantProvisioner):
    def __init__(self, auth_session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = auth_session_factory

    async def slug_exists(self, slug: str) -> bool:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(TenantModel.id).where(TenantModel.slug == slug).limit(1)
            )
            return res.scalar_one_or_none() is not None

    async def nif_exists(self, nif: str) -> bool:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(TenantModel.id).where(TenantModel.nif == nif).limit(1)
            )
            return res.scalar_one_or_none() is not None

    async def email_exists(self, email: str) -> bool:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(UserModel.id).where(UserModel.email == email).limit(1)
            )
            return res.scalar_one_or_none() is not None

    async def provision_client_tenant(
        self,
        *,
        tenant_id: uuid.UUID,
        slug: str,
        company_name: str,
        nif: str,
        license_valid_until: datetime,
        modules: List[str],
        admin_email: Optional[str] = None,
        admin_full_name: Optional[str] = None,
        admin_password_hash: Optional[str] = None,
    ) -> uuid.UUID:
        branch_id = uuid.uuid4()
        async with session_scope(self._session_factory) as (session, _):
            session.add(
                TenantModel(
                    id=tenant_id,
                    slug=slug,
                    company_name=company_name,
                    nif=nif,
                    status="ACTIVE",
                    license_valid_until=license_valid_until,
                    subscribed_modules=modules,
                )
            )
            await session.flush()
            session.add(
                BranchModel(
                    id=branch_id,
                    tenant_id=tenant_id,
                    code="SEDE",
                    name="Sede",
                    is_active=True,
                )
            )
            if admin_email and admin_full_name and admin_password_hash:
                user_id = uuid.uuid4()
                session.add(
                    UserModel(
                        id=user_id,
                        email=admin_email,
                        full_name=admin_full_name,
                        password_hash=admin_password_hash,
                        is_active=True,
                        is_superadmin=False,
                    )
                )
                await session.flush()
                session.add(
                    UserTenantModel(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        tenant_id=tenant_id,
                        default_branch_id=branch_id,
                        status="ACTIVE",
                    )
                )
                await session.flush()
                session.add(
                    UserRoleModel(user_id=user_id, tenant_id=tenant_id, role_id="ADMIN")
                )
        return branch_id

    async def update_license_mirror(
        self,
        tenant_id: uuid.UUID,
        *,
        license_valid_until: Optional[datetime] = None,
        modules: Optional[List[str]] = None,
        status: Optional[str] = None,
    ) -> None:
        async with session_scope(self._session_factory) as (session, _):
            tenant = await session.get(TenantModel, tenant_id)
            if tenant is None:
                return
            if license_valid_until is not None:
                tenant.license_valid_until = license_valid_until
            if modules is not None:
                tenant.subscribed_modules = modules
            if status is not None:
                tenant.status = status

    async def delete_tenant(self, tenant_id: uuid.UUID) -> None:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(UserTenantModel.user_id).where(UserTenantModel.tenant_id == tenant_id)
            )
            user_ids = [row[0] for row in res.all()]
            await session.execute(
                delete(UserRoleModel).where(UserRoleModel.tenant_id == tenant_id)
            )
            await session.execute(
                delete(UserTenantModel).where(UserTenantModel.tenant_id == tenant_id)
            )
            if user_ids:
                await session.execute(delete(UserModel).where(UserModel.id.in_(user_ids)))
            await session.execute(
                delete(BranchModel).where(BranchModel.tenant_id == tenant_id)
            )
            await session.execute(
                delete(TenantModel).where(TenantModel.id == tenant_id)
            )

    async def is_platform_admin(self, user_id: uuid.UUID) -> bool:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(
                select(UserModel.is_active, UserModel.is_superadmin).where(
                    UserModel.id == user_id
                )
            )
            row = res.first()
            if row is None:
                return False
            is_active, is_superadmin = row
            return bool(is_active and is_superadmin)
