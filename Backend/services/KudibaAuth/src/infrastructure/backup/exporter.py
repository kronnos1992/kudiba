import base64
import hashlib
import ipaddress
import json
import os
import shutil
import tempfile
import uuid
import zipfile
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse

import asyncpg

from src.config import Settings


DATABASES: List[Tuple[str, str]] = [
    ("auth", "kudiba_auth"),
    ("invoicing", "kudiba_invoicing"),
    ("inventory", "kudiba_inventory"),
    ("treasury", "kudiba_treasury"),
    ("accounting", "kudiba_accounting"),
    ("payroll", "kudiba_payroll"),
    ("integrations", "kudiba_integrations"),
    ("backoffice", "kudiba_backoffice"),
]

ERP_REPLICA: Tuple[str, str] = ("erp_replica", "kudiba_erp")

EXCLUDED_TABLES = {"refresh_tokens", "alembic_version", "schema_migrations", "tenant_backups"}

GLOBAL_REFERENCE_TABLES = {
    ("kudiba_core", "permissions"),
    ("kudiba_core", "tax_regimes"),
    ("kudiba_core", "tax_exemption_codes"),
    ("kudiba_accounting", "chart_templates"),
    ("kudiba_accounting", "chart_template_accounts"),
}

SPECIAL_SCOPES = {
    ("kudiba_core", "tenants"): "id = $1::uuid",
    ("kudiba_core", "users"): (
        "id IN (SELECT user_id FROM kudiba_core.user_tenants WHERE tenant_id = $1::uuid)"
    ),
    ("kudiba_core", "roles"): "tenant_id = $1::uuid OR tenant_id IS NULL",
    ("kudiba_core", "role_permissions"): (
        "role_id IN (SELECT id FROM kudiba_core.roles WHERE tenant_id = $1::uuid OR tenant_id IS NULL)"
    ),
}

SENSITIVE_COLUMNS = {
    "password_hash",
    "token_hash",
    "api_key",
    "private_key",
    "encryption_key",
    "mfa_secret",
    "totp_secret",
    "two_factor_secret",
    "reset_token",
}

README_TEMPLATE = """KUDIBA ERP — COPIA DE SEGURANCA LOGICA POR TENANT
================================================

Tenant: {company_name}
Tenant ID: {tenant_id}
Backup ID: {backup_id}
Criado em: {created_at}
Desencadeado por: {trigger}

Conteudo
--------
manifest.json          Metadados, contagens e checksums SHA-256 de cada modulo.
modules/*.json         Um ficheiro por base de dados/microsservico.
                       Cada ficheiro contem as tabelas com os dados do tenant.

Regras de exportacao
--------------------
- Tabelas com coluna tenant_id sao filtradas por tenant_id.
- Tabelas filhas sem tenant_id sao filtradas pela chave estrangeira do pai.
- Tabelas globais de referencia incluidas: permissions, tax_regimes, tax_exemption_codes.
- Tabelas de segredos (refresh_tokens) sao excluidas.
- Colunas sensiveis (password_hash, token_hash, segredos e chaves) sao omitidas.

Restauro
--------
1. Criar/garantir o tenant com o mesmo UUID.
2. Importar primeiro os modulos auth (tenants, users, user_tenants, roles).
3. Importar os restantes modulos respeitando as chaves estrangeiras.
4. Validar contagens e checksums contra manifest.json.

Este arquivo nao substitui o backup fisico do PostgreSQL nem os backups
geridos pela infraestrutura. E uma copia logica portavel dos dados do tenant.
"""


@dataclass
class ExportResult:
    zip_path: str
    work_dir: str
    manifest: Dict[str, Any]
    sha256: str
    size_bytes: int

    def cleanup(self) -> None:
        shutil.rmtree(self.work_dir, ignore_errors=True)


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _qualified(schema: str, table: str) -> str:
    return f"{_quote(schema)}.{_quote(table)}"


def _jsonify(value: Any) -> Any:
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return base64.b64encode(bytes(value)).decode("ascii")
    if isinstance(value, (ipaddress.IPv4Address, ipaddress.IPv6Address)):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _jsonify(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonify(item) for item in value]
    return value


def _is_sensitive(column: str) -> bool:
    name = column.lower()
    return name in SENSITIVE_COLUMNS or name.endswith("_secret")


