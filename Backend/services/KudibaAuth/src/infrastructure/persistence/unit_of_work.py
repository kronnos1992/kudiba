from contextvars import ContextVar, Token
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.ports.unit_of_work import IUnitOfWork, IUnitOfWorkFactory


_current_session: ContextVar[Optional[AsyncSession]] = ContextVar("auth_db_session", default=None)


@asynccontextmanager
async def session_scope(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[Tuple[AsyncSession, bool]]:
    session = _current_session.get()
    if session is not None:
        yield session, False
        return

    async with session_factory() as session:
        yield session, True


class SqlAlchemyUnitOfWork(IUnitOfWork):
    """Implementação concreta de IUnitOfWork usando SQLAlchemy 2.0 AsyncSession."""
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory
        self.session: Optional[AsyncSession] = None
        self._session_token: Optional[Token] = None

    async def commit(self) -> None:
        if self.session:
            await self.session.commit()

    async def rollback(self) -> None:
        if self.session:
            await self.session.rollback()

    async def __aenter__(self) -> "SqlAlchemyUnitOfWork":
        if _current_session.get() is not None:
            raise RuntimeError("Nested authentication database transactions are not supported.")
        self.session = self._session_factory()
        self._session_token = _current_session.set(self.session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.session:
            try:
                if exc_type is not None:
                    await self.rollback()
                else:
                    await self.commit()
            finally:
                if self._session_token is not None:
                    _current_session.reset(self._session_token)
                    self._session_token = None
                await self.session.close()
                self.session = None


class SqlAlchemyUnitOfWorkFactory(IUnitOfWorkFactory):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    def begin(self) -> IUnitOfWork:
        return SqlAlchemyUnitOfWork(self._session_factory)
