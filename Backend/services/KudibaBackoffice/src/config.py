import json
from functools import lru_cache
from typing import Annotated, List

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_DEVELOPMENT_JWT_SECRET = "kudiba_jwt_secret_development_key_change_in_production_2026"
_DEVELOPMENT_CORS_ORIGINS = {"http://localhost:3000", "http://localhost:5173"}
_DEVELOPMENT_DATABASE_URL = "postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_backoffice"
_DEVELOPMENT_AUTH_DATABASE_URL = "postgresql+asyncpg://kudiba:kudiba_secret_pass@localhost:5432/kudiba_auth"


class Settings(BaseSettings):
    port: int = 8088
    environment: str = "development"
    database_url: str = _DEVELOPMENT_DATABASE_URL
    auth_database_url: str = _DEVELOPMENT_AUTH_DATABASE_URL

    jwt_secret: str = _DEVELOPMENT_JWT_SECRET
    jwt_algorithm: str = "HS256"

    cors_allowed_origins: Annotated[List[str], NoDecode] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("["):
                value = json.loads(value)
            else:
                value = [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.environment.lower() in {"prod", "production"}:
            if self.jwt_secret == _DEVELOPMENT_JWT_SECRET or len(self.jwt_secret.encode("utf-8")) < 32:
                raise ValueError("Production requires a JWT_SECRET with at least 32 bytes.")
            if (
                self.database_url == _DEVELOPMENT_DATABASE_URL
                or self.auth_database_url == _DEVELOPMENT_AUTH_DATABASE_URL
            ):
                raise ValueError("Production requires explicit DATABASE_URL and AUTH_DATABASE_URL values.")
            if (
                not self.cors_allowed_origins
                or "*" in self.cors_allowed_origins
                or set(self.cors_allowed_origins).intersection(_DEVELOPMENT_CORS_ORIGINS)
            ):
                raise ValueError("Production requires explicit non-local CORS_ALLOWED_ORIGINS without '*'.")
        return self

    def _to_asyncpg(self, url: str) -> str:
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def async_database_url(self) -> str:
        return self._to_asyncpg(self.database_url)

    @property
    def async_auth_database_url(self) -> str:
        return self._to_asyncpg(self.auth_database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
