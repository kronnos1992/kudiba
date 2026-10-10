import uuid
from datetime import timedelta
import pytest
from pydantic import ValidationError
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher
from src.infrastructure.security.jwt_service import JwtTokenService
from src.config import Settings


def test_production_requires_strong_jwt_secret_and_explicit_origins():
    with pytest.raises(ValidationError):
        Settings(environment="production")

    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            jwt_secret="a" * 32,
            cors_allowed_origins=["*"],
        )

    settings = Settings(
        environment="production",
        jwt_secret="production-test-secret-with-at-least-32-bytes",
        database_url="postgresql+asyncpg://auth:secret@db.internal:5432/kudiba_auth",
        redis_url="redis://redis.internal:6379/0",
        cors_allowed_origins=["https://app.example.ao"],
    )
    assert settings.environment == "production"

    with pytest.raises(ValidationError, match="DATABASE_URL and REDIS_URL"):
        Settings(
            environment="production",
            jwt_secret="production-test-secret-with-at-least-32-bytes",
            cors_allowed_origins=["https://app.example.ao"],
        )

    csv_settings = Settings(cors_allowed_origins="https://app.example.ao, https://admin.example.ao")
    assert csv_settings.cors_allowed_origins == [
        "https://app.example.ao",
        "https://admin.example.ao",
    ]


def test_password_hashing_and_verification():
    hasher = Argon2PasswordHasher()
    password = "MinhaSenhaSuperSecreta@2026"
    h = hasher.hash(password)

    # O hash deve ser Argon2id
    assert h.startswith("$argon2id$")

    # Verificação com senha correta
    assert hasher.verify(password, h) is True

    # Verificação com senha incorreta
    assert hasher.verify("SenhaErrada", h) is False


def test_jwt_access_token_creation_and_kudiba_claims_compatibility():
    jwt_svc = JwtTokenService(secret="test_secret_key_2026_with_more_than_32_bytes", default_access_expiration_minutes=15)
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())
    branch_id = str(uuid.uuid4())
    roles = ["admin", "contabilista"]
    permissions = ["invoices:issue", "invoices:cancel", "fiscal:saft:export"]
    tenant_slug = "empresa-demo"

    token, jti, exp = jwt_svc.create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=roles,
        permissions=permissions,
        tenant_slug=tenant_slug,
        branch_id=branch_id,
    )

    assert isinstance(token, str)
    assert isinstance(jti, str)
    assert exp > 0

    # Decodificação e verificação dos claims exigidos pelo Gateway Rust
    claims = jwt_svc.decode_access_token(token)

    assert claims["sub"] == user_id
    assert claims["tenant_id"] == tenant_id
    assert claims["tenant_slug"] == tenant_slug
    assert claims["branch_id"] == branch_id
    assert claims["roles"] == ["ADMIN", "CONTABILISTA"]  # Normalizado em maiúsculas
    assert claims["permissions"] == permissions
    assert claims["jti"] == jti
    assert "exp" in claims
    assert "iat" in claims


def test_jwt_expired_token():
    jwt_svc = JwtTokenService(secret="test_secret_key_2026_with_more_than_32_bytes", default_access_expiration_minutes=-1)
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    # Token com expiração no passado
    token, _, _ = jwt_svc.create_access_token(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=["OPERADOR_CAIXA"],
        permissions=[],
    )

    import jwt
    with pytest.raises(jwt.ExpiredSignatureError):
        jwt_svc.decode_access_token(token)


def test_refresh_token_generation_and_hashing():
    jwt_svc = JwtTokenService(secret="test_secret_key_2026_with_more_than_32_bytes")
    raw_token, token_hash = jwt_svc.generate_refresh_token()

    assert len(raw_token) >= 40
    assert len(token_hash) == 64  # SHA-256 hex digest

    # Determinismo do hash
    assert jwt_svc.hash_refresh_token(raw_token) == token_hash
    assert jwt_svc.hash_refresh_token("outro_token") != token_hash
