from functools import lru_cache
from typing import Optional
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEVELOPMENT_INTERNAL_GATEWAY_SECRET = "kudiba_internal_gateway_secret_development_key_change_in_production_2026"
_DEVELOPMENT_DATABASE_URL = (
    "postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_integrations"
)


class Settings(BaseSettings):
    port: int = 8087
    environment: str = "development"
    database_url: str = _DEVELOPMENT_DATABASE_URL
    rabbitmq_url: Optional[str] = "amqp://kudiba:kudiba_rabbit_pass@localhost:5672/%2f"
    event_exchange: str = "fiscal.events"
    jwt_secret: str = "kudiba_jwt_secret_development_key_change_in_production_2026"
    jwt_algorithm: str = "HS256"
    internal_gateway_secret: str = _DEVELOPMENT_INTERNAL_GATEWAY_SECRET
    enforce_gateway_signature: bool = True

    integration_encryption_key: Optional[str] = None

    scheduler_enabled: bool = True
    scheduler_tick_seconds: int = 30
    http_timeout_seconds: float = 30.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_gateway_secret(self) -> "Settings":
        is_production = self.environment.lower() in {"prod", "production"}
        if (self.enforce_gateway_signature or is_production) and (
            self.internal_gateway_secret == _DEVELOPMENT_INTERNAL_GATEWAY_SECRET
            or len(self.internal_gateway_secret.encode("utf-8")) < 32
        ):
            raise ValueError(
                "INTERNAL_GATEWAY_SECRET must be an explicit, non-default secret of at least 32 bytes."
            )
        return self

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
