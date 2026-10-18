import uuid
from dataclasses import dataclass
from typing import Any, Dict, Optional

import jwt as pyjwt
from fastapi import Header, Request

from src.domain.error import ForbiddenError, UnauthorizedError
from src.state import AppState


def get_app_state(request: Request) -> AppState:
    return request.app.state.app_state


@dataclass(frozen=True)
class SecurityContext:
    user_id: uuid.UUID
    claims: Dict[str, Any]


def _extract_bearer(authorization: Optional[str]) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError("Cabeçalho de Autorização ausente ou em formato inválido.")
    return authorization[7:].strip()


async def get_security_context(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> SecurityContext:
    app_state = get_app_state(request)
    token = _extract_bearer(authorization)
    try:
        claims = app_state.jwt_service.decode_access_token(token)
    except pyjwt.PyJWTError:
        raise UnauthorizedError("Token inválido ou expirado.")
    try:
        user_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError):
        raise UnauthorizedError("Token inválido ou expirado.")
    return SecurityContext(user_id=user_id, claims=claims)


async def require_platform_admin(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> SecurityContext:
    ctx = await get_security_context(request, authorization)
    app_state = get_app_state(request)
    if not await app_state.tenant_provisioner.is_platform_admin(ctx.user_id):
        raise ForbiddenError()
    return ctx
