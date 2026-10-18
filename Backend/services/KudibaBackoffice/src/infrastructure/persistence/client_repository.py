import uuid
from typing import List, Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities import Client
from src.domain.ports import IClientRepository
from src.infrastructure.persistence import session_scope
from src.infrastructure.persistence.models import ClientModel


class SqlAlchemyClientRepository(IClientRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_by_id(self, client_id: uuid.UUID) -> Optional[Client]:
        async with session_scope(self._session_factory) as (session, _):
            m = await session.get(ClientModel, client_id)
            return self._to_entity(m) if m else None

    async def find_by_nif(self, nif: str) -> Optional[Client]:
        async with session_scope(self._session_factory) as (session, _):
            res = await session.execute(select(ClientModel).where(ClientModel.nif == nif))
            m = res.scalar_one_or_none()
            return self._to_entity(m) if m else None

    async def list_all(self, search: Optional[str] = None) -> List[Client]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(ClientModel).order_by(ClientModel.company_name)
            if search:
                term = f"%{search.strip()}%"
                stmt = stmt.where(
                    or_(
                        ClientModel.company_name.ilike(term),
                        ClientModel.nif.ilike(term),
                        ClientModel.contact_email.ilike(term),
                    )
                )
            res = await session.execute(stmt)
            return [self._to_entity(m) for m in res.scalars().all()]

    async def save(self, client: Client) -> None:
        async with session_scope(self._session_factory) as (session, _):
            session.add(self._to_model(client))

    async def update(self, client: Client) -> None:
        async with session_scope(self._session_factory) as (session, _):
            m = await session.get(ClientModel, client.id)
            if m is None:
                return
            m.company_name = client.company_name
            m.contact_name = client.contact_name
            m.contact_email = client.contact_email
            m.contact_phone = client.contact_phone
            m.notes = client.notes

    @staticmethod
    def _to_entity(m: ClientModel) -> Client:
        return Client(
            id=m.id,
            tenant_id=m.tenant_id,
            company_name=m.company_name,
            nif=m.nif,
            contact_name=m.contact_name,
            contact_email=m.contact_email,
            contact_phone=m.contact_phone,
            notes=m.notes,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _to_model(client: Client) -> ClientModel:
        return ClientModel(
            id=client.id,
            tenant_id=client.tenant_id,
            company_name=client.company_name,
            nif=client.nif,
            contact_name=client.contact_name,
            contact_email=client.contact_email,
            contact_phone=client.contact_phone,
            notes=client.notes,
            created_at=client.created_at,
            updated_at=client.updated_at,
        )
