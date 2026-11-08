import uuid
from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.domain.entities import TenantRecord
from src.domain.ports import ITenantReader
from src.infrastructure.persistence import session_scope
from src.infrastructure.persistence.auth_models import TenantBackupModel, TenantModel


class SqlAlchemyTenantReader(ITenantReader):
    def __init__(self, auth_session_factory: async_sessionmaker[AsyncSession]):
        self._auth_session_factory = auth_session_factory

    async def list_tenants(self) -> List[TenantRecord]:
        async with session_scope(self._auth_session_factory) as (session, _):
            res = await session.execute(
                select(TenantModel).order_by(TenantModel.created_at)
            )
            return [
                TenantRecord(
                    id=t.id,
                    slug=t.slug,
                    company_name=t.company_name,
                    nif=t.nif,
                    status=t.status,
                    alvara_number=t.alvara_number,
                    alvara_issue_date=t.alvara_issue_date,
                    alvara_expiry_date=t.alvara_expiry_date,
                    email=t.email,
                    phone=t.phone,
                    license_valid_until=t.license_valid_until,
                    subscribed_modules=list(t.subscribed_modules) if t.subscribed_modules else None,
                    created_at=t.created_at,
                )
                for t in res.scalars().all()
            ]

    async def list_tenant_backups(
        self, tenant_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> dict:
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        async with session_scope(self._auth_session_factory) as (session, _):
            stmt = (
                select(TenantBackupModel)
                .where(TenantBackupModel.tenant_id == tenant_id)
                .order_by(TenantBackupModel.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            count_stmt = select(func.count(TenantBackupModel.id)).where(
                TenantBackupModel.tenant_id == tenant_id
            )
            records = (await session.execute(stmt)).scalars().all()
            total = int((await session.execute(count_stmt)).scalar() or 0)
            items = [
                {
                    "id": str(r.id),
                    "tenant_id": str(r.tenant_id),
                    "requested_by": str(r.requested_by) if r.requested_by else None,
                    "trigger": r.trigger,
                    "status": r.status,
                    "file_name": r.file_name,
                    "size_bytes": r.size_bytes,
                    "sha256": r.sha256,
                    "encryption": r.encryption,
                    "error": r.error,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                }
                for r in records
            ]
            return {"items": items, "total": total, "limit": limit, "offset": offset}
