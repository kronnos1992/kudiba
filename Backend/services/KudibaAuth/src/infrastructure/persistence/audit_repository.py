import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.ports.audit_repository import IAuditRepository
from src.infrastructure.persistence.models import AuthAuditLogModel
from src.infrastructure.persistence.unit_of_work import session_scope


class SqlAlchemyAuditRepository(IAuditRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def record_event(
        self,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        tenant_id: Optional[uuid.UUID] = None,
        email_attempted: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            log = AuthAuditLogModel(
                user_id=user_id,
                tenant_id=tenant_id,
                action=action,
                email_attempted=email_attempted,
                ip_address=ip_address,
                user_agent=user_agent,
                details=details or {},
            )
            session.add(log)
            if owns_session:
                await session.commit()
