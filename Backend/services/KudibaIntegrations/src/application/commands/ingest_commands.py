from datetime import datetime, timezone
from typing import Any, List, Optional
from uuid import UUID

from src.application.ingest_service import IngestService
from src.domain.entities.integration import IntegrationRun
from src.domain.error import (
    EntityNotFoundError,
    IntegrationDisabledError,
    ValidationError,
)
from src.domain.ports.integration_repository import IntegrationRepository
from src.domain.services.file_parser import parse_file
from src.domain.value_objects.enums import ConnectorType, RunStatus, RunTrigger
from src.infrastructure.connectors.rest_pull import RestPullConnector
from src.infrastructure.security.crypto import SecretCipher


class IngestWebhookUseCase:
    def __init__(self, repository: IntegrationRepository, ingest_service: IngestService):
        self.repository = repository
        self.ingest_service = ingest_service

    async def execute(
        self,
        webhook_key: str,
        payload: Any,
        headers: Optional[dict] = None,
    ) -> IntegrationRun:
        endpoint = await self.repository.get_endpoint_by_webhook_key(webhook_key)
        if not endpoint:
            raise EntityNotFoundError("Webhook de Integração", webhook_key)
        if not endpoint.is_enabled:
            raise IntegrationDisabledError()
        if endpoint.webhook_secret:
            header_name = (endpoint.webhook_header_name or "X-Webhook-Secret").lower()
            provided_secret = (headers or {}).get(header_name)
            if not provided_secret or provided_secret != endpoint.webhook_secret:
                raise ValidationError(
                    f"Segredo do webhook inválido ou ausente (cabeçalho '{header_name}')."
                )
        return await self.ingest_service.ingest_payload(endpoint, payload, RunTrigger.WEBHOOK)


class RunPullUseCase:
    def __init__(
        self,
        repository: IntegrationRepository,
        ingest_service: IngestService,
        cipher: SecretCipher,
        connector: Optional[RestPullConnector] = None,
    ):
        self.repository = repository
        self.ingest_service = ingest_service
        self.cipher = cipher
        self.connector = connector or RestPullConnector()

    async def execute(self, trigger: RunTrigger = RunTrigger.SCHEDULE) -> List[IntegrationRun]:
        now = datetime.now(timezone.utc)
        due_endpoints = await self.repository.list_due_endpoints(now)
        runs: List[IntegrationRun] = []
        for endpoint in due_endpoints:
            runs.append(await self._run_endpoint(endpoint, trigger))
        return runs

    async def execute_endpoint(
        self, tenant_id: UUID, endpoint_id: UUID, trigger: RunTrigger = RunTrigger.MANUAL
    ) -> IntegrationRun:
        endpoint = await self.repository.get_endpoint(tenant_id, endpoint_id)
        if not endpoint:
            raise EntityNotFoundError("Ponto de Integração", str(endpoint_id))
        if endpoint.connector_type != ConnectorType.REST_PULL:
            raise ValidationError("Este ponto de integração não é do tipo REST pull.")
        if not endpoint.is_enabled:
            raise IntegrationDisabledError()
        return await self._run_endpoint(endpoint, trigger)

    async def _run_endpoint(self, endpoint, trigger: RunTrigger) -> IntegrationRun:
        run = IntegrationRun.start(endpoint.tenant_id, endpoint.id, trigger)
        try:
            credentials = self.cipher.decrypt_dict(endpoint.encrypted_credentials)
            auth_headers = self.connector.build_auth(endpoint.auth_type, credentials)
            payload = await self.connector.fetch(endpoint, auth_headers)
        except Exception as exc:
            run.complete(RunStatus.FAILED, f"Falha ao consultar o sistema externo: {exc}")
            await self.repository.save_run(run)
            endpoint.mark_run()
            await self.repository.save_endpoint(endpoint)
            return run

        result = await self.ingest_service.ingest_payload(endpoint, payload, trigger)
        endpoint.mark_run()
        await self.repository.save_endpoint(endpoint)
        return result


class ImportFileUseCase:
    def __init__(self, repository: IntegrationRepository, ingest_service: IngestService):
        self.repository = repository
        self.ingest_service = ingest_service

    async def execute(
        self, tenant_id: UUID, endpoint_id: UUID, content: bytes
    ) -> IntegrationRun:
        endpoint = await self.repository.get_endpoint(tenant_id, endpoint_id)
        if not endpoint:
            raise EntityNotFoundError("Ponto de Integração", str(endpoint_id))
        if endpoint.connector_type != ConnectorType.FILE_IMPORT:
            raise ValidationError("Este ponto de integração não é do tipo importação de ficheiro.")
        if not endpoint.is_enabled:
            raise IntegrationDisabledError()

        records = parse_file(
            content=content,
            data_format=endpoint.data_format,
            delimiter=endpoint.file_delimiter or ",",
            has_header=endpoint.file_has_header,
            encoding=endpoint.file_encoding,
            column_widths=endpoint.column_widths,
        )
        return await self.ingest_service.ingest_payload(endpoint, records, RunTrigger.MANUAL)
