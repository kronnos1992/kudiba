from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEVELOPMENT_DATABASE_URL = "postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_payroll"


class Settings(BaseSettings):
    port: int = 8086
    environment: str = "development"
    database_url: str = _DEVELOPMENT_DATABASE_URL
    rabbitmq_url: Optional[str] = "amqp://kudiba:kudiba_rabbit_pass@localhost:5672/%2f"
    event_exchange: str = "fiscal.events"
    attendance_queue: str = "kudiba.payroll.attendance"
    attendance_consumer_enabled: bool = True
    jwt_secret: str = "kudiba_jwt_secret_development_key_change_in_production_2026"
    jwt_algorithm: str = "HS256"
    internal_gateway_secret: str = "kudiba_internal_gateway_secret_development_key_change_in_production_2026"
    enforce_gateway_signature: bool = False


    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

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
