import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.branch import Branch
from src.domain.entities.tenant import Tenant
from src.domain.ports.tenant_repository import ITenantRepository
from src.infrastructure.persistence.models import BranchModel, TenantModel
from src.infrastructure.persistence.unit_of_work import session_scope


class SqlAlchemyTenantRepository(ITenantRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantModel).where(TenantModel.id == tenant_id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._tenant_to_entity(m) if m else None

    async def find_by_slug(self, slug: str) -> Optional[Tenant]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantModel).where(TenantModel.slug == slug.strip().lower())
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._tenant_to_entity(m) if m else None

    async def find_branches(self, tenant_id: uuid.UUID) -> List[Branch]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(BranchModel).where(BranchModel.tenant_id == tenant_id)
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._branch_to_entity(m) for m in models]

    async def find_branch_by_id(self, branch_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[Branch]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(BranchModel).where(BranchModel.id == branch_id, BranchModel.tenant_id == tenant_id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._branch_to_entity(m) if m else None

    async def save_branch(self, branch: Branch) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            m = BranchModel(
                id=branch.id,
                tenant_id=branch.tenant_id,
                code=branch.code,
                name=branch.name,
                city=branch.city,
                address_detail=branch.address_detail,
                is_active=branch.is_active,
            )
            session.add(m)
            if owns_session:
                await session.commit()

    @staticmethod
    def _tenant_to_entity(m: TenantModel) -> Tenant:
        return Tenant(
            id=m.id,
            slug=m.slug,
            company_name=m.company_name,
            nif=m.nif,
            status=m.status,
            address_detail=m.address_detail,
            city=m.city,
            country=m.country or "AO",
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _branch_to_entity(m: BranchModel) -> Branch:
        return Branch(
            id=m.id,
            tenant_id=m.tenant_id,
            code=m.code,
            name=m.name,
            city=m.city,
            address_detail=m.address_detail,
            is_active=m.is_active,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
