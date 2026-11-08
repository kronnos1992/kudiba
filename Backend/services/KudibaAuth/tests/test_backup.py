import hashlib
import json
import os
import uuid
import zipfile
from datetime import date, datetime
from decimal import Decimal

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from httpx import ASGITransport, AsyncClient

from src.config import Settings
from src.infrastructure.backup.exporter import TenantDataExporter, _is_sensitive, _jsonify
from src.infrastructure.backup.restorer import (
    BackupRestoreValidationError,
    TenantDataRestorer,
    _resolve_module_database,
    _parse_value,
    _topological_sort_tables,
)
from src.infrastructure.backup.storage import MAGIC, BackupStorage
from src.main import app


def _config(tmp_path, **overrides) -> Settings:
    values = {
        "database_url": "postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_auth",
        "jwt_secret": "test-secret",
        "backup_storage_dir": str(tmp_path),
        "backup_encryption_key": "a" * 64,
    }
    values.update(overrides)
    return Settings(**values)


def test_storage_encrypts_with_aes_gcm(tmp_path):
    config = _config(tmp_path)
    storage = BackupStorage(config)
    tenant_id = uuid.uuid4()
    backup_id = uuid.uuid4()

    source = tmp_path / "source.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("manifest.json", "{}")

    stored = storage.store(str(source), tenant_id, backup_id)
    assert not (tmp_path / str(tenant_id) / f"{backup_id}.zip").exists()

    assert stored["file_name"] == f"{backup_id}.zip.enc"
    assert stored["encryption"] == "AES-256-GCM"
    assert os.path.isfile(stored["file_path"])

    with open(stored["file_path"], "rb") as handle:
        raw = handle.read()
    assert raw.startswith(MAGIC)
    nonce = raw[len(MAGIC) : len(MAGIC) + 12]
    ciphertext = raw[len(MAGIC) + 12 :]

    key = bytes.fromhex("a" * 64)
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    with zipfile.ZipFile(source) as archive:
        expected = archive.read("manifest.json")
    assert b"manifest.json" in plaintext
    assert b"{}" in plaintext
    assert expected == b"{}"


def test_storage_rejects_paths_outside_base(tmp_path):
    config = _config(tmp_path)
    storage = BackupStorage(config)
    with pytest.raises(ValueError):
        storage.resolve("/etc/passwd")


def test_exporter_builds_tenant_and_fk_scopes(tmp_path):
    exporter = TenantDataExporter(_config(tmp_path))
    columns = {
        ("kudiba_core", "invoices"): ["id", "tenant_id"],
        ("kudiba_core", "invoice_lines"): ["id", "invoice_id", "description"],
        ("kudiba_core", "tenants"): ["id", "company_name"],
    }
    primary_keys = {
        ("kudiba_core", "invoices"): ["id"],
        ("kudiba_core", "invoice_lines"): ["id"],
        ("kudiba_core", "tenants"): ["id"],
    }
    foreign_keys = {
        ("kudiba_core", "invoice_lines"): [
            ("invoice_id", "kudiba_core", "invoices", "id")
        ]
    }

    scopes = exporter._build_scopes(columns, primary_keys, foreign_keys)

    assert scopes[("kudiba_core", "invoices")] == "tenant_id = $1::uuid"
    assert scopes[("kudiba_core", "tenants")] == "id = $1::uuid"
    assert scopes[("kudiba_core", "invoice_lines")] == (
        '"invoice_id" IN (SELECT "id" FROM "kudiba_core"."invoices" '
        "WHERE tenant_id = $1::uuid)"
    )


def test_sensitive_and_json_helpers():
    assert _is_sensitive("password_hash")
    assert _is_sensitive("client_secret")
    assert not _is_sensitive("invoice_hash")
    assert _jsonify(uuid.UUID(int=1)) == "00000000-0000-0000-0000-000000000001"
    assert _jsonify(b"abc") == "YWJj"


@pytest.mark.asyncio
async def test_backup_endpoints_require_authentication():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        assert (await client.get("/api/v1/auth/tenant/backups")).status_code == 401
        assert (await client.post("/api/v1/auth/tenant/backups")).status_code == 401
        assert (
            await client.get(
                f"/api/v1/auth/tenant/backups/{uuid.uuid4()}/download"
            )
        ).status_code == 401
        assert (
            await client.get(
                f"/api/v1/auth/tenant/backups/{uuid.uuid4()}/manifest"
            )
        ).status_code == 401
        assert (
            await client.post(
                f"/api/v1/auth/tenant/backups/{uuid.uuid4()}/restore"
            )
        ).status_code == 401
        assert (await client.get("/api/v1/auth/admin/backups")).status_code == 401


