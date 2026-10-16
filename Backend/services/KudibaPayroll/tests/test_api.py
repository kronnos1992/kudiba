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


def test_all_hr_and_payroll_routes_are_registered():
    paths = app.openapi()["paths"]
    expected = [
        "/api/v1/payroll/departments",
        "/api/v1/payroll/job-positions",
        "/api/v1/payroll/employees",
        "/api/v1/payroll/employees/{employee_id}",
        "/api/v1/payroll/employees/{employee_id}/terminate",
        "/api/v1/payroll/employees/{employee_id}/vacation-balance",
        "/api/v1/payroll/contracts",
        "/api/v1/payroll/contracts/{contract_id}",
        "/api/v1/payroll/contracts/{contract_id}/components",
        "/api/v1/payroll/vacations",
        "/api/v1/payroll/vacations/{vacation_id}/approve",
        "/api/v1/payroll/vacations/{vacation_id}/reject",
        "/api/v1/payroll/absences",
        "/api/v1/payroll/attendance",
        "/api/v1/payroll/periods",
        "/api/v1/payroll/periods/{period_id}",
        "/api/v1/payroll/periods/{period_id}/summary",
        "/api/v1/payroll/periods/{period_id}/calculate",
        "/api/v1/payroll/periods/{period_id}/close",
        "/api/v1/payroll/periods/{period_id}/payslips",
        "/api/v1/payroll/periods/{period_id}/ps2",
        "/api/v1/payroll/payslips/{payslip_id}",
        "/api/v1/payroll/payslips/{payslip_id}/pay",
        "/api/v1/payroll/payslips/{payslip_id}/pdf",
    ]
    for path in expected:
        assert path in paths, f"Rota em falta: {path}"


@pytest.mark.asyncio
async def test_gateway_signature_verification():
    import hmac
    import hashlib
    import time
    from src.config import get_settings

    transport = ASGITransport(app=app)
    settings = get_settings()

    now = str(int(time.time()))
    path = "/api/v1/payroll/departments"
    canonical = f"{now}:GET:{path}"
    valid_sig = hmac.new(
        settings.internal_gateway_secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Assinatura válida deve ser aceite
    headers_valid = {
        "X-Resolved-Tenant-ID": "00000000-0000-0000-0000-000000000001",
        "X-Gateway-Timestamp": now,
        "X-Gateway-Signature": valid_sig,
    }
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(path, headers=headers_valid)
        assert resp.status_code == 200

    # Assinatura inválida deve ser rejeitada com 401
    headers_invalid = {
        "X-Resolved-Tenant-ID": "00000000-0000-0000-0000-000000000001",
        "X-Gateway-Timestamp": now,
        "X-Gateway-Signature": "invalid_signature_hex",
    }
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(path, headers=headers_invalid)
        assert resp.status_code == 401
        data = resp.json()
        assert "Assinatura perimétrica do Gateway inválida" in data["detail"]


