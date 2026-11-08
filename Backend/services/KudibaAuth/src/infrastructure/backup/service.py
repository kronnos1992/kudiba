import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    import fcntl
except ImportError:  # pragma: no cover
    fcntl = None

from src.config import Settings
from src.infrastructure.backup.exporter import TenantDataExporter
from src.infrastructure.backup.restorer import (
    BackupRestoreValidationError,
    TenantDataRestorer,
)
from src.infrastructure.backup.storage import BackupStorage
from src.infrastructure.persistence.backup_repository import (
    SqlAlchemyTenantBackupRepository,
)


logger = logging.getLogger(__name__)


class BackupNotFoundError(Exception):
    pass


class BackupNotReadyError(Exception):
    pass


class BackupTooLargeError(Exception):
    pass


class TenantBackupService:
    def __init__(
        self,
        config: Settings,
        repository: SqlAlchemyTenantBackupRepository,
        exporter: TenantDataExporter,
        storage: BackupStorage,
        audit_repository=None,
        restorer: Optional[TenantDataRestorer] = None,
    ):
        self.config = config
        self.repository = repository
        self.exporter = exporter
        self.storage = storage
        self.restorer = restorer or TenantDataRestorer(config, storage)
        self.audit_repository = audit_repository
        self._task: Optional[asyncio.Task] = None
        self._stop = asyncio.Event()
        self._run_lock = asyncio.Lock()

    async def create_backup(
        self,
        tenant_id: uuid.UUID,
        requested_by: Optional[uuid.UUID],
        trigger: str = "MANUAL",
        tenant_info: Optional[dict] = None,
    ) -> dict:
        if tenant_info is None:
            tenant_info = await self.repository.get_tenant_info(tenant_id)
        if tenant_info is None:
            raise BackupNotFoundError("Tenant nao encontrado")

        record = await self.repository.create(tenant_id, requested_by, trigger)
        backup_id = uuid.UUID(record["id"])

        try:
            async with self._run_lock:
                result = await self.exporter.export(
                    tenant_id=tenant_id,
                    backup_id=backup_id,
                    trigger=trigger,
                    created_by=requested_by,
                    tenant_info=tenant_info,
                )
                try:
                    max_bytes = max(1, self.config.backup_max_file_size_mb) * 1024 * 1024
                    if result.size_bytes > max_bytes:
                        raise BackupTooLargeError(
                            f"Backup excede o limite de {self.config.backup_max_file_size_mb} MB"
                        )
                    backup_cfg = dict((tenant_info or {}).get("backup_settings") or {})
                    custom_folder = backup_cfg.get("storage_location") or None
                    stored = await asyncio.to_thread(
                        self.storage.store,
                        result.zip_path,
                        tenant_id,
                        backup_id,
                        custom_folder,
                    )
                finally:
                    result.cleanup()

            await self.repository.mark_completed(
                backup_id=backup_id,
                file_name=str(stored["file_name"]),
                file_path=str(stored["file_path"]),
                size_bytes=int(stored["size_bytes"]),
                sha256=str(stored["sha256"]),
                encryption=str(stored["encryption"]),
            )
            await self._audit(
                tenant_id,
                "BACKUP_CREATED",
                backup_id,
                requested_by,
                {
                    "trigger": trigger,
                    "size_bytes": int(stored["size_bytes"]),
                    "row_count": result.manifest["totals"]["row_count"],
                },
            )
            return await self.repository.get(tenant_id, backup_id) or record
        except Exception as exc:
            await self.repository.mark_failed(backup_id, str(exc))
            await self._audit(
                tenant_id,
                "BACKUP_FAILED",
                backup_id,
                requested_by,
                {"trigger": trigger, "error": str(exc)[:1000]},
            )
            raise

    async def list_backups(
        self, tenant_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> dict:
        items = await self.repository.list_for_tenant(tenant_id, limit, offset)
        total = await self.repository.count_for_tenant(tenant_id)
        schedule_status = await self.get_schedule_status(tenant_id)
        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "schedule_status": schedule_status,
        }

    def _resolve_interval_hours(self, backup_cfg: dict) -> int:
        freq = str(backup_cfg.get("schedule_frequency") or "").upper().strip()
        freq_map = {
            "HOURLY_1": 1,
            "HOURLY_6": 6,
            "HOURLY_12": 12,
            "DAILY": 24,
            "WEEKLY": 168,
            "MONTHLY": 720,
        }
        if freq in freq_map:
            return freq_map[freq]
        custom = backup_cfg.get("schedule_interval_hours")
        if custom is not None:
            try:
                return max(1, int(custom))
            except (TypeError, ValueError):
                pass
        return max(1, self.config.backup_schedule_interval_hours)

    def _resolve_frequency_code(self, backup_cfg: dict) -> str:
        freq = str(backup_cfg.get("schedule_frequency") or "").upper().strip()
        if freq in ("HOURLY_1", "HOURLY_6", "HOURLY_12", "DAILY", "WEEKLY", "MONTHLY"):
            return freq
        hours = self._resolve_interval_hours(backup_cfg)
        if hours <= 1:
            return "HOURLY_1"
        if hours <= 6:
            return "HOURLY_6"
        if hours <= 12:
            return "HOURLY_12"
        if hours <= 24:
            return "DAILY"
        if hours <= 168:
            return "WEEKLY"
        return "MONTHLY"

    def compute_next_due_at(
        self, last_completed_at: Optional[datetime], backup_cfg: dict
    ) -> Optional[datetime]:
        if backup_cfg.get("schedule_enabled") is False:
            return None
        now = datetime.now(timezone.utc)
        interval_hours = self._resolve_interval_hours(backup_cfg)
        schedule_time_raw = str(backup_cfg.get("schedule_time") or "").strip()

        parsed_hour: Optional[int] = None
        parsed_minute: Optional[int] = None
        if schedule_time_raw and ":" in schedule_time_raw:
            parts = schedule_time_raw.split(":", 1)
            try:
                h, m = int(parts[0]), int(parts[1])
                if 0 <= h <= 23 and 0 <= m <= 59:
                    parsed_hour, parsed_minute = h, m
            except ValueError:
                pass

        if last_completed_at is None:
            if parsed_hour is not None and parsed_minute is not None:
                candidate = now.replace(
                    hour=parsed_hour, minute=parsed_minute, second=0, microsecond=0
                )
                return candidate
            return now

        if last_completed_at.tzinfo is None:
            last_completed_at = last_completed_at.replace(tzinfo=timezone.utc)

        next_due = last_completed_at + timedelta(hours=interval_hours)
        if (
            parsed_hour is not None
            and parsed_minute is not None
            and interval_hours >= 24
        ):
            aligned = next_due.replace(
                hour=parsed_hour, minute=parsed_minute, second=0, microsecond=0
            )
            if aligned <= last_completed_at:
                aligned += timedelta(days=1)
            next_due = aligned

        return next_due

    async def get_schedule_status(self, tenant_id: uuid.UUID) -> dict:
        tenant_info = await self.repository.get_tenant_info(tenant_id)
        backup_cfg = dict((tenant_info or {}).get("backup_settings") or {})
        schedule_enabled = backup_cfg.get("schedule_enabled") is not False
        interval_hours = self._resolve_interval_hours(backup_cfg)
        frequency = self._resolve_frequency_code(backup_cfg)
        schedule_time = backup_cfg.get("schedule_time") or "02:00"
        storage_location = backup_cfg.get("storage_location") or "Backups_Kudiba"
        preferred_format = backup_cfg.get("preferred_format") or "ZIP_DECIFRADO"
        auto_save_local = backup_cfg.get("auto_save_local") is not False
        retention_days = int(
            backup_cfg.get("retention_days") or self.config.backup_retention_days or 30
        )

        last_dt = await self.repository.latest_completed_at(tenant_id)
        if last_dt is not None and last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        next_dt = self.compute_next_due_at(last_dt, backup_cfg)

        return {
            "schedule_enabled": schedule_enabled,
            "schedule_frequency": frequency,
            "schedule_interval_hours": interval_hours,
            "schedule_time": schedule_time,
            "storage_location": storage_location,
            "preferred_format": preferred_format,
            "auto_save_local": auto_save_local,
            "retention_days": retention_days,
            "last_backup_at": last_dt.isoformat() if last_dt else None,
            "next_backup_at": next_dt.isoformat() if next_dt else None,
            "scheduler_running": self._task is not None and not self._task.done(),
        }

    async def list_all_backups(
        self,
        tenant_id: Optional[uuid.UUID] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        items = await self.repository.list_all(tenant_id, limit, offset)
        total = await self.repository.count_all(tenant_id)
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    async def get_backup(self, tenant_id: uuid.UUID, backup_id: uuid.UUID) -> dict:
        record = await self.repository.get(tenant_id, backup_id)
        if record is None:
            raise BackupNotFoundError("Backup nao encontrado")
        return record

    async def get_backup_manifest(
        self, tenant_id: uuid.UUID, backup_id: uuid.UUID
    ) -> dict:
        file_path, _ = await self.download_path(tenant_id, backup_id)
        return await asyncio.to_thread(self.storage.read_manifest, file_path)

    async def download_path(self, tenant_id: uuid.UUID, backup_id: uuid.UUID) -> tuple[str, dict]:
        record = await self.repository.get_download_info(tenant_id, backup_id)
        if record is None:
            raise BackupNotFoundError("Backup nao encontrado")
        if record["status"] != "COMPLETED" or not record.get("file_path"):
            raise BackupNotReadyError("Backup ainda nao esta disponivel")
        file_path = await asyncio.to_thread(self.storage.resolve, record["file_path"])
        return file_path, record

    async def download_decrypted_zip(
        self, tenant_id: uuid.UUID, backup_id: uuid.UUID
    ) -> tuple[str, str, dict]:
        encrypted_path, record = await self.download_path(tenant_id, backup_id)
        temp_dir = tempfile.mkdtemp(prefix=f"kudiba-dec-{backup_id}-")
        zip_name = f"kudiba-backup-{backup_id}.zip"
        target_zip = os.path.join(temp_dir, zip_name)
        await asyncio.to_thread(
            self.storage.decrypt_to_file, encrypted_path, target_zip
        )
        return target_zip, temp_dir, record

    async def restore_backup(
        self,
        tenant_id: uuid.UUID,
        backup_id: uuid.UUID,
        requested_by: Optional[uuid.UUID],
        dry_run: bool = False,
        allow_cross_tenant: bool = False,
    ) -> dict:
        file_path, _ = await self.download_path(tenant_id, backup_id)
        async with self._run_lock:
            result = await self.restorer.restore_from_file(
                file_path=file_path,
                target_tenant_id=tenant_id,
                dry_run=dry_run,
                allow_cross_tenant=allow_cross_tenant,
            )
        if not dry_run:
            await self._audit(
                tenant_id,
                "BACKUP_RESTORED",
                backup_id,
                requested_by,
                {
                    "restored_rows": result.get("total_rows", 0),
                    "source_tenant_id": result.get("source_tenant_id"),
                },
            )
        return result

    async def restore_from_archive_bytes(
        self,
        tenant_id: uuid.UUID,
        raw_bytes: bytes,
        requested_by: Optional[uuid.UUID],
        dry_run: bool = False,
        allow_cross_tenant: bool = False,
    ) -> dict:
        max_bytes = max(1, self.config.backup_max_file_size_mb) * 1024 * 1024
        if len(raw_bytes) > max_bytes:
            raise BackupTooLargeError(
                f"Arquivo excede o limite de {self.config.backup_max_file_size_mb} MB"
            )
        async with self._run_lock:
            result = await self.restorer.restore_from_bytes(
                raw=raw_bytes,
                target_tenant_id=tenant_id,
                dry_run=dry_run,
                allow_cross_tenant=allow_cross_tenant,
            )
        if not dry_run:
            backup_uuid = uuid.uuid4()
            try:
                if result.get("backup_id"):
                    backup_uuid = uuid.UUID(str(result["backup_id"]))
            except ValueError:
                pass
            await self._audit(
                tenant_id,
                "BACKUP_RESTORED_FROM_FILE",
                backup_uuid,
                requested_by,
                {
                    "restored_rows": result.get("total_rows", 0),
                    "source_tenant_id": result.get("source_tenant_id"),
                },
            )
        return result

    async def delete_backup(self, tenant_id: uuid.UUID, backup_id: uuid.UUID) -> None:
        record = await self.repository.delete(tenant_id, backup_id)
        if record is None:
            raise BackupNotFoundError("Backup nao encontrado")
        if record.get("file_path"):
            await asyncio.to_thread(self.storage.delete, record["file_path"])
        await self._audit(tenant_id, "BACKUP_DELETED", backup_id, None, {})

    async def start(self) -> None:
        if not self.config.backup_schedule_enabled or self._task is not None:
            return
        self._stop = asyncio.Event()
        self._task = asyncio.create_task(self._loop(), name="tenant-backup-scheduler")
        logger.info(
            "Agendador de backups iniciado (intervalo=%sh, atraso inicial=%smin)",
            self.config.backup_schedule_interval_hours,
            self.config.backup_schedule_initial_delay_minutes,
        )

    async def stop(self) -> None:
        self._stop.set()
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None

    async def _loop(self) -> None:
        initial_delay = max(0, min(60, self.config.backup_schedule_initial_delay_minutes * 60))
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=initial_delay)
            return
        except asyncio.TimeoutError:
            pass

        tick_seconds = min(60, max(1, self.config.backup_schedule_interval_hours) * 3600)
        while not self._stop.is_set():
            try:
                await self.run_scheduled_backups()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Falha ao executar backups agendados")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=tick_seconds)
            except asyncio.TimeoutError:
                pass

    async def run_scheduled_backups(self) -> None:
        lock_handle = None
        if fcntl is not None:
            lock_handle = open(self.storage.lock_path(), "w")
            try:
                fcntl.flock(lock_handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                lock_handle.close()
                return
        try:
            await self._purge_expired()
            for tenant_id in await self.repository.list_active_tenant_ids():
                try:
                    await self._backup_tenant_if_due(tenant_id)
                except Exception:
                    logger.exception("Falha no backup agendado do tenant %s", tenant_id)
        finally:
            if lock_handle is not None:
                fcntl.flock(lock_handle, fcntl.LOCK_UN)
                lock_handle.close()

    async def _backup_tenant_if_due(self, tenant_id: uuid.UUID) -> None:
        tenant_info = await self.repository.get_tenant_info(tenant_id)
        if tenant_info is None:
            return
        backup_cfg = dict(tenant_info.get("backup_settings") or {})
        if backup_cfg.get("schedule_enabled") is False:
            return
        last = await self.repository.latest_completed_at(tenant_id)
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        next_due = self.compute_next_due_at(last, backup_cfg)
        if next_due is None or datetime.now(timezone.utc) < next_due:
            return
        await self.create_backup(tenant_id, None, "SCHEDULED", tenant_info)

    async def _purge_expired(self) -> None:
        removed_paths: list[str] = []
        default_retention = max(1, self.config.backup_retention_days)
        now = datetime.now(timezone.utc)
        for tenant_id in await self.repository.list_active_tenant_ids():
            tenant_info = await self.repository.get_tenant_info(tenant_id)
            backup_cfg = dict((tenant_info or {}).get("backup_settings") or {})
            try:
                tenant_retention = max(
                    1, int(backup_cfg.get("retention_days") or default_retention)
                )
            except (TypeError, ValueError):
                tenant_retention = default_retention
            tenant_cutoff = now - timedelta(days=tenant_retention)
            paths = await self.repository.purge_older_than_for_tenant(
                tenant_id, tenant_cutoff
            )
            removed_paths.extend(paths)

        global_cutoff = now - timedelta(days=max(default_retention, 365))
        removed_paths.extend(await self.repository.purge_older_than(global_cutoff))

        for path in removed_paths:
            await asyncio.to_thread(self.storage.delete, path)
        if removed_paths:
            logger.info("Removidos %s backups expirados", len(removed_paths))

    async def _audit(
        self,
        tenant_id: uuid.UUID,
        action: str,
        backup_id: uuid.UUID,
        actor: Optional[uuid.UUID],
        details: dict,
    ) -> None:
        if self.audit_repository is None:
            return
        try:
            await self.audit_repository.record_system_event(
                tenant_id=tenant_id,
                module="AUTH",
                action=action,
                entity_type="tenant_backup",
                entity_id=str(backup_id),
                actor_user_id=str(actor) if actor else None,
                details=details,
            )
        except Exception:
            logger.exception("Falha ao registar auditoria de backup")
