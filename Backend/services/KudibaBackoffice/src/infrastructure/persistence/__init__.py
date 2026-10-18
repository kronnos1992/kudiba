from contextlib import asynccontextmanager
from typing import AsyncIterator, Tuple

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker


@asynccontextmanager
async def session_scope(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[Tuple[AsyncSession, bool]]:
    async with session_factory() as session:
        try:
            yield session, True
            await session.commit()
        except Exception:
            await session.rollback()
            raise
