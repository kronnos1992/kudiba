import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.refresh_token import RefreshToken
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.infrastructure.persistence.models import RefreshTokenModel
from src.infrastructure.persistence.unit_of_work import session_scope


class SqlAlchemyRefreshTokenRepository(IRefreshTokenRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._to_entity(m) if m else None

    async def save(self, token: RefreshToken) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            m = RefreshTokenModel(
                id=token.id,
                user_id=token.user_id,
                tenant_id=token.tenant_id,
                token_hash=token.token_hash,
                family_id=token.family_id,
                is_revoked=token.is_revoked,
                user_agent=token.user_agent,
                ip_address=token.ip_address,
                expires_at=token.expires_at,
            )
            session.add(m)
            if owns_session:
                await session.commit()

    async def revoke_family(self, family_id: uuid.UUID) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(
                update(RefreshTokenModel)
                .where(RefreshTokenModel.family_id == family_id)
                .values(is_revoked=True)
            )
            if owns_session:
                await session.commit()

    async def revoke_token(self, token_hash: str) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            await session.execute(
                update(RefreshTokenModel)
                .where(RefreshTokenModel.token_hash == token_hash)
                .values(is_revoked=True)
            )
            if owns_session:
                await session.commit()

    async def revoke_user_tenant_tokens(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> int:
        async with session_scope(self._session_factory) as (session, owns_session):
            result = await session.execute(
                update(RefreshTokenModel)
                .where(
                    RefreshTokenModel.user_id == user_id,
                    RefreshTokenModel.tenant_id == tenant_id,
                    RefreshTokenModel.is_revoked.is_(False),
                )
                .values(is_revoked=True)
            )
            if owns_session:
                await session.commit()
            return result.rowcount or 0

    async def replace_active_token(
        self,
        token_hash: str,
        replacement: RefreshToken,
        now: datetime,
    ) -> bool:
        async with session_scope(self._session_factory) as (session, owns_session):
            result = await session.execute(
                update(RefreshTokenModel)
                .where(
                    RefreshTokenModel.token_hash == token_hash,
                    RefreshTokenModel.is_revoked.is_(False),
                    RefreshTokenModel.expires_at > now,
                )
                .values(is_revoked=True)
                .returning(RefreshTokenModel.id)
            )
            consumed_id = result.scalar_one_or_none()
            if consumed_id is None:
                return False

            session.add(
                RefreshTokenModel(
                    id=replacement.id,
                    user_id=replacement.user_id,
                    tenant_id=replacement.tenant_id,
                    token_hash=replacement.token_hash,
                    family_id=replacement.family_id,
                    is_revoked=replacement.is_revoked,
                    user_agent=replacement.user_agent,
                    ip_address=replacement.ip_address,
                    expires_at=replacement.expires_at,
                )
            )
            if owns_session:
                await session.commit()
            return True

    @staticmethod
    def _to_entity(m: RefreshTokenModel) -> RefreshToken:
        return RefreshToken(
            id=m.id,
            user_id=m.user_id,
            tenant_id=m.tenant_id,
            token_hash=m.token_hash,
            family_id=m.family_id,
            expires_at=m.expires_at,
            is_revoked=m.is_revoked,
            user_agent=m.user_agent,
            ip_address=str(m.ip_address) if m.ip_address else None,
            created_at=m.created_at,
        )
