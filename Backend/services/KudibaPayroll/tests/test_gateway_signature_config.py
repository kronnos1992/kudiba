import pytest
from pydantic import ValidationError

from src.config import Settings

DEVELOPMENT_SECRET = "kudiba_internal_gateway_secret_development_key_change_in_production_2026"


def test_development_gateway_secret_is_rejected_when_enforcing():
    with pytest.raises(ValidationError, match="INTERNAL_GATEWAY_SECRET"):
        Settings(
            _env_file=None,
            enforce_gateway_signature=True,
            internal_gateway_secret=DEVELOPMENT_SECRET,
        )


def test_development_gateway_secret_is_rejected_in_production():
    with pytest.raises(ValidationError, match="INTERNAL_GATEWAY_SECRET"):
        Settings(
            _env_file=None,
            environment="production",
            enforce_gateway_signature=False,
            internal_gateway_secret=DEVELOPMENT_SECRET,
        )


def test_explicit_secret_is_accepted():
    settings = Settings(
        _env_file=None,
        enforce_gateway_signature=True,
        internal_gateway_secret="explicit-test-secret-with-at-least-32-bytes",
    )
    assert settings.enforce_gateway_signature is True
