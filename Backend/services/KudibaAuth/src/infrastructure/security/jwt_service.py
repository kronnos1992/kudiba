import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jwt.algorithms import RSAAlgorithm
import jwt
from src.domain.ports.token_service import ITokenService
from src.domain.value_objects.token_claims import KudibaClaims


class JwtTokenService(ITokenService):
    """Implementação concreta de ITokenService para emissão de JWT compatíveis com o Gateway e validação via JWKS."""
    def __init__(
        self,
        secret: str,
        algorithm: str = "HS256",
        default_access_expiration_minutes: int = 15,
        key_id: str = "kudiba-auth-key-1",
        rsa_private_key_pem: Optional[str] = None,
    ):
        self.secret = secret
        self.algorithm = algorithm
        self.default_access_expiration_minutes = default_access_expiration_minutes
        self.key_id = key_id

        if rsa_private_key_pem:
            self._rsa_private_key = serialization.load_pem_private_key(
                rsa_private_key_pem.encode("utf-8"),
                password=None,
            )
        else:
            self._rsa_private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
        self._rsa_public_key = self._rsa_private_key.public_key()
        self._rsa_public_pem = self._rsa_public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        self._rsa_private_pem = self._rsa_private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )

    def get_jwks(self) -> Dict[str, Any]:
        """Gera o JWKS oficial com chave pública RSA para validação local assíncrona pelos microsserviços."""
        jwk = json.loads(RSAAlgorithm.to_jwk(self._rsa_public_key))
        jwk["kid"] = self.key_id
        jwk["use"] = "sig"
        jwk["alg"] = "RS256"
        return {"keys": [jwk]}

    def create_access_token(
        self,
        user_id: str,
        tenant_id: str,
        roles: List[str],
        permissions: List[str],
        tenant_slug: Optional[str] = None,
        branch_id: Optional[str] = None,
        expires_minutes: Optional[int] = None,
        modules: Optional[List[str]] = None,
        aud: Optional[str] = None,
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
            modules=modules,
            aud=aud,
        )

        headers = {"kid": self.key_id}
        if self.algorithm == "RS256":
            token = jwt.encode(claims.to_dict(), self._rsa_private_pem, algorithm="RS256", headers=headers)
        else:
            token = jwt.encode(claims.to_dict(), self.secret, algorithm=self.algorithm, headers=headers)
        return token, token_jti, exp_timestamp

    def decode_access_token(self, token: str) -> Dict[str, Any]:
        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg", self.algorithm)
        except Exception:
            alg = self.algorithm

        if alg == "RS256":
            return jwt.decode(
                token,
                self._rsa_public_pem,
                algorithms=["RS256"],
                options={"require": ["sub", "tenant_id", "exp", "jti"], "verify_aud": False},
            )
        return jwt.decode(
            token,
            self.secret,
            algorithms=[self.algorithm, "HS256"],
            options={"require": ["sub", "tenant_id", "exp", "jti"], "verify_aud": False},
        )

    def generate_refresh_token(self) -> Tuple[str, str]:
        raw_token = secrets.token_urlsafe(48)
        token_hash = self.hash_refresh_token(raw_token)
        return raw_token, token_hash

    def hash_refresh_token(self, raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
