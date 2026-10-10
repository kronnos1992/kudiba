import uuid
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.user import User
from src.domain.ports.user_repository import IUserRepository
from src.domain.value_objects.email import Email
from src.infrastructure.persistence.models import UserModel
from src.infrastructure.persistence.unit_of_work import session_scope


class SqlAlchemyUserRepository(IUserRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(UserModel).where(UserModel.id == user_id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._to_entity(m) if m else None

    async def find_by_email(self, email: str) -> Optional[User]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(UserModel).where(UserModel.email == email.strip().lower())
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._to_entity(m) if m else None

    async def save(self, user: User) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            m = UserModel(
                id=user.id,
                email=user.email.value,
                phone_number=user.phone_number,
                full_name=user.full_name,
                password_hash=user.password_hash,
                is_active=user.is_active,
                is_superadmin=user.is_superadmin,
                failed_login_attempts=user.failed_login_attempts,
                locked_until=user.locked_until,
            )
            session.add(m)
            if owns_session:
                await session.commit()

    async def update_login_state(self, user: User) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            stmt = (
                update(UserModel)
                .where(UserModel.id == user.id)
                .values(
                    failed_login_attempts=user.failed_login_attempts,
                    locked_until=user.locked_until,
                )
            )
            await session.execute(stmt)
            if owns_session:
                await session.commit()

    @staticmethod
    def _to_entity(m: UserModel) -> User:
        return User(
            id=m.id,
            email=Email(m.email),
            full_name=m.full_name,
            password_hash=m.password_hash,
            is_active=m.is_active,
            is_superadmin=m.is_superadmin,
            failed_login_attempts=m.failed_login_attempts,
            locked_until=m.locked_until,
            phone_number=m.phone_number,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
