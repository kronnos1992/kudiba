import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.infrastructure.persistence.models import TenantBackupModel, TenantModel
from src.infrastructure.persistence.unit_of_work import session_scope


def _to_dict(model: TenantBackupModel) -> dict:
    return {
        "id": str(model.id),
        "tenant_id": str(model.tenant_id),
        "requested_by": str(model.requested_by) if model.requested_by else None,
        "trigger": model.trigger,
        "status": model.status,
        "file_name": model.file_name,
        "size_bytes": model.size_bytes,
        "sha256": model.sha256,
        "encryption": model.encryption,
        "error": model.error,
        "created_at": model.created_at.isoformat() if model.created_at else None,
        "completed_at": model.completed_at.isoformat() if model.completed_at else None,
    }


class SqlAlchemyTenantBackupRepository:
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def create(
        self,
        tenant_id: uuid.UUID,
        requested_by: Optional[uuid.UUID],
        trigger: str = "MANUAL",
    ) -> dict:
        async with session_scope(self._session_factory) as (session, owns_session):
            record = TenantBackupModel(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                requested_by=requested_by,
                trigger=trigger,
                status="PENDING",
            )
            session.add(record)
            await session.flush()
            result = _to_dict(record)
            if owns_session:
                await session.commit()
            return result

    async def mark_completed(
        self,
        backup_id: uuid.UUID,
        file_name: str,
        file_path: str,
        size_bytes: int,
        sha256: str,
        encryption: str,
    ) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            record = await session.get(TenantBackupModel, backup_id)
            if record is None:
                return
            record.status = "COMPLETED"
            record.file_name = file_name
            record.file_path = file_path
            record.size_bytes = size_bytes
            record.sha256 = sha256
            record.encryption = encryption
            record.error = None
            record.completed_at = datetime.now(record.created_at.tzinfo)
            if owns_session:
                await session.commit()

    async def mark_failed(self, backup_id: uuid.UUID, error: str) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            record = await session.get(TenantBackupModel, backup_id)
            if record is None:
                return
            record.status = "FAILED"
            record.error = error[:4000]
            record.completed_at = datetime.now(record.created_at.tzinfo)
            if owns_session:
                await session.commit()

    async def get(self, tenant_id: uuid.UUID, backup_id: uuid.UUID) -> Optional[dict]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantBackupModel).where(
                TenantBackupModel.id == backup_id,
                TenantBackupModel.tenant_id == tenant_id,
            )
            record = (await session.execute(stmt)).scalar_one_or_none()
            return _to_dict(record) if record else None

    async def get_download_info(
        self, tenant_id: uuid.UUID, backup_id: uuid.UUID
    ) -> Optional[dict]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantBackupModel).where(
                TenantBackupModel.id == backup_id,
                TenantBackupModel.tenant_id == tenant_id,
            )
            record = (await session.execute(stmt)).scalar_one_or_none()
            if record is None:
                return None
            return {
                "id": str(record.id),
                "status": record.status,
                "file_name": record.file_name,
                "file_path": record.file_path,
            }

    async def list_for_tenant(
        self, tenant_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> List[dict]:
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(TenantBackupModel)
                .where(TenantBackupModel.tenant_id == tenant_id)
                .order_by(TenantBackupModel.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            records = (await session.execute(stmt)).scalars().all()
            return [_to_dict(record) for record in records]

    async def count_for_tenant(self, tenant_id: uuid.UUID) -> int:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(func.count(TenantBackupModel.id)).where(
                TenantBackupModel.tenant_id == tenant_id
            )
            return int((await session.execute(stmt)).scalar() or 0)

    async def list_all(
        self,
        tenant_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[dict]:
        limit = max(1, min(limit, 200))
        offset = max(0, offset)
        async with session_scope(self._session_factory) as (session, _):
            stmt = (
                select(
                    TenantBackupModel,
                    TenantModel.company_name,
                    TenantModel.nif,
                    TenantModel.slug,
                )
                .outerjoin(TenantModel, TenantModel.id == TenantBackupModel.tenant_id)
                .order_by(TenantBackupModel.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
            if tenant_id is not None:
                stmt = stmt.where(TenantBackupModel.tenant_id == tenant_id)
            rows = (await session.execute(stmt)).all()
            items: List[dict] = []
            for record, company_name, nif, slug in rows:
                entry = _to_dict(record)
                entry["company_name"] = company_name
                entry["nif"] = nif
                entry["tenant_slug"] = slug
                items.append(entry)
            return items

    async def count_all(self, tenant_id: Optional[uuid.UUID] = None) -> int:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(func.count(TenantBackupModel.id))
            if tenant_id is not None:
                stmt = stmt.where(TenantBackupModel.tenant_id == tenant_id)
            return int((await session.execute(stmt)).scalar() or 0)

    async def delete(self, tenant_id: uuid.UUID, backup_id: uuid.UUID) -> Optional[dict]:
        async with session_scope(self._session_factory) as (session, owns_session):
            stmt = select(TenantBackupModel).where(
                TenantBackupModel.id == backup_id,
                TenantBackupModel.tenant_id == tenant_id,
            )
            record = (await session.execute(stmt)).scalar_one_or_none()
            if record is None:
                return None
            result = _to_dict(record)
            result["file_path"] = record.file_path
            await session.delete(record)
            if owns_session:
                await session.commit()
            return result

    async def get_tenant_info(self, tenant_id: uuid.UUID) -> Optional[dict]:
        async with session_scope(self._session_factory) as (session, _):
            tenant = await session.get(TenantModel, tenant_id)
            if tenant is None:
                return None
            db_conn = dict(tenant.database_connections or {})
            return {
                "id": str(tenant.id),
                "slug": tenant.slug,
                "company_name": tenant.company_name,
                "nif": tenant.nif,
                "status": tenant.status,
                "backup_settings": dict(db_conn.get("backup_settings") or {}),
            }

    async def latest_completed_at(self, tenant_id: uuid.UUID) -> Optional[datetime]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(func.max(TenantBackupModel.completed_at)).where(
                TenantBackupModel.tenant_id == tenant_id,
                TenantBackupModel.status == "COMPLETED",
            )
            return (await session.execute(stmt)).scalar()

    async def list_active_tenant_ids(self) -> List[uuid.UUID]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantModel.id).where(TenantModel.status == "ACTIVE")
            return [row[0] for row in (await session.execute(stmt)).all()]

    async def purge_older_than(self, cutoff: datetime) -> List[str]:
        async with session_scope(self._session_factory) as (session, owns_session):
            stmt = select(TenantBackupModel).where(TenantBackupModel.created_at < cutoff)
            records = (await session.execute(stmt)).scalars().all()
            paths = [record.file_path for record in records if record.file_path]
            if records:
                await session.execute(
                    delete(TenantBackupModel).where(TenantBackupModel.created_at < cutoff)
                )
                if owns_session:
                    await session.commit()
            return paths

    async def purge_older_than_for_tenant(
        self, tenant_id: uuid.UUID, cutoff: datetime
    ) -> List[str]:
        async with session_scope(self._session_factory) as (session, owns_session):
            stmt = select(TenantBackupModel).where(
                TenantBackupModel.tenant_id == tenant_id,
                TenantBackupModel.created_at < cutoff,
            )
            records = (await session.execute(stmt)).scalars().all()
            paths = [record.file_path for record in records if record.file_path]
            if records:
                await session.execute(
                    delete(TenantBackupModel).where(
                        TenantBackupModel.tenant_id == tenant_id,
                        TenantBackupModel.created_at < cutoff,
                    )
                )
                if owns_session:
                    await session.commit()
            return paths
