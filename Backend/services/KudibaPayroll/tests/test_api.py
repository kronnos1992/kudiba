import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "UP"
        assert data["service"] == "kudiba-payroll"


@pytest.mark.asyncio
async def test_missing_tenant_header():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/payroll/employees")
        assert response.status_code == 400
        data = response.json()
        assert "X-Resolved-Tenant-ID" in data["detail"] or "X-Tenant-ID" in data["detail"]


@pytest.mark.asyncio
async def test_create_employee_validation_error():
    transport = ASGITransport(app=app)
    headers = {"X-Resolved-Tenant-ID": "00000000-0000-0000-0000-000000000001"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Faltam campos obrigatórios
        response = await ac.post("/api/v1/payroll/employees", json={}, headers=headers)
        assert response.status_code == 422
        data = response.json()
        assert data["code"] == "VALIDATION_ERROR"
