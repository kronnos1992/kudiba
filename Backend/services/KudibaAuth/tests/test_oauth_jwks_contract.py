import json
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from src.main import app


@pytest.mark.asyncio
async def test_jwks_endpoint_and_well_known():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # GET /.well-known/jwks.json
        res_root = await ac.get("/.well-known/jwks.json")
        assert res_root.status_code == 200
        data = res_root.json()
        assert "keys" in data
        assert len(data["keys"]) > 0
        key = data["keys"][0]
        assert key["kty"] == "RSA"
        assert key["alg"] == "RS256"
        assert key["use"] == "sig"
        assert "n" in key
        assert "e" in key
        assert "kid" in key

        # GET /auth/.well-known/jwks.json
        res_auth = await ac.get("/auth/.well-known/jwks.json")
        assert res_auth.status_code == 200
        assert res_auth.json() == data

        # GET /.well-known/openid-configuration
        res_oidc = await ac.get("/.well-known/openid-configuration")
        assert res_oidc.status_code == 200
        oidc_data = res_oidc.json()
        assert "authorization_endpoint" in oidc_data
        assert "token_endpoint" in oidc_data
        assert "userinfo_endpoint" in oidc_data
        assert "jwks_uri" in oidc_data


@pytest.mark.asyncio
async def test_authorize_requires_session():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/authorize?client_id=gsin")
        assert res.status_code == 401
        assert res.json()["code"] == "UNAUTHORIZED"

        res_auth = await ac.get("/auth/authorize?client_id=gsin")
        assert res_auth.status_code == 401


@pytest.mark.asyncio
async def test_authorize_and_token_exchange_code_flow():
    app_state = app.state.app_state
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    initial_token, _, _ = app_state.token_service.create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=["ADMIN"],
        permissions=["invoices:read", "pos:operator"],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. /authorize (JSON output)
        res_auth = await ac.get(
            "/authorize?client_id=gsin&state=xyz987",
            headers={"Authorization": f"Bearer {initial_token}"},
        )
        assert res_auth.status_code == 200
        auth_data = res_auth.json()
        assert "code" in auth_data
        assert auth_data["client_id"] == "gsin"
        assert auth_data["state"] == "xyz987"
        code = auth_data["code"]

        # 2. /token troca do code por token com aud="gsin"
        res_token = await ac.post(
            "/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": "gsin",
            },
        )
        assert res_token.status_code == 200
        token_data = res_token.json()
        assert "access_token" in token_data
        assert "refresh_token" in token_data
        assert token_data["aud"] == "gsin"
        assert token_data["token_type"] == "Bearer"

        # 3. Validação do aud no access_token recebido
        received_jwt = token_data["access_token"]
        claims = app_state.token_service.decode_access_token(received_jwt)
        assert claims["aud"] == "gsin"
        assert claims["sub"] == user_id
        assert claims["tenant_id"] == tenant_id

        # 4. Código deve ser de uso único (segurança OAuth 2.0)
        res_replay = await ac.post(
            "/token",
            json={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": "gsin",
            },
        )
        assert res_replay.status_code == 400
        assert "Código de autorização inválido ou expirado" in res_replay.json()["detail"]


@pytest.mark.asyncio
async def test_authorize_redirect_uri_support():
    app_state = app.state.app_state
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    token, _, _ = app_state.token_service.create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=["SYSADMIN"],
        permissions=["all"],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get(
            "/authorize?client_id=gsin&redirect_uri=https://portal.kudiba.ao/oauth/callback&state=sec123",
            headers={"Authorization": f"Bearer {token}"},
            follow_redirects=False,
        )
        assert res.status_code == 302
        location = res.headers["location"]
        assert location.startswith("https://portal.kudiba.ao/oauth/callback?")
        assert "code=" in location
        assert "state=sec123" in location


@pytest.mark.asyncio
async def test_userinfo_endpoint():
    app_state = app.state.app_state
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()

    token, _, _ = app_state.token_service.create_access_token(
        user_id=str(user_id),
        tenant_id=str(tenant_id),
        roles=["ADMIN"],
        permissions=["invoices:create"],
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Sem autenticação
        res_unauth = await ac.get("/userinfo")
        assert res_unauth.status_code == 401

        # Com Bearer token válido
        res_info = await ac.get("/userinfo", headers={"Authorization": f"Bearer {token}"})
        assert res_info.status_code == 200
        info = res_info.json()
        assert info["sub"] == str(user_id)
        assert info["papel_global"] == "ADMIN"
        assert "roles" in info
        assert "tenant_id" in info
        assert "email" in info
        assert "nome" in info


@pytest.mark.asyncio
async def test_root_logout_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/logout", json={})
        assert res.status_code == 204
