import base64
import hashlib
import io
import json
import uuid
import zipfile
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse

import asyncpg

from src.config import Settings
from src.infrastructure.backup.exporter import (
    DATABASES,
    EXCLUDED_TABLES,
    ERP_REPLICA,
    GLOBAL_REFERENCE_TABLES,
    _is_sensitive,
    _qualified,
    _quote,
)
from src.infrastructure.backup.storage import BackupStorage


class BackupRestoreValidationError(Exception):
    pass


def _resolve_module_database(
    module: str, database: str, include_erp_replica: bool
) -> str:
    allowed_databases = dict(DATABASES)
    if include_erp_replica:
        allowed_databases[ERP_REPLICA[0]] = ERP_REPLICA[1]
    expected_database = allowed_databases.get(module)
    if expected_database is None or database != expected_database:
        raise BackupRestoreValidationError(
            f"Destino de restauro inválido para o módulo {module!r}"
        )
    return expected_database


def _parse_value(value: Any, data_type: str, udt_name: str) -> Any:
    if value is None:
        return None
    dt = (data_type or "").lower()
    udt = (udt_name or "").lower()

    if dt == "array" or udt.startswith("_"):
        elem_udt = udt[1:] if udt.startswith("_") else ""
        if isinstance(value, list):
            return [_parse_value(item, elem_udt, elem_udt) for item in value]
        return value

    if dt == "uuid" or udt == "uuid":
        return uuid.UUID(str(value)) if not isinstance(value, uuid.UUID) else value

    if "timestamp" in dt or udt in ("timestamptz", "timestamp"):
        if isinstance(value, datetime):
            return value
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt == "timestamp without time zone" and parsed.tzinfo is not None:
            return parsed.replace(tzinfo=None)
        return parsed

    if dt == "date" or udt == "date":
        return date.fromisoformat(str(value)[:10]) if not isinstance(value, date) else value

    if "time" in dt or udt in ("time", "timetz"):
        return time.fromisoformat(str(value)) if not isinstance(value, time) else value

    if dt in ("numeric", "decimal") or udt == "numeric":
        return Decimal(str(value)) if not isinstance(value, Decimal) else value

    if dt in ("integer", "smallint", "bigint") or udt in ("int2", "int4", "int8"):
        return int(value)

    if dt in ("double precision", "real") or udt in ("float4", "float8"):
        return float(value)

    if dt == "boolean" or udt == "bool":
        if isinstance(value, bool):
            return value
        return str(value).lower() in ("true", "1", "t", "yes")

    if dt in ("json", "jsonb") or udt in ("json", "jsonb"):
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False, default=str)

    if dt == "bytea" or udt == "bytea":
        if isinstance(value, (bytes, bytearray)):
            return bytes(value)
        return base64.b64decode(str(value))

    return value


def _topological_sort_tables(
    table_keys: List[Tuple[str, str]],
    foreign_keys: Dict[Tuple[str, str], List[Tuple[str, str, str, str]]],
) -> List[Tuple[str, str]]:
    remaining = list(dict.fromkeys(table_keys))
    ordered: List[Tuple[str, str]] = []
    placed = set()

    for _ in range(len(remaining) + 1):
        progressed = False
        next_remaining: List[Tuple[str, str]] = []
        for key in remaining:
            refs = foreign_keys.get(key, [])
            deps = {
                (parent_schema, parent_table)
                for (_, parent_schema, parent_table, _) in refs
                if (parent_schema, parent_table) != key
                and (parent_schema, parent_table) in remaining
            }
            if deps.issubset(placed):
                ordered.append(key)
                placed.add(key)
                progressed = True
            else:
                next_remaining.append(key)
        remaining = next_remaining
        if not remaining or not progressed:
            break

    ordered.extend(remaining)
    return ordered


