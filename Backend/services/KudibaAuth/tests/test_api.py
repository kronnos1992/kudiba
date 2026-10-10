import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app
from src.domain.error import AuthorizationError
from src.presentation.http.deps import SecurityContext, ensure_role_grant_is_allowed


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "UP"
        assert data["service"] == "kudiba-auth"


@pytest.mark.asyncio
async def test_login_validation_error():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Envio de corpo inválido (senha muito curta)
        response = await ac.post("/auth/login", json={"email": "invalido", "password": "123"})
        assert response.status_code == 422  # Unprocessable Entity (validação Pydantic)
        assert response.json()["code"] == "UNPROCESSABLE_ENTITY"
        assert "errors" in response.json()


@pytest.mark.asyncio
async def test_unauthorized_endpoints():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Acesso sem token
        response = await ac.get("/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert data["code"] == "UNAUTHORIZED"
        assert "detail" in data


def test_only_admin_can_grant_admin_role():
    claims = {
        "sub": "00000000-0000-0000-0000-000000000001",
        "tenant_id": "00000000-0000-0000-0000-000000000002",
        "roles": ["OPERADOR_CAIXA"],
        "permissions": ["users:invite"],
    }
    with pytest.raises(AuthorizationError):
        ensure_role_grant_is_allowed(SecurityContext(claims), ["ADMIN"])

    claims["roles"] = ["ADMIN"]
    ensure_role_grant_is_allowed(SecurityContext(claims), ["ADMIN"])
