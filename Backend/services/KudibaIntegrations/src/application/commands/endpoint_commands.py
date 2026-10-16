import secrets
from typing import Optional
from uuid import UUID

from src.application.dto import CreateEndpointRequest, UpdateEndpointRequest
from src.domain.entities.integration import IntegrationEndpoint
from src.domain.error import EntityNotFoundError, ValidationError
from src.domain.ports.integration_repository import IntegrationRepository
from src.domain.value_objects.enums import ConnectorType, DataFormat
from src.infrastructure.security.crypto import SecretCipher


def _validate_endpoint(endpoint: IntegrationEndpoint) -> None:
    if endpoint.connector_type == ConnectorType.REST_PULL and not endpoint.source_url:
        raise ValidationError("O conector REST pull exige o campo 'source_url'.")
    if endpoint.connector_type == ConnectorType.FILE_IMPORT and endpoint.data_format == DataFormat.JSON:
        raise ValidationError(
            "A importação de ficheiros exige 'data_format' CSV ou FIXED_WIDTH."
        )
    if endpoint.connector_type == ConnectorType.FILE_IMPORT and endpoint.data_format == DataFormat.FIXED_WIDTH and not endpoint.column_widths:
        raise ValidationError("A importação de largura fixa exige 'column_widths'.")


class CreateEndpointUseCase:
    def __init__(self, repository: IntegrationRepository, cipher: SecretCipher):
        self.repository = repository
        self.cipher = cipher

    async def execute(self, tenant_id: UUID, req: CreateEndpointRequest) -> IntegrationEndpoint:
        webhook_key = None
        if req.connector_type == ConnectorType.WEBHOOK:
            webhook_key = secrets.token_urlsafe(24)

        endpoint = IntegrationEndpoint.create(
            tenant_id=tenant_id,
            name=req.name,
            system_type=req.system_type,
            connector_type=req.connector_type,
            description=req.description,
            is_enabled=req.is_enabled,
            auth_type=req.auth_type,
            encrypted_credentials=self.cipher.encrypt_dict(req.credentials),
            webhook_key=webhook_key,
            webhook_header_name=req.webhook_header_name,
            webhook_secret=req.webhook_secret,
            source_url=req.source_url,
            http_method=req.http_method,
            request_headers=req.request_headers,
            query_params=req.query_params,
            schedule_interval_seconds=req.schedule_interval_seconds,
            data_format=req.data_format,
            file_delimiter=req.file_delimiter,
            file_has_header=req.file_has_header,
            file_encoding=req.file_encoding,
            column_widths=req.column_widths,
        )
        _validate_endpoint(endpoint)
        await self.repository.save_endpoint(endpoint)
        return endpoint


class UpdateEndpointUseCase:
    def __init__(self, repository: IntegrationRepository, cipher: SecretCipher):
        self.repository = repository
        self.cipher = cipher

    async def execute(
        self, tenant_id: UUID, endpoint_id: UUID, req: UpdateEndpointRequest
    ) -> IntegrationEndpoint:
        endpoint = await self.repository.get_endpoint(tenant_id, endpoint_id)
        if not endpoint:
            raise EntityNotFoundError("Ponto de Integração", str(endpoint_id))

        data = req.model_dump(exclude_unset=True)
        credentials = data.pop("credentials", None)

        for field, value in data.items():
            setattr(endpoint, field, value)

        if credentials is not None:
            endpoint.encrypted_credentials = self.cipher.encrypt_dict(credentials)

        _validate_endpoint(endpoint)
        await self.repository.save_endpoint(endpoint)
        return endpoint


class DeleteEndpointUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(self, tenant_id: UUID, endpoint_id: UUID) -> None:
        deleted = await self.repository.delete_endpoint(tenant_id, endpoint_id)
        if not deleted:
            raise EntityNotFoundError("Ponto de Integração", str(endpoint_id))
