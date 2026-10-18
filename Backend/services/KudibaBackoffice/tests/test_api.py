from datetime import date

import pytest
from httpx import ASGITransport, AsyncClient

from src.application.commands import add_one_year, slugify
from src.domain.error import InvalidModulesError
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
