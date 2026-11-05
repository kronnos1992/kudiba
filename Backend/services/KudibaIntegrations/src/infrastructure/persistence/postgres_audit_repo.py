import uuid
from typing import Optional
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.infrastructure.persistence.models import SystemAuditTrailModel


class PostgresSystemAuditRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self.session_factory = session_factory

    async def record_event(
        self,
        tenant_id: UUID,
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
        async with self.session_factory() as session:
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
            await session.commit()

    async def list_events(
        self,
        tenant_id: UUID,
        module: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        limit = max(1, min(limit, 500))
        offset = max(0, offset)
        async with self.session_factory() as session:
            stmt = select(SystemAuditTrailModel).where(SystemAuditTrailModel.tenant_id == tenant_id)
            if module:
                stmt = stmt.where(SystemAuditTrailModel.module == module)
            if action:
                stmt = stmt.where(SystemAuditTrailModel.action == action)
            stmt = stmt.order_by(SystemAuditTrailModel.created_at.desc()).limit(limit).offset(offset)
            result = await session.execute(stmt)
            trails = result.scalars().all()
            return [
                {
                    "id": str(t.id),
                    "tenant_id": str(t.tenant_id),
                    "module": t.module,
                    "action": t.action,
                    "entity_type": t.entity_type,
                    "entity_id": t.entity_id,
                    "document_reference": t.document_reference,
                    "actor_user_id": t.actor_user_id,
                    "actor_name": t.actor_name,
                    "ip_address": str(t.ip_address) if t.ip_address else None,
                    "details": t.details or {},
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in trails
            ]

    async def count_events(
        self,
        tenant_id: UUID,
        module: Optional[str] = None,
        action: Optional[str] = None,
    ) -> int:
        async with self.session_factory() as session:
            stmt = select(func.count(SystemAuditTrailModel.id)).where(SystemAuditTrailModel.tenant_id == tenant_id)
            if module:
                stmt = stmt.where(SystemAuditTrailModel.module == module)
            if action:
                stmt = stmt.where(SystemAuditTrailModel.action == action)
            result = await session.execute(stmt)
            return int(result.scalar() or 0)
