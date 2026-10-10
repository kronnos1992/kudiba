import uuid
from typing import Any, Callable, Dict, List, Optional
from fastapi import Header, HTTPException, Request, status

from src.domain.error import AuthorizationError
from src.domain.value_objects.role_type import RoleType


def get_app_state(request: Request):
    """Obtém o container AppState armazenado no app.state."""
    return request.app.state.app_state


def extract_client_ip(request: Request) -> Optional[str]:
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


async def get_current_claims(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cabeçalho de Autorização ausente ou em formato inválido. Utilize 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:].strip()
    app_state = get_app_state(request)
    try:
        claims = app_state.token_service.decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verifica blacklist no Redis
    jti = claims.get("jti")
    if jti and await app_state.cache.is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão encerrada via logout anterior.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verifica se a sessão foi revogada por alteração de papéis (mudança de privilégios)
    sub = claims.get("sub")
    tenant_id = claims.get("tenant_id")
    if sub and tenant_id:
        revoked_before = await app_state.cache.get_revoked_before(str(sub), str(tenant_id))
        if revoked_before and int(claims.get("iat", 0) or 0) < revoked_before:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessão invalidada por alteração de permissões. Inicie sessão novamente.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return claims


class SecurityContext:
    def __init__(self, claims: Dict[str, Any]):
        self.user_id = uuid.UUID(claims["sub"])
        self.tenant_id = uuid.UUID(claims["tenant_id"])
        self.tenant_slug = claims.get("tenant_slug")
        self.branch_id = uuid.UUID(claims["branch_id"]) if claims.get("branch_id") else None
        self.roles: List[str] = [r.upper() for r in claims.get("roles", [])]
        self.permissions: List[str] = claims.get("permissions", [])
        self.jti = claims.get("jti")
        self.exp = claims.get("exp")

    def has_role(self, role: str) -> bool:
        return role.upper() in self.roles or "SUPER_ADMIN" in self.roles

    def has_permission(self, perm: str) -> bool:
        return perm in self.permissions or "ADMIN" in self.roles or "SUPER_ADMIN" in self.roles


def ensure_role_grant_is_allowed(ctx: SecurityContext, roles: List[str]) -> None:
    requested_roles = {role.strip().upper() for role in roles}
    assignable_roles = {role.value for role in RoleType if role is not RoleType.SUPER_ADMIN}
    if not requested_roles.issubset(assignable_roles):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Um ou mais papéis não são válidos.")
    if "ADMIN" in requested_roles and not ctx.has_role("ADMIN"):
        raise AuthorizationError("Apenas um administrador pode atribuir o papel ADMIN.")


async def get_security_context(
    request: Request,
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> SecurityContext:
    claims = await get_current_claims(request, authorization)
    return SecurityContext(claims)


def require_permission(required_perm: str) -> Callable:
    async def _checker(
        request: Request,
        authorization: Optional[str] = Header(None, alias="Authorization"),
    ) -> SecurityContext:
        ctx = await get_security_context(request, authorization)
        if not ctx.has_permission(required_perm):
            raise AuthorizationError(f"Acesso negado: requer a permissão '{required_perm}'.")
        return ctx
    return _checker
