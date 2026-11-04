from datetime import date, timedelta

import pytest
from httpx import ASGITransport, AsyncClient

from src.application.alvara_verifier import VerifyAlvaraUseCase
from src.application.commands import CreateClientUseCase, add_one_year, slugify
from src.application.dto import CreateClientCommand
from src.domain.error import DomainError, InvalidModulesError
from src.domain.modules import validate_modules
from src.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "UP"
        assert data["service"] == "kudiba-backoffice"


@pytest.mark.asyncio
async def test_clients_require_authentication():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/backoffice/clients")
        assert response.status_code == 401
        assert response.json()["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_invalid_token_rejected():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            "/api/v1/backoffice/clients",
            headers={"Authorization": "Bearer token-invalido"},
        )
        assert response.status_code == 401
        assert response.json()["code"] == "UNAUTHORIZED"


def test_validate_modules_accepts_known_and_deduplicates():
    result = validate_modules(["invoicing", "inventory", "invoicing"])
    assert result == ["invoicing", "inventory"]


def test_validate_modules_rejects_unknown():
    with pytest.raises(InvalidModulesError):
        validate_modules(["invoicing", "martian"])


def test_validate_modules_rejects_empty():
    with pytest.raises(InvalidModulesError):
        validate_modules([])


def test_add_one_year_handles_leap_day():
    assert add_one_year(date(2024, 2, 29)) == date(2025, 2, 28)
    assert add_one_year(date(2026, 10, 17)) == date(2027, 10, 17)


def test_slugify_normalizes_company_names():
    assert slugify("Kudiba Comercial & Serviços, Lda") == "kudiba-comercial-servicos-lda"
    assert slugify("   !!!   ") == "cliente"


class _FakeClientRepo:
    def __init__(self):
        self.saved = []

    async def find_by_nif(self, nif):
        return None

    async def save(self, entity):
        self.saved.append(entity)


class _FakeLicenseRepo:
    def __init__(self):
        self.saved = []

    async def save(self, entity):
        self.saved.append(entity)

    async def list_for_client(self, client_id):
        return list(self.saved)


class _FakeProvisioner:
    def __init__(self):
        self.calls = []

    async def nif_exists(self, nif):
        return False

    async def slug_exists(self, slug):
        return False

    async def provision_client_tenant(self, **kwargs):
        self.calls.append(kwargs)


@pytest.mark.asyncio
async def test_create_client_requires_and_persists_alvara_and_dates():
    client_repo = _FakeClientRepo()
    license_repo = _FakeLicenseRepo()
    provisioner = _FakeProvisioner()
    use_case = CreateClientUseCase(client_repo, license_repo, provisioner)
    today = date.today()
    issue_date = today - timedelta(days=30)
    expiry_date = today + timedelta(days=365)

    with pytest.raises(DomainError, match="alvará comercial"):
        await use_case.execute(
            CreateClientCommand(
                company_name="Empresa Teste Lda",
                nif="5417999888",
                alvara_number="   ",
                modules=["invoicing"],
            )
        )

    with pytest.raises(DomainError, match="data de validade"):
        await use_case.execute(
            CreateClientCommand(
                company_name="Empresa Teste Lda",
                nif="5417999888",
                alvara_number="ALV-2026/00412",
                alvara_issue_date=issue_date,
                alvara_expiry_date=issue_date,
                modules=["invoicing"],
            )
        )

    with pytest.raises(DomainError, match="expirado"):
        await use_case.execute(
            CreateClientCommand(
                company_name="Empresa Teste Lda",
                nif="5417999888",
                alvara_number="ALV-2026/00412",
                alvara_issue_date=today - timedelta(days=400),
                alvara_expiry_date=today - timedelta(days=1),
                modules=["invoicing"],
            )
        )

    result = await use_case.execute(
        CreateClientCommand(
            company_name="Empresa Teste Lda",
            nif="5417999888",
            alvara_number="ALV-2026/00412",
            alvara_issue_date=issue_date,
            alvara_expiry_date=expiry_date,
            modules=["invoicing"],
        )
    )

    assert result.alvara_number == "ALV-2026/00412"
    assert result.alvara_issue_date == issue_date
    assert result.alvara_expiry_date == expiry_date
    assert result.alvara_status == "VALID"
    assert client_repo.saved[0].alvara_number == "ALV-2026/00412"
    assert client_repo.saved[0].alvara_issue_date == issue_date
    assert client_repo.saved[0].alvara_expiry_date == expiry_date
    assert provisioner.calls[0]["alvara_number"] == "ALV-2026/00412"
    assert provisioner.calls[0]["alvara_issue_date"] == issue_date
    assert provisioner.calls[0]["alvara_expiry_date"] == expiry_date


@pytest.mark.asyncio
async def test_verify_alvara_checks_validity_and_returns_official_platforms():
    verifier = VerifyAlvaraUseCase()
    today = date.today()

    valid_res = await verifier.execute(
        alvara_number="ALV-2026/00412",
        nif="5417999888",
        alvara_issue_date=today - timedelta(days=10),
        alvara_expiry_date=today + timedelta(days=180),
        probe_remote=False,
    )
    assert valid_res.valid is True
    assert valid_res.status == "VALID"
    assert valid_res.days_remaining == 180
    platform_ids = [p.id for p in valid_res.official_platforms]
    assert "SILAC_MINDCOM" in platform_ids
    assert "GUE_AO" in platform_ids
    assert "SEPE_AO" in platform_ids
    assert "AGT_PORTAL" in platform_ids

    expired_res = await verifier.execute(
        alvara_number="ALV-2020/00001",
        nif="5417999888",
        alvara_issue_date=today - timedelta(days=800),
        alvara_expiry_date=today - timedelta(days=5),
        probe_remote=False,
    )
    assert expired_res.valid is False
    assert expired_res.status == "EXPIRED"
    assert expired_res.is_expired is True


