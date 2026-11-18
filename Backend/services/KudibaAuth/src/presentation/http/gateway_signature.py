import hashlib
import hmac
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

MAX_SIGNATURE_AGE_SECS = 300
MAX_SIGNATURE_BODY_BYTES = 10 * 1024 * 1024
PUBLIC_PREFIXES = (
    "/health",
    "/ready",
    "/docs",
    "/redoc",
    "/scalar",
    "/openapi.json",
    "/api-docs",
)


def canonical_request(
    timestamp: str, method: str, raw_path: bytes, query_string: bytes, body: bytes
) -> str:
    path = bytes(raw_path).split(b"?", 1)[0].decode("latin-1")
    query = bytes(query_string).decode("latin-1")
    digest = hashlib.sha256(body).hexdigest()
    return f"{timestamp}:{method}:{path}:{query}:{digest}"


def install_gateway_signature_middleware(app: FastAPI, secret: str, enforce: bool) -> None:
    @app.middleware("http")
    async def gateway_signature_middleware(request: Request, call_next):
        path = request.url.path
        if not enforce or request.method == "OPTIONS" or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        raw_headers = request.scope.get("headers", [])
        signature_values = [
            value for name, value in raw_headers if name.lower() == b"x-gateway-signature"
        ]
        timestamp_values = [
            value for name, value in raw_headers if name.lower() == b"x-gateway-timestamp"
        ]
        if len(signature_values) != 1 or len(timestamp_values) != 1:
            return JSONResponse(
                status_code=401,
                content={"detail": "Assinatura perimétrica do Gateway ausente ou duplicada."},
            )

        signature = signature_values[0].decode("latin-1")
        timestamp = timestamp_values[0].decode("latin-1")
        try:
            timestamp_secs = int(timestamp)
        except ValueError:
            return JSONResponse(status_code=401, content={"detail": "Timestamp perimétrico inválido."})

        if abs(int(time.time()) - timestamp_secs) > MAX_SIGNATURE_AGE_SECS:
            return JSONResponse(status_code=401, content={"detail": "Timestamp perimétrico expirado."})

        body = await request.body()
        if len(body) > MAX_SIGNATURE_BODY_BYTES:
            return JSONResponse(
                status_code=413,
                content={"detail": "Corpo da requisição excede o limite para validação da assinatura."},
            )

        canonical = canonical_request(
            timestamp,
            request.method,
            request.scope.get("raw_path") or path.encode("latin-1"),
            request.scope.get("query_string", b""),
            body,
        )
        expected = hmac.new(secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return JSONResponse(status_code=401, content={"detail": "Assinatura perimétrica inválida."})

        return await call_next(request)
