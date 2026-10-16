import logging
from typing import Any, Dict, Optional

import httpx

from src.domain.entities.integration import IntegrationEndpoint
from src.domain.error import ValidationError
from src.domain.value_objects.enums import AuthType

logger = logging.getLogger(__name__)


class RestPullConnector:
    def __init__(self, timeout_seconds: float = 30.0):
        self.timeout_seconds = timeout_seconds

    @staticmethod
    def build_auth(
        auth_type: AuthType, credentials: Dict[str, Any]
    ) -> Dict[str, str]:
        if auth_type == AuthType.NONE:
            return {}
        if auth_type == AuthType.API_KEY:
            header = credentials.get("header_name", "X-API-Key")
            value = credentials.get("api_key", "")
            if not value:
                raise ValidationError("Credenciais API_KEY exigem 'api_key'.")
            return {header: str(value)}
        if auth_type == AuthType.BEARER:
            token = credentials.get("token", "")
            if not token:
                raise ValidationError("Credenciais BEARER exigem 'token'.")
            return {"Authorization": f"Bearer {token}"}
        raise ValidationError(
            "O conector REST pull suporta autenticação NONE, API_KEY ou BEARER."
        )

    async def fetch(
        self, endpoint: IntegrationEndpoint, auth_headers: Optional[Dict[str, str]] = None
    ) -> Any:
        if not endpoint.source_url:
            raise ValidationError("O conector REST pull exige 'source_url' configurado.")

        headers = {str(k): str(v) for k, v in (endpoint.request_headers or {}).items()}
        if auth_headers:
            headers.update(auth_headers)

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.request(
                endpoint.http_method or "GET",
                endpoint.source_url,
                headers=headers,
                params=endpoint.query_params or {},
            )
            response.raise_for_status()
            content_type = response.headers.get("content-type", "")
            if "json" in content_type.lower():
                return response.json()
            try:
                return response.json()
            except ValueError:
                raise ValidationError(
                    "A resposta do sistema externo não está em formato JSON."
                )
