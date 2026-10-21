import uuid
from typing import Optional
from sqlalchemy import select
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

    async def list_events(
        self,
        tenant_id: uuid.UUID,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        limit = max(1, min(limit, 500))
        offset = max(0, offset)
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(AuthAuditLogModel)
                .where(AuthAuditLogModel.tenant_id == tenant_id)
                .order_by(AuthAuditLogModel.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            result = await session.execute(stmt)
            logs = result.scalars().all()
            return [
                {
                    "id": str(log.id),
                    "user_id": str(log.user_id) if log.user_id else None,
                    "tenant_id": str(log.tenant_id) if log.tenant_id else None,
                    "action": log.action,
                    "email_attempted": log.email_attempted,
                    "ip_address": str(log.ip_address) if log.ip_address else None,
                    "user_agent": log.user_agent,
                    "details": log.details or {},
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ]
