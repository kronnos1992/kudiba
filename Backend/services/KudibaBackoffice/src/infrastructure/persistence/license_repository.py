import uuid
from typing import Dict, List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities import License
from src.domain.ports import ILicenseRepository
from src.infrastructure.persistence import session_scope
from src.infrastructure.persistence.models import LicenseModel


class SqlAlchemyLicenseRepository(ILicenseRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_by_id(self, license_id: uuid.UUID) -> Optional[License]:
        async with session_scope(self._session_factory) as (session, _):
            m = await session.get(LicenseModel, license_id)
            return self._to_entity(m) if m else None

    async def find_current_for_client(self, client_id: uuid.UUID) -> Optional[License]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(LicenseModel)
                .where(
                    LicenseModel.client_id == client_id,
                    LicenseModel.status != "CANCELLED",
                )
                .order_by(LicenseModel.valid_until.desc())
                .limit(1)
            )
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._to_entity(m) if m else None

    async def find_current_map(self, client_ids: Sequence[uuid.UUID]) -> Dict[uuid.UUID, License]:
        if not client_ids:
            return {}
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(LicenseModel)
                .where(
                    LicenseModel.client_id.in_(list(client_ids)),
                    LicenseModel.status != "CANCELLED",
                )
                .order_by(LicenseModel.valid_until.desc())
            )
            res = await session.execute(stmt)
            current: Dict[uuid.UUID, License] = {}
            for m in res.scalars().all():
                if m.client_id not in current:
                    current[m.client_id] = self._to_entity(m)
            return current

    async def list_for_client(self, client_id: uuid.UUID) -> List[License]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(LicenseModel)
                .where(LicenseModel.client_id == client_id)
                .order_by(LicenseModel.valid_until.desc())
            )
            res = await session.execute(stmt)
            return [self._to_entity(m) for m in res.scalars().all()]

    async def save(self, license: License) -> None:
        async with session_scope(self._session_factory) as (session, _):
            session.add(self._to_model(license))

    async def update(self, license: License) -> None:
        async with session_scope(self._session_factory) as (session, _):
            m = await session.get(LicenseModel, license.id)
            if m is None:
                return
            m.status = license.status
            m.plan = license.plan
            m.seats = license.seats
            m.modules = license.modules
            m.notes = license.notes

    @staticmethod
    def _to_entity(m: LicenseModel) -> License:
        return License(
            id=m.id,
            client_id=m.client_id,
            license_key=m.license_key,
            plan=m.plan,
            seats=m.seats,
            modules=list(m.modules),
            valid_from=m.valid_from,
            valid_until=m.valid_until,
            status=m.status,
            notes=m.notes,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _to_model(license: License) -> LicenseModel:
        return LicenseModel(
            id=license.id,
            client_id=license.client_id,
            license_key=license.license_key,
            plan=license.plan,
            seats=license.seats,
            modules=license.modules,
            valid_from=license.valid_from,
            valid_until=license.valid_until,
            status=license.status,
            notes=license.notes,
            created_at=license.created_at,
            updated_at=license.updated_at,
        )
