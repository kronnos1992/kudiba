import uuid
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.ports.audit_repository import IAuditRepository
from src.infrastructure.persistence.models import AuthAuditLogModel, SystemAuditTrailModel
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

    async def count_events(self, tenant_id: uuid.UUID) -> int:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(func.count(AuthAuditLogModel.id)).where(AuthAuditLogModel.tenant_id == tenant_id)
            result = await session.execute(stmt)
            return int(result.scalar() or 0)

    async def record_system_event(
        self,
        tenant_id: uuid.UUID,
        module: str,
        action: str,
        entity_type: str,
        entity_id: str,
        document_reference: Optional[str] = None,
        actor_user_id: Optional[str] = None,
        actor_name: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[dict] = None,
    ) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            trail = SystemAuditTrailModel(
                tenant_id=tenant_id,
                module=module,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                document_reference=document_reference,
                actor_user_id=actor_user_id,
                actor_name=actor_name,
                ip_address=ip_address,
                details=details or {},
            )
            session.add(trail)
            if owns_session:
                await session.commit()

    async def list_system_events(
        self,
        tenant_id: uuid.UUID,
        module: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict]:
        limit = max(1, min(limit, 500))
        offset = max(0, offset)
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(SystemAuditTrailModel)
                .where(SystemAuditTrailModel.tenant_id == tenant_id)
            )
            if module:
                stmt = stmt.where(SystemAuditTrailModel.module == module)
            if action:
                stmt = stmt.where(SystemAuditTrailModel.action == action)
            stmt = stmt.order_by(SystemAuditTrailModel.created_at.desc()).limit(limit).offset(offset)
            result = await session.execute(stmt)
            trails = result.scalars().all()
            return [
                {
                    "id": str(trail.id),
                    "tenant_id": str(trail.tenant_id),
                    "module": trail.module,
                    "action": trail.action,
                    "entity_type": trail.entity_type,
                    "entity_id": trail.entity_id,
                    "document_reference": trail.document_reference,
                    "actor_user_id": trail.actor_user_id,
                    "actor_name": trail.actor_name,
                    "ip_address": str(trail.ip_address) if trail.ip_address else None,
                    "details": trail.details or {},
                    "created_at": trail.created_at.isoformat() if trail.created_at else None,
                }
                for trail in trails
            ]

    async def count_system_events(
        self,
        tenant_id: uuid.UUID,
        module: Optional[str] = None,
        action: Optional[str] = None,
    ) -> int:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(func.count(SystemAuditTrailModel.id)).where(SystemAuditTrailModel.tenant_id == tenant_id)
            if module:
                stmt = stmt.where(SystemAuditTrailModel.module == module)
            if action:
                stmt = stmt.where(SystemAuditTrailModel.action == action)
            result = await session.execute(stmt)
            return int(result.scalar() or 0)

