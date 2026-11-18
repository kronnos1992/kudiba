import hashlib
import hmac
import time

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.presentation.http.gateway_signature import install_gateway_signature_middleware

SECRET = "test-secret"


def signed_headers(
    method: str,
    path: bytes,
    query: str = "",
    body: bytes = b"",
    secret: str = SECRET,
) -> dict[str, str]:
    timestamp = str(int(time.time()))
    canonical = (
        f"{timestamp}:{method}:{path.decode('latin-1')}:{query}:"
        f"{hashlib.sha256(body).hexdigest()}"
    )
    signature = hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return {"X-Gateway-Timestamp": timestamp, "X-Gateway-Signature": signature}


def build_app(enforce: bool) -> FastAPI:
    app = FastAPI()
    install_gateway_signature_middleware(app, SECRET, enforce)

    @app.get("/health")
    async def health():
        return {"status": "UP"}

    @app.get("/probe")
    async def probe():
        return {"ok": True}

    @app.get("/probe/{value}")
    async def probe_value(value: str):
        return {"value": value}

    @app.post("/echo")
    async def echo(payload: dict):
        return payload

    return app


@pytest.mark.asyncio
async def test_enforcement_rejects_unsigned_request():
    transport = ASGITransport(app=build_app(True))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/probe")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_enforcement_accepts_canonical_signature():
    transport = ASGITransport(app=build_app(True))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/probe", headers=signed_headers("GET", b"/probe"))
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_enforcement_rejects_duplicate_headers():
    transport = ASGITransport(app=build_app(True))
    headers = signed_headers("GET", b"/probe")
    raw = [
        (b"x-gateway-timestamp", headers["X-Gateway-Timestamp"].encode()),
        (b"x-gateway-signature", headers["X-Gateway-Signature"].encode()),
        (b"x-gateway-signature", headers["X-Gateway-Signature"].encode()),
    ]
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/probe", headers=raw)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_body_tampering_is_rejected_and_body_is_replayed():
    transport = ASGITransport(app=build_app(True))
    body = b'{"value":"original"}'
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        valid = await client.post(
            "/echo",
            content=body,
            headers={
                **signed_headers("POST", b"/echo", body=body),
                "content-type": "application/json",
            },
        )
        tampered = await client.post(
            "/echo",
            content=b'{"value":"tampered"}',
            headers={
                **signed_headers("POST", b"/echo", body=body),
                "content-type": "application/json",
            },
        )
    assert valid.status_code == 200
    assert valid.json() == {"value": "original"}
    assert tampered.status_code == 401


@pytest.mark.asyncio
async def test_query_tampering_is_rejected():
    transport = ASGITransport(app=build_app(True))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        valid = await client.get(
            "/probe",
            params={"limit": "1"},
            headers=signed_headers("GET", b"/probe", query="limit=1"),
        )
        tampered = await client.get(
            "/probe",
            params={"limit": "2"},
            headers=signed_headers("GET", b"/probe", query="limit=1"),
        )
    assert valid.status_code == 200
    assert tampered.status_code == 401


@pytest.mark.asyncio
async def test_encoded_path_uses_the_raw_uri_path():
    transport = ASGITransport(app=build_app(True))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        valid = await client.get(
            "/probe/a%20b", headers=signed_headers("GET", b"/probe/a%20b")
        )
        decoded = await client.get(
            "/probe/a%20b",
            headers=signed_headers("GET", "/probe/a b".encode("latin-1")),
        )
    assert valid.status_code == 200
    assert decoded.status_code == 401


@pytest.mark.asyncio
async def test_health_is_public_and_absent_signature_is_allowed_when_not_enforced():
    for enforce, path in ((True, "/health"), (False, "/probe")):
        transport = ASGITransport(app=build_app(enforce))
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(path)
        assert response.status_code == 200
