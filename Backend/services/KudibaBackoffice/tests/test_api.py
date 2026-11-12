import uuid
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from src.application.alvara_verifier import VerifyAlvaraUseCase
from src.application.commands import CreateClientUseCase, add_one_year, slugify
from src.application.dto import CreateClientCommand
from src.domain.error import DomainError, InvalidModulesError
from src.domain.modules import validate_modules
from src.main import app
from src.presentation.http.routes import record_audit


@pytest.mark.asyncio
async def test_system_audit_trail_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/backoffice/system-audit-trail")
        assert response.status_code == 401


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


@pytest.mark.asyncio
async def test_audit_failure_does_not_break_business_operation():
    class FailingAuditRepo:
        async def record_event(self, **kwargs):
            raise RuntimeError("kudiba_audit indisponível")

    app_state = SimpleNamespace(audit_repo=FailingAuditRepo())

    await record_audit(
        app_state,
        tenant_id=uuid.uuid4(),
        module="BACKOFFICE",
        action="CRIACAO_CLIENTE_PLATAFORMA",
        entity_type="CLIENT",
        entity_id=str(uuid.uuid4()),
    )


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
async def test_create_client_alvara_is_optional_and_validates_dates_when_provided():
    client_repo = _FakeClientRepo()
    license_repo = _FakeLicenseRepo()
    provisioner = _FakeProvisioner()
    use_case = CreateClientUseCase(client_repo, license_repo, provisioner)
    today = date.today()
    issue_date = today - timedelta(days=30)
    expiry_date = today + timedelta(days=365)

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

    result_without_alvara = await use_case.execute(
        CreateClientCommand(
            company_name="Empresa Sem Alvará Lda",
            nif="5417999881",
            modules=["invoicing"],
        )
    )
    assert result_without_alvara.alvara_number is None
    assert result_without_alvara.alvara_issue_date is None
    assert result_without_alvara.alvara_expiry_date is None
    assert result_without_alvara.alvara_status == "MISSING"
    assert provisioner.calls[1]["alvara_number"] is None
    assert provisioner.calls[1]["alvara_issue_date"] is None
    assert provisioner.calls[1]["alvara_expiry_date"] is None


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


class _FakeChartProvisioner:
    def __init__(self):
        self.calls = []

    async def list_templates(self):
        return [
            {
                "code": "PGC_GENERIC",
                "name": "Plano Geral de Contabilidade (PGC)",
                "sector_code": "GERAL",
                "regulator": "MINFIN / AGT",
                "portal_url": "https://portaldocontribuinte.minfin.gov.ao",
                "account_count": 153,
            },
            {
                "code": "PCESR_01_26",
                "name": "Plano de Contas para as Empresas de Seguros e Resseguros (PCESR)",
                "sector_code": "SEGUROS",
                "regulator": "ARSEG",
                "portal_url": "https://www.arseg.ao",
                "account_count": 36,
            },
        ]

    async def provision_chart(self, tenant_id, template_code, *, mode="SEED", applied_by=None):
        self.calls.append({"tenant_id": tenant_id, "template_code": template_code, "mode": mode})
        return 36


@pytest.mark.asyncio
async def test_verify_alvara_auto_infers_dates_when_omitted():
    verifier = VerifyAlvaraUseCase()
    res = await verifier.execute(alvara_number="ALV-2024/09871", probe_remote=False)
    assert res.valid is True
    assert res.auto_filled is True
    assert res.alvara_issue_date == date(2024, 1, 15)
    assert res.alvara_expiry_date == date(2029, 1, 15)
    assert res.days_remaining > 0


@pytest.mark.asyncio
async def test_create_client_auto_fills_dates_and_provisions_sector_chart():
    client_repo = _FakeClientRepo()
    license_repo = _FakeLicenseRepo()
    provisioner = _FakeProvisioner()
    chart_provisioner = _FakeChartProvisioner()
    use_case = CreateClientUseCase(client_repo, license_repo, provisioner, chart_provisioner=chart_provisioner)

    res = await use_case.execute(
        CreateClientCommand(
            company_name="Seguradora Aliança Angolana, S.A.",
            nif="5418123456",
            alvara_number="ALV-2025/00099",
            sector_code="SEGUROS",
            accounting_template_code="PCESR_01_26",
            modules=["invoicing", "accounting"],
        )
    )
    assert res.sector_code == "SEGUROS"
    assert res.accounting_template_code == "PCESR_01_26"
    assert res.alvara_issue_date == date(2025, 1, 15)
    assert res.alvara_expiry_date == date(2030, 1, 15)
    assert len(chart_provisioner.calls) == 1
    assert chart_provisioner.calls[0]["template_code"] == "PCESR_01_26"