def test_storage_decrypt_to_file_and_read_manifest(tmp_path):
    config = _config(tmp_path)
    storage = BackupStorage(config)
    tenant_id = uuid.uuid4()
    backup_id = uuid.uuid4()

    manifest = {
        "format": "kudiba-tenant-backup",
        "format_version": 1,
        "backup_id": str(backup_id),
        "tenant": {"id": str(tenant_id), "company_name": "Kudiba Lda"},
        "totals": {"row_count": 5, "module_count": 1},
        "modules": [],
    }
    source = tmp_path / "source.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))

    stored = storage.store(str(source), tenant_id, backup_id)
    read_back = storage.read_manifest(str(stored["file_path"]))
    assert read_back["backup_id"] == str(backup_id)
    assert read_back["tenant"]["company_name"] == "Kudiba Lda"

    decrypted_zip = tmp_path / "decrypted.zip"
    storage.decrypt_to_file(str(stored["file_path"]), str(decrypted_zip))
    with zipfile.ZipFile(decrypted_zip, "r") as archive:
        assert json.loads(archive.read("manifest.json"))["backup_id"] == str(backup_id)


@pytest.mark.asyncio
async def test_restorer_dry_run_and_cross_tenant_protection(tmp_path):
    config = _config(tmp_path)
    storage = BackupStorage(config)
    restorer = TenantDataRestorer(config, storage)
    tenant_id = uuid.uuid4()
    backup_id = uuid.uuid4()

    auth_module_payload = {
        "database": "kudiba_auth",
        "tenant_id": str(tenant_id),
        "tables": {
            "kudiba_core.tenants": {
                "row_count": 1,
                "columns": ["id", "company_name"],
                "redacted_columns": [],
                "rows": [{"id": str(tenant_id), "company_name": "Kudiba Lda"}],
            }
        },
        "skipped_tables": [],
    }
    auth_bytes = json.dumps(auth_module_payload).encode("utf-8")
    auth_sha = hashlib.sha256(auth_bytes).hexdigest()

    manifest = {
        "format": "kudiba-tenant-backup",
        "format_version": 1,
        "backup_id": str(backup_id),
        "tenant": {"id": str(tenant_id), "company_name": "Kudiba Lda"},
        "created_at": "2026-11-08T10:00:00+00:00",
        "totals": {"row_count": 1, "module_count": 1},
        "modules": [
            {
                "module": "auth",
                "database": "kudiba_auth",
                "file": "modules/kudiba_auth.json",
                "sha256": auth_sha,
                "row_count": 1,
            }
        ],
    }

    source = tmp_path / "backup.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("manifest.json", json.dumps(manifest))
        archive.writestr("modules/kudiba_auth.json", auth_bytes)

    stored = storage.store(str(source), tenant_id, backup_id)

    report = await restorer.restore_from_file(
        str(stored["file_path"]), target_tenant_id=tenant_id, dry_run=True
    )
    assert report["valid"] is True
    assert report["dry_run"] is True
    assert report["total_rows"] == 1
    assert report["modules"][0]["checksum_verified"] is True

    other_tenant = uuid.uuid4()
    with pytest.raises(BackupRestoreValidationError):
        await restorer.restore_from_file(
            str(stored["file_path"]),
            target_tenant_id=other_tenant,
            dry_run=True,
            allow_cross_tenant=False,
        )


def test_topological_sort_and_value_parsing():
    tables = [
        ("kudiba_core", "invoice_lines"),
        ("kudiba_core", "invoices"),
        ("kudiba_core", "tenants"),
    ]
    fks = {
        ("kudiba_core", "invoice_lines"): [
            ("invoice_id", "kudiba_core", "invoices", "id")
        ],
        ("kudiba_core", "invoices"): [
            ("tenant_id", "kudiba_core", "tenants", "id")
        ],
    }
    ordered = _topological_sort_tables(tables, fks)
    assert ordered == [
        ("kudiba_core", "tenants"),
        ("kudiba_core", "invoices"),
        ("kudiba_core", "invoice_lines"),
    ]

    uid = uuid.uuid4()
    assert _parse_value(str(uid), "uuid", "uuid") == uid
    assert _parse_value("2026-11-08", "date", "date") == date(2026, 11, 8)
    assert _parse_value("1250.50", "numeric", "numeric") == Decimal("1250.50")
    assert isinstance(
        _parse_value("2026-11-08T10:00:00+00:00", "timestamp with time zone", "timestamptz"),
        datetime,
    )


def test_restore_destination_is_bound_to_known_module():
    assert _resolve_module_database("auth", "kudiba_auth", False) == "kudiba_auth"
    assert _resolve_module_database("erp_replica", "kudiba_erp", True) == "kudiba_erp"
    with pytest.raises(BackupRestoreValidationError):
        _resolve_module_database("auth", "kudiba_treasury", False)
    with pytest.raises(BackupRestoreValidationError):
        _resolve_module_database("erp_replica", "kudiba_erp", False)