def _sha256_file(path: str) -> Tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


class TenantDataExporter:
    def __init__(self, config: Settings):
        self.config = config
        url = config.database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        parsed = urlparse(url)
        self.host = parsed.hostname or "localhost"
        self.port = parsed.port or 5432
        self.user = unquote(parsed.username or "kudiba")
        self.password = unquote(parsed.password or "")

    def _databases(self) -> List[Tuple[str, str]]:
        databases = list(DATABASES)
        if self.config.backup_include_erp_replica:
            databases.append(ERP_REPLICA)
        return databases

    async def export(
        self,
        tenant_id: uuid.UUID,
        backup_id: uuid.UUID,
        trigger: str,
        created_by: Optional[uuid.UUID],
        tenant_info: Dict[str, Any],
    ) -> ExportResult:
        work_dir = tempfile.mkdtemp(prefix=f"kudiba-backup-{backup_id}-")
        modules: List[Dict[str, Any]] = []
        total_rows = 0

        for module, database in self._databases():
            module_payload = await self._export_database(tenant_id, database)
            file_name = f"{database}.json"
            file_path = os.path.join(work_dir, file_name)
            with open(file_path, "w", encoding="utf-8") as handle:
                json.dump(module_payload, handle, ensure_ascii=False, indent=2, default=str)
            sha256, size_bytes = _sha256_file(file_path)
            row_count = sum(
                table["row_count"] for table in module_payload["tables"].values()
            )
            total_rows += row_count
            modules.append(
                {
                    "module": module,
                    "database": database,
                    "file": f"modules/{file_name}",
                    "sha256": sha256,
                    "size_bytes": size_bytes,
                    "row_count": row_count,
                    "tables": {
                        name: {
                            "row_count": table["row_count"],
                            "columns": table["columns"],
                            "redacted_columns": table["redacted_columns"],
                        }
                        for name, table in module_payload["tables"].items()
                    },
                    "skipped_tables": module_payload["skipped_tables"],
                }
            )

        manifest = {
            "format": "kudiba-tenant-backup",
            "format_version": 1,
            "backup_id": str(backup_id),
            "tenant": {
                "id": str(tenant_id),
                "slug": tenant_info.get("slug"),
                "company_name": tenant_info.get("company_name"),
                "nif": tenant_info.get("nif"),
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": str(created_by) if created_by else None,
            "trigger": trigger,
            "totals": {"row_count": total_rows, "module_count": len(modules)},
            "modules": modules,
        }

        modules_dir = os.path.join(work_dir, "modules")
        os.makedirs(modules_dir, exist_ok=True)
        for module in modules:
            source = os.path.join(work_dir, os.path.basename(module["file"]))
            target = os.path.join(work_dir, module["file"])
            if source != target:
                shutil.move(source, target)

        with open(os.path.join(work_dir, "manifest.json"), "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=2, default=str)

        with open(os.path.join(work_dir, "README.txt"), "w", encoding="utf-8") as handle:
            handle.write(
                README_TEMPLATE.format(
                    company_name=tenant_info.get("company_name") or "",
                    tenant_id=tenant_id,
                    backup_id=backup_id,
                    created_at=manifest["created_at"],
                    trigger=trigger,
                )
            )

        zip_path = os.path.join(work_dir, f"{backup_id}.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for root, _, files in os.walk(work_dir):
                for name in sorted(files):
                    absolute = os.path.join(root, name)
                    if absolute == zip_path:
                        continue
                    archive.write(absolute, os.path.relpath(absolute, work_dir))

        sha256, size_bytes = _sha256_file(zip_path)
        return ExportResult(
            zip_path=zip_path,
            work_dir=work_dir,
            manifest=manifest,
            sha256=sha256,
            size_bytes=size_bytes,
        )

    async def _export_database(self, tenant_id: uuid.UUID, database: str) -> Dict[str, Any]:
        connection = await asyncpg.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=database,
            timeout=self.config.backup_connect_timeout_seconds,
        )
        try:
            await connection.execute(
                "SELECT set_config('app.current_tenant', $1, false)", str(tenant_id)
            )
            columns = await self._load_columns(connection)
            primary_keys = await self._load_primary_keys(connection)
            foreign_keys = await self._load_foreign_keys(connection)
            scopes = self._build_scopes(columns, primary_keys, foreign_keys)

            payload: Dict[str, Any] = {
                "database": database,
                "tenant_id": str(tenant_id),
                "exported_at": datetime.now(timezone.utc).isoformat(),
                "tables": {},
                "skipped_tables": [],
            }

            for (schema, table), table_columns in columns.items():
                key = (schema, table)
                if table in EXCLUDED_TABLES:
                    payload["skipped_tables"].append(
                        {"table": f"{schema}.{table}", "reason": "excluded"}
                    )
                    continue
                scope = scopes.get(key)
                if not scope:
                    payload["skipped_tables"].append(
                        {"table": f"{schema}.{table}", "reason": "not_tenant_scoped"}
                    )
                    continue

                redacted = [column for column in table_columns if _is_sensitive(column)]
                selectable = [column for column in table_columns if column not in redacted]
                if not selectable:
                    payload["skipped_tables"].append(
                        {"table": f"{schema}.{table}", "reason": "all_columns_redacted"}
                    )
                    continue

                select_list = ", ".join(_quote(column) for column in selectable)
                pk_cols = [col for col in primary_keys.get(key, []) if col in selectable]
                order_clause = (
                    f" ORDER BY {', '.join(_quote(col) for col in pk_cols)}"
                    if pk_cols
                    else ""
                )
                sql = (
                    f"SELECT {select_list} FROM {_qualified(schema, table)} "
                    f"WHERE {scope}{order_clause}"
                )
                params = [tenant_id] if "$1" in scope else []
                rows = await connection.fetch(sql, *params)
                payload["tables"][f"{schema}.{table}"] = {
                    "row_count": len(rows),
                    "columns": selectable,
                    "redacted_columns": redacted,
                    "rows": [
                        {column: _jsonify(row[column]) for column in selectable}
                        for row in rows
                    ],
                }

            return payload
        finally:
            await connection.close()

    async def _load_columns(self, connection: asyncpg.Connection) -> Dict[Tuple[str, str], List[str]]:
        rows = await connection.fetch(
            """
            SELECT table_schema, table_name, column_name
            FROM information_schema.columns
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name, ordinal_position
            """
        )
        columns: Dict[Tuple[str, str], List[str]] = {}
        for row in rows:
            columns.setdefault((row["table_schema"], row["table_name"]), []).append(
                row["column_name"]
            )
        return columns

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
        primary_keys: Dict[Tuple[str, str], List[str]] = {}
        for row in rows:
            primary_keys.setdefault((row["table_schema"], row["table_name"]), []).append(
                row["column_name"]
            )
        return primary_keys

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
        foreign_keys: Dict[Tuple[str, str], List[Tuple[str, str, str, str]]] = {}
        for row in rows:
            foreign_keys.setdefault(
                (row["table_schema"], row["table_name"]), []
            ).append(
                (
                    row["column_name"],
                    row["parent_schema"],
                    row["parent_table"],
                    row["parent_column"],
                )
            )
        return foreign_keys

    def _build_scopes(
        self,
        columns: Dict[Tuple[str, str], List[str]],
        primary_keys: Dict[Tuple[str, str], List[str]],
        foreign_keys: Dict[Tuple[str, str], List[Tuple[str, str, str, str]]],
    ) -> Dict[Tuple[str, str], str]:
        scopes: Dict[Tuple[str, str], str] = {}
        for key, table_columns in columns.items():
            if "tenant_id" in table_columns:
                scopes[key] = "tenant_id = $1::uuid"
        for key in GLOBAL_REFERENCE_TABLES:
            if key in columns:
                scopes[key] = "TRUE"
        for key, scope in SPECIAL_SCOPES.items():
            if key in columns:
                scopes[key] = scope

        for _ in range(6):
            changed = False
            for key, references in foreign_keys.items():
                if key in scopes:
                    continue
                for column, parent_schema, parent_table, parent_column in references:
                    parent_key = (parent_schema, parent_table)
                    parent_scope = scopes.get(parent_key)
                    if not parent_scope:
                        continue
                    scopes[key] = (
                        f"{_quote(column)} IN ("
                        f"SELECT {_quote(parent_column)} FROM {_qualified(parent_schema, parent_table)} "
                        f"WHERE {parent_scope})"
                    )
                    changed = True
                    break
            if not changed:
                break
        return scopes
