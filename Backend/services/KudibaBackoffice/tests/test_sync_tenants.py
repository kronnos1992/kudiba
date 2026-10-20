import uuid
from datetime import date, datetime, timezone

import pytest

from src.application.commands import SyncTenantsUseCase
from src.domain.entities import TenantRecord


class FakeClientRepo:
    def __init__(self):
        self.clients = []

    async def list_all(self, search=None):
        return list(self.clients)

    async def save(self, entity):
        self.clients.append(entity)


class FakeLicenseRepo:
    def __init__(self):
        self.licenses = []

    async def list_all(self):
        return list(self.licenses)

    async def save(self, entity):
        self.licenses.append(entity)


class FakeTenantReader:
    def __init__(self, tenants):
        self._tenants = tenants

    async def list_tenants(self):
        return self._tenants


def _tenant(**overrides) -> TenantRecord:
    base = dict(
        id=uuid.uuid4(),
        slug="acme",
        company_name="Acme Lda",
        nif="5417123456",
        status="ACTIVE",
        email="admin@acme.ao",
        phone="+244900000000",
        license_valid_until=datetime(2027, 10, 19, tzinfo=timezone.utc),
        subscribed_modules=["invoicing", "inventory", "treasury"],
        created_at=datetime(2026, 10, 16, tzinfo=timezone.utc),
    )
    base.update(overrides)
    return TenantRecord(**base)


@pytest.mark.asyncio
async def test_sync_imports_tenant_with_license():
    client_repo = FakeClientRepo()
    license_repo = FakeLicenseRepo()
    reader = FakeTenantReader([_tenant()])

    imported = await SyncTenantsUseCase(client_repo, license_repo, reader).execute()

    assert imported == 1
    assert len(client_repo.clients) == 1
    assert client_repo.clients[0].contact_email == "admin@acme.ao"
    assert "onboarding 'acme'" in client_repo.clients[0].notes

    assert len(license_repo.licenses) == 1
    lic = license_repo.licenses[0]
    assert lic.valid_until == date(2027, 10, 19)
    assert lic.valid_from == date(2026, 10, 16)
    assert lic.status == "ACTIVE"
    assert lic.modules == ["invoicing", "inventory", "treasury"]
    assert lic.license_key.startswith("KDB-")


@pytest.mark.asyncio
async def test_sync_is_idempotent():
    client_repo = FakeClientRepo()
    license_repo = FakeLicenseRepo()
    reader = FakeTenantReader([_tenant()])
    use_case = SyncTenantsUseCase(client_repo, license_repo, reader)

    first = await use_case.execute()
    second = await use_case.execute()

    assert first == 1
    assert second == 0
    assert len(client_repo.clients) == 1
    assert len(license_repo.licenses) == 1


@pytest.mark.asyncio
async def test_sync_without_license_valid_until_creates_client_only():
    client_repo = FakeClientRepo()
    license_repo = FakeLicenseRepo()
    reader = FakeTenantReader([_tenant(license_valid_until=None, subscribed_modules=None)])

    imported = await SyncTenantsUseCase(client_repo, license_repo, reader).execute()

    assert imported == 1
    assert len(client_repo.clients) == 1
    assert license_repo.licenses == []


@pytest.mark.asyncio
async def test_sync_keeps_valid_until_after_valid_from_for_backdated_tenants():
    client_repo = FakeClientRepo()
    license_repo = FakeLicenseRepo()
    reader = FakeTenantReader(
        [
            _tenant(
                created_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
                license_valid_until=datetime(2026, 6, 1, tzinfo=timezone.utc),
            )
        ]
    )

    await SyncTenantsUseCase(client_repo, license_repo, reader).execute()

    lic = license_repo.licenses[0]
    assert lic.valid_until == date(2026, 6, 1)
    assert lic.valid_from == date(2026, 5, 31)
    assert lic.valid_from < lic.valid_until
