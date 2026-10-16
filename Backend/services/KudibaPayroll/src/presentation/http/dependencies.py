import hashlib
import hmac
import time
from uuid import UUID
from fastapi import Header, HTTPException, Request, status

from src.config import get_settings


def verify_internal_gateway_signature(
    request: Request,
    x_gateway_signature: str | None = Header(None, alias="X-Gateway-Signature"),
    x_gateway_timestamp: str | None = Header(None, alias="X-Gateway-Timestamp"),
) -> None:
    settings = get_settings()
    if not settings.enforce_gateway_signature and not x_gateway_signature:
        return

    if not x_gateway_signature or not x_gateway_timestamp:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura perimétrica do Gateway ausente.",
        )

    try:
        ts = int(x_gateway_timestamp)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Timestamp perimétrico do Gateway inválido.",
        )

    if abs(int(time.time()) - ts) > 300:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Timestamp perimétrico do Gateway expirado ou desincronizado.",
        )

    canonical = f"{x_gateway_timestamp}:{request.method}:{request.url.path}"
    expected = hmac.new(
        settings.internal_gateway_secret.encode("utf-8"),
        canonical.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(x_gateway_signature, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Assinatura perimétrica do Gateway inválida.",
        )


def get_current_tenant_id(
    request: Request,
    x_resolved_tenant_id: str | None = Header(None, alias="X-Resolved-Tenant-ID"),
    x_tenant_id: str | None = Header(None, alias="X-Tenant-ID"),
    x_gateway_signature: str | None = Header(None, alias="X-Gateway-Signature"),
    x_gateway_timestamp: str | None = Header(None, alias="X-Gateway-Timestamp"),
) -> UUID:
    verify_internal_gateway_signature(request, x_gateway_signature, x_gateway_timestamp)
    raw_id = x_resolved_tenant_id or x_tenant_id
    if not raw_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Header 'X-Resolved-Tenant-ID' ou 'X-Tenant-ID' é obrigatório.",
        )
    try:
        return UUID(raw_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Identificador de organização (tenant_id) inválido.",
        )


def get_app_state(request: Request):
    return request.app.state.app_state

