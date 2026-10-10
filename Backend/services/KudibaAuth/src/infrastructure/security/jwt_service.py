import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import jwt
from src.domain.ports.token_service import ITokenService
from src.domain.value_objects.token_claims import KudibaClaims


class JwtTokenService(ITokenService):
    """Implementação concreta de ITokenService para emissão de JWT compatíveis com o Gateway."""
    def __init__(
        self,
        secret: str,
        algorithm: str = "HS256",
        default_access_expiration_minutes: int = 15,
    ):
        self.secret = secret
        self.algorithm = algorithm
        self.default_access_expiration_minutes = default_access_expiration_minutes

    def create_access_token(
        self,
        user_id: str,
        tenant_id: str,
        roles: List[str],
        permissions: List[str],
        tenant_slug: Optional[str] = None,
        branch_id: Optional[str] = None,
        expires_minutes: Optional[int] = None,
    ) -> Tuple[str, str, int]:
        now = datetime.now(timezone.utc)
        mins = expires_minutes or self.default_access_expiration_minutes
        expire = now + timedelta(minutes=mins)

        token_jti = str(uuid.uuid4())
        exp_timestamp = int(expire.timestamp())
        iat_timestamp = int(now.timestamp())

        claims = KudibaClaims(
            sub=str(user_id),
            tenant_id=str(tenant_id),
            tenant_slug=tenant_slug,
            branch_id=str(branch_id) if branch_id else None,
            roles=roles,
            permissions=permissions,
            exp=exp_timestamp,
            iat=iat_timestamp,
            jti=token_jti,
        )

        token = jwt.encode(claims.to_dict(), self.secret, algorithm=self.algorithm)
        return token, token_jti, exp_timestamp

    def decode_access_token(self, token: str) -> Dict[str, Any]:
        return jwt.decode(
            token,
            self.secret,
            algorithms=[self.algorithm],
            options={"require": ["sub", "tenant_id", "exp", "jti"]},
        )

    def generate_refresh_token(self) -> Tuple[str, str]:
        raw_token = secrets.token_urlsafe(48)
        token_hash = self.hash_refresh_token(raw_token)
        return raw_token, token_hash

    def hash_refresh_token(self, raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
