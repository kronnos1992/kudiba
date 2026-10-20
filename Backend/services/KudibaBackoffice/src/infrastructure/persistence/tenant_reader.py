from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities import TenantRecord
from src.domain.ports import ITenantReader
from src.infrastructure.persistence import session_scope
from src.infrastructure.persistence.auth_models import TenantModel


class SqlAlchemyTenantReader(ITenantReader):
    def __init__(self, auth_session_factory: async_sessionmaker[AsyncSession]):
        self._auth_session_factory = auth_session_factory

    async def list_tenants(self) -> List[TenantRecord]:
        async with session_scope(self._auth_session_factory) as (session, _):
            res = await session.execute(
                select(TenantModel).order_by(TenantModel.created_at)
            )
            return [
                TenantRecord(
                    id=t.id,
                    slug=t.slug,
                    company_name=t.company_name,
                    nif=t.nif,
                    status=t.status,
                    email=t.email,
                    phone=t.phone,
                    license_valid_until=t.license_valid_until,
                    subscribed_modules=list(t.subscribed_modules) if t.subscribed_modules else None,
                    created_at=t.created_at,
                )
                for t in res.scalars().all()
            ]