class TenantDataRestorer:
    def __init__(self, config: Settings, storage: BackupStorage):
        self.config = config
        self.storage = storage
        url = config.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        parsed = urlparse(url)
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 5432
        self.user = unquote(parsed.username or "kudiba")
        self.password = unquote(parsed.password or "")

    async def restore_from_file(
        self,
        file_path: str,
        target_tenant_id: uuid.UUID,
        dry_run: bool = False,
        allow_cross_tenant: bool = False,
    ) -> Dict[str, Any]:
        resolved = self.storage.resolve(file_path)
        with open(resolved, "rb") as handle:
            raw = handle.read()
        return await self.restore_from_bytes(
            raw=raw,
            target_tenant_id=target_tenant_id,
            dry_run=dry_run,
            allow_cross_tenant=allow_cross_tenant,
        )

    async def restore_from_bytes(
        self,
        raw: bytes,
        target_tenant_id: uuid.UUID,
        dry_run: bool = False,
        allow_cross_tenant: bool = False,
    ) -> Dict[str, Any]:
        try:
            zip_bytes = self.storage.decrypt_bytes(raw)
        except ValueError as exc:
            raise BackupRestoreValidationError(str(exc)) from exc

        try:
            archive = zipfile.ZipFile(io.BytesIO(zip_bytes), "r")
        except zipfile.BadZipFile as exc:
            raise BackupRestoreValidationError(
                "O arquivo decifrado não é um pacote ZIP válido"
            ) from exc

        with archive:
            if "manifest.json" not in archive.namelist():
                raise BackupRestoreValidationError(
                    "O arquivo de backup não contém manifest.json"
                )
            manifest = json.loads(archive.read("manifest.json").decode("utf-8"))
            if manifest.get("format") != "kudiba-tenant-backup":
                raise BackupRestoreValidationError(
                    "Formato de manifesto de backup incompatível"
                )

            source_tenant_id = str((manifest.get("tenant") or {}).get("id") or "")
            if (
                not allow_cross_tenant
                and source_tenant_id
                and source_tenant_id != str(target_tenant_id)
            ):
                raise BackupRestoreValidationError(
                    f"O backup pertence a outro tenant ({source_tenant_id}) e não pode ser restaurado na empresa atual ({target_tenant_id})"
                )

            modules_meta = manifest.get("modules") or []
            parsed_modules: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
            seen_modules = set()
            for mod_entry in modules_meta:
                module_name = str(mod_entry.get("module") or "")
                module_database = str(mod_entry.get("database") or "")
                database = _resolve_module_database(
                    module_name,
                    module_database,
                    self.config.backup_include_erp_replica,
                )
                if module_name in seen_modules:
                    raise BackupRestoreValidationError(
                        f"Módulo duplicado no manifesto: {module_name}"
                    )
                seen_modules.add(module_name)
                mod_file = mod_entry.get("file")
                if not mod_file or mod_file not in archive.namelist():
                    raise BackupRestoreValidationError(
                        f"Ficheiro de módulo em falta no arquivo: {mod_file}"
                    )
                mod_bytes = archive.read(mod_file)
                actual_sha256 = hashlib.sha256(mod_bytes).hexdigest()
                expected_sha256 = mod_entry.get("sha256")
                if expected_sha256 and actual_sha256 != expected_sha256:
                    raise BackupRestoreValidationError(
                        f"Checksum SHA-256 inválido no módulo {mod_entry.get('module')}"
                    )
                mod_payload = json.loads(mod_bytes.decode("utf-8"))
                if mod_payload.get("database") != database:
                    raise BackupRestoreValidationError(
                        f"A base de dados do módulo {module_name!r} não corresponde ao manifesto"
                    )
                mod_entry["database"] = database
                parsed_modules.append((mod_entry, mod_payload))

        parsed_modules.sort(
            key=lambda item: (0 if item[0].get("module") == "auth" else 1)
        )

        module_reports: List[Dict[str, Any]] = []
        total_restored_rows = 0

        for mod_entry, mod_payload in parsed_modules:
            tables_dict = mod_payload.get("tables") or {}
            planned_rows = sum(
                int((t or {}).get("row_count") or len((t or {}).get("rows") or []))
                for t in tables_dict.values()
            )
            if dry_run:
                total_restored_rows += planned_rows
                module_reports.append(
                    {
                        "module": mod_entry.get("module"),
                        "database": mod_entry.get("database"),
                        "tables_count": len(tables_dict),
                        "row_count": planned_rows,
                        "restored_rows": 0,
                        "checksum_verified": True,
                        "status": "VALIDATED",
                    }
                )
            else:
                restored_in_mod = await self._restore_database_module(
                    target_tenant_id=target_tenant_id,
                    database=str(mod_entry.get("database") or mod_payload.get("database")),
                    module_payload=mod_payload,
                )
                total_restored_rows += restored_in_mod
                module_reports.append(
                    {
                        "module": mod_entry.get("module"),
                        "database": mod_entry.get("database"),
                        "tables_count": len(tables_dict),
                        "row_count": planned_rows,
                        "restored_rows": restored_in_mod,
                        "checksum_verified": True,
                        "status": "RESTORED",
                    }
                )

        return {
            "valid": True,
            "dry_run": dry_run,
            "backup_id": manifest.get("backup_id"),
            "source_tenant_id": source_tenant_id,
            "target_tenant_id": str(target_tenant_id),
            "created_at": manifest.get("created_at"),
            "total_rows": total_restored_rows,
            "modules": module_reports,
        }

    async def _restore_database_module(
        self,
        target_tenant_id: uuid.UUID,
        database: str,
        module_payload: Dict[str, Any],
    ) -> int:
        tables_dict: Dict[str, Any] = module_payload.get("tables") or {}
        if not tables_dict:
            return 0

        connection = await asyncpg.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=database,
            timeout=self.config.backup_connect_timeout_seconds,
        )
        try:
            col_types = await self._load_column_types(connection)
            primary_keys = await self._load_primary_keys(connection)
            foreign_keys = await self._load_foreign_keys(connection)

            candidate_keys: List[Tuple[str, str]] = []
            for full_name in tables_dict.keys():
                if "." not in full_name:
                    continue
                schema, table = full_name.split(".", 1)
                if table in EXCLUDED_TABLES:
                    continue
                if (schema, table) in col_types:
                    candidate_keys.append((schema, table))

            ordered_keys = _topological_sort_tables(candidate_keys, foreign_keys)
            restored_rows = 0

            async with connection.transaction():
                await connection.execute(
                    "SELECT set_config('app.current_tenant', $1, true)",
                    str(target_tenant_id),
                )
                for schema, table in ordered_keys:
                    table_data = tables_dict.get(f"{schema}.{table}") or {}
                    rows: List[Dict[str, Any]] = table_data.get("rows") or []
                    if not rows:
                        continue

                    db_cols = col_types.get((schema, table), {})
                    sample_cols = [
                        c
                        for c in (table_data.get("columns") or list(rows[0].keys()))
                        if c in db_cols and not _is_sensitive(c)
                    ]
                    if not sample_cols:
                        continue

                    pk_cols = [
                        c for c in primary_keys.get((schema, table), []) if c in sample_cols
                    ]
                    is_immutable = (
                        schema == "kudiba_audit"
                        or (schema, table) in GLOBAL_REFERENCE_TABLES
                    )

                    col_list_sql = ", ".join(_quote(c) for c in sample_cols)
                    placeholders_sql = ", ".join(
                        f"${idx}" for idx in range(1, len(sample_cols) + 1)
                    )

                    if pk_cols:
                        pk_sql = ", ".join(_quote(c) for c in pk_cols)
                        update_cols = [c for c in sample_cols if c not in pk_cols]
                        if update_cols and not is_immutable:
                            updates_sql = ", ".join(
                                f"{_quote(c)} = EXCLUDED.{_quote(c)}" for c in update_cols
                            )
                            conflict_sql = f" ON CONFLICT ({pk_sql}) DO UPDATE SET {updates_sql}"
                        else:
                            conflict_sql = f" ON CONFLICT ({pk_sql}) DO NOTHING"
                    else:
                        conflict_sql = " ON CONFLICT DO NOTHING"

                    sql = (
                        f"INSERT INTO {_qualified(schema, table)} ({col_list_sql}) "
                        f"VALUES ({placeholders_sql}){conflict_sql}"
                    )

                    prepared_rows: List[Tuple[Any, ...]] = []
                    for row in rows:
                        values = []
                        for col in sample_cols:
                            raw_val = row.get(col)
                            if col == "tenant_id" and raw_val is not None:
                                raw_val = str(target_tenant_id)
                            elif (
                                (schema, table) == ("kudiba_core", "tenants")
                                and col == "id"
                            ):
                                raw_val = str(target_tenant_id)
                            dt, udt = db_cols[col]
                            values.append(_parse_value(raw_val, dt, udt))
                        prepared_rows.append(tuple(values))

                    await connection.executemany(sql, prepared_rows)
                    restored_rows += len(prepared_rows)

            return restored_rows
        finally:
            await connection.close()

    async def _load_column_types(
        self, connection: asyncpg.Connection
    ) -> Dict[Tuple[str, str], Dict[str, Tuple[str, str]]]:
        rows = await connection.fetch(
            """
            SELECT table_schema, table_name, column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position
            """
        )
        result: Dict[Tuple[str, str], Dict[str, Tuple[str, str]]] = {}
        for row in rows:
            key = (row["table_schema"], row["table_name"])
            result.setdefault(key, {})[row["column_name"]] = (
                row["data_type"],
                row["udt_name"],
            )
        return result

    async def _load_primary_keys(
        self, connection: asyncpg.Connection
    ) -> Dict[Tuple[str, str], List[str]]:
        rows = await connection.fetch(
            """
            SELECT tc.table_schema, tc.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
            """
        )
        pks: Dict[Tuple[str, str], List[str]] = {}
        for row in rows:
            pks.setdefault((row["table_schema"], row["table_name"]), []).append(
                row["column_name"]
            )
        return pks

    async def _load_foreign_keys(
        self, connection: asyncpg.Connection
    ) -> Dict[Tuple[str, str], List[Tuple[str, str, str, str]]]:
        rows = await connection.fetch(
            """
            SELECT tc.table_schema, tc.table_name, kcu.column_name,
                   ccu.table_schema AS parent_schema,
                   ccu.table_name AS parent_table,
                   ccu.column_name AS parent_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
             AND kcu.table_schema = tc.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position
            """
        )
        fks: Dict[Tuple[str, str], List[Tuple[str, str, str, str]]] = {}
        for row in rows:
            fks.setdefault((row["table_schema"], row["table_name"]), []).append(
                (
                    row["column_name"],
                    row["parent_schema"],
                    row["parent_table"],
                    row["parent_column"],
                )
            )
        return fks
