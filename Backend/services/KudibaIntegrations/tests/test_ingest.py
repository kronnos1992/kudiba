from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import pytest

from src.application.commands.ingest_commands import (
    ImportFileUseCase,
    IngestWebhookUseCase,
    RunPullUseCase,
)
from src.application.ingest_service import IngestService
from src.domain.entities.integration import IntegrationEndpoint, IntegrationMapping
from src.domain.error import (
    EntityNotFoundError,
    IntegrationDisabledError,
    ValidationError,
)
from src.domain.value_objects.enums import (
    AuthType,
    ConnectorType,
    DataFormat,
    RunStatus,
    RunTrigger,
)
from src.infrastructure.security import SecretCipher
from tests.fakes import FakeEventPublisher, InMemoryIntegrationRepository

TENANT = uuid4()
ATTENDANCE_FIELD_MAPPINGS = [
    {"target": "employee_code", "source": "employee_code", "type": "string", "required": True},
    {"target": "punched_at", "source": "punched_at", "type": "datetime", "required": True},
    {"target": "direction", "source": "direction", "type": "string", "value_map": {"E": "IN", "S": "OUT"}},
    {"target": "device", "const": "RELOGIO-PONTO-01"},
]
ATTENDANCE_PAYLOAD = [
    {"employee_code": "EMP001", "punched_at": "2025-03-01T07:59:00", "direction": "E"},
    {"employee_code": "EMP001", "punched_at": "2025-03-01T17:01:00", "direction": "S"},
]


def make_endpoint(**overrides) -> IntegrationEndpoint:
    defaults: Dict[str, Any] = {
        "tenant_id": TENANT,
        "name": "Relógio de Ponto",
        "system_type": "ATTENDANCE",
        "connector_type": ConnectorType.WEBHOOK,
        "webhook_key": "whk_attendance_001",
        "webhook_secret": "s3cret",
        "webhook_header_name": "X-Webhook-Secret",
        "is_enabled": True,
    }
    defaults.update(overrides)
    return IntegrationEndpoint.create(**defaults)


def make_mapping(endpoint: IntegrationEndpoint, **overrides) -> IntegrationMapping:
    defaults: Dict[str, Any] = {
        "tenant_id": TENANT,
        "endpoint_id": endpoint.id,
        "name": "Batidas de ponto",
        "entity_type": "ATTENDANCE",
        "target_event_type": "attendance.recorded",
        "target_routing_key": "payroll.event.attendance.recorded",
        "record_path": "records",
        "field_mappings": ATTENDANCE_FIELD_MAPPINGS,
        "dedup_fields": ["employee_code", "punched_at", "direction"],
        "static_payload": {"company_id": "KUDIBA"},
    }
    defaults.update(overrides)
    return IntegrationMapping.create(**defaults)


async def seed(repository: InMemoryIntegrationRepository, **endpoint_overrides):
    endpoint = make_endpoint(**endpoint_overrides)
    mapping = make_mapping(endpoint)
    await repository.save_endpoint(endpoint)
    await repository.save_mapping(mapping)
    return endpoint, mapping


@pytest.mark.asyncio
async def test_ingest_publishes_envelope_and_records_successful_run():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    service = IngestService(repository, publisher)

    run = await service.ingest_payload(
        endpoint, {"records": ATTENDANCE_PAYLOAD}, RunTrigger.WEBHOOK
    )

    assert run.status == RunStatus.SUCCESS
    assert run.records_received == 2
    assert run.records_succeeded == 2
    assert run.records_failed == 0
    assert run.finished_at is not None
    assert len(repository.runs) == 1

    assert len(publisher.published) == 2
    first = publisher.published[0]
    assert first["routing_key"] == "payroll.event.attendance.recorded"
    envelope = first["payload"]
    assert envelope["event_type"] == "attendance.recorded"
    assert envelope["tenant_id"] == str(TENANT)
    assert envelope["source"] == "Relógio de Ponto"
    assert envelope["source_system_type"] == "ATTENDANCE"
    assert envelope["payload"]["company_id"] == "KUDIBA"
    assert envelope["payload"]["direction"] == "IN"
    assert envelope["payload"]["device"] == "RELOGIO-PONTO-01"
    assert envelope["payload"]["punched_at"] == "2025-03-01T07:59:00+00:00"


@pytest.mark.asyncio
async def test_ingest_skips_duplicates_on_second_run():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    service = IngestService(repository, publisher)

    await service.ingest_payload(endpoint, {"records": ATTENDANCE_PAYLOAD}, RunTrigger.WEBHOOK)
    second = await service.ingest_payload(
        endpoint, {"records": ATTENDANCE_PAYLOAD}, RunTrigger.WEBHOOK
    )

    assert second.records_skipped == 2
    assert second.records_succeeded == 0
    assert second.status == RunStatus.SUCCESS
    assert len(publisher.published) == 2


@pytest.mark.asyncio
async def test_ingest_partial_status_when_a_record_fails():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    service = IngestService(repository, publisher)

    payload = {
        "records": [
            {"employee_code": "EMP001", "punched_at": "2025-03-01T07:59:00", "direction": "E"},
            {"employee_code": "EMP002", "direction": "S"},
        ]
    }
    run = await service.ingest_payload(endpoint, payload, RunTrigger.WEBHOOK)

    assert run.status == RunStatus.PARTIAL
    assert run.records_succeeded == 1
    assert run.records_failed == 1
    assert run.message and "obrigatório" in run.message
    assert len(publisher.published) == 1


@pytest.mark.asyncio
async def test_ingest_failed_status_when_no_record_is_valid():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    service = IngestService(repository, publisher)

    run = await service.ingest_payload(endpoint, {"records": [{"foo": "bar"}]}, RunTrigger.WEBHOOK)
    assert run.status == RunStatus.FAILED
    assert len(publisher.published) == 0


@pytest.mark.asyncio
async def test_ingest_with_no_active_mappings_reports_message():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    mapping.is_enabled = False
    await repository.save_mapping(mapping)
    service = IngestService(repository, publisher)

    run = await service.ingest_payload(endpoint, {"records": ATTENDANCE_PAYLOAD}, RunTrigger.WEBHOOK)
    assert run.status == RunStatus.SUCCESS
    assert run.message and "Nenhum registo" in run.message


@pytest.mark.asyncio
async def test_webhook_happy_path_validates_secret_header():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    use_case = IngestWebhookUseCase(repository, IngestService(repository, publisher))

    run = await use_case.execute(
        endpoint.webhook_key,
        {"records": ATTENDANCE_PAYLOAD},
        headers={"x-webhook-secret": "s3cret"},
    )
    assert run.status == RunStatus.SUCCESS
    assert run.trigger == RunTrigger.WEBHOOK
    assert run.records_succeeded == 2


@pytest.mark.asyncio
async def test_webhook_rejects_wrong_or_missing_secret():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    use_case = IngestWebhookUseCase(repository, IngestService(repository, publisher))

    with pytest.raises(ValidationError):
        await use_case.execute(endpoint.webhook_key, {"records": []}, headers={"x-webhook-secret": "nope"})
    with pytest.raises(ValidationError):
        await use_case.execute(endpoint.webhook_key, {"records": []}, headers={})
    assert publisher.published == []


@pytest.mark.asyncio
async def test_webhook_without_configured_secret_skips_validation():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository, webhook_secret=None)
    use_case = IngestWebhookUseCase(repository, IngestService(repository, publisher))

    run = await use_case.execute(endpoint.webhook_key, {"records": ATTENDANCE_PAYLOAD}, headers={})
    assert run.status == RunStatus.SUCCESS


@pytest.mark.asyncio
async def test_webhook_unknown_key_and_disabled_endpoint():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository, is_enabled=False)
    use_case = IngestWebhookUseCase(repository, IngestService(repository, publisher))

    with pytest.raises(EntityNotFoundError):
        await use_case.execute("whk_missing", {}, headers={})
    with pytest.raises(IntegrationDisabledError):
        await use_case.execute(endpoint.webhook_key, {"records": []}, headers={"x-webhook-secret": "s3cret"})


@pytest.mark.asyncio
async def test_import_file_parses_csv_and_ingests():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(
        repository,
        connector_type=ConnectorType.FILE_IMPORT,
        data_format=DataFormat.CSV,
        webhook_key=None,
        webhook_secret=None,
    )
    mapping.record_path = None
    mapping.field_mappings = [
        {"target": "employee_code", "source": "employee_code", "type": "string", "required": True},
        {"target": "punched_at", "source": "punched_at", "type": "datetime", "required": True},
        {"target": "direction", "source": "direction", "type": "string"},
    ]
    await repository.save_mapping(mapping)
    use_case = ImportFileUseCase(repository, IngestService(repository, publisher))

    content = b"employee_code,punched_at,direction\nEMP001,2025-03-01T07:59:00,IN\n"
    run = await use_case.execute(TENANT, endpoint.id, content)

    assert run.status == RunStatus.SUCCESS
    assert run.records_succeeded == 1
    assert run.trigger == RunTrigger.MANUAL
    assert publisher.published[0]["routing_key"] == "payroll.event.attendance.recorded"


@pytest.mark.asyncio
async def test_import_file_rejects_wrong_connector_type():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    use_case = ImportFileUseCase(repository, IngestService(repository, publisher))

    with pytest.raises(ValidationError):
        await use_case.execute(TENANT, endpoint.id, b"a,b\n1,2\n")


class FakeRestPullConnector:
    def __init__(self, payload: Any, error: Optional[Exception] = None):
        self.payload = payload
        self.error = error

    def build_auth(self, auth_type, credentials):
        return {"Authorization": "Bearer test"} if credentials else {}

    async def fetch(self, endpoint, auth_headers=None):
        if self.error:
            raise self.error
        return self.payload


@pytest.mark.asyncio
async def test_run_pull_success_encrypts_credentials_and_marks_last_run():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(
        repository,
        connector_type=ConnectorType.REST_PULL,
        auth_type=AuthType.BEARER,
        source_url="https://ponto.externo/api/batidas",
        schedule_interval_seconds=60,
        webhook_key=None,
        webhook_secret=None,
    )
    cipher = SecretCipher(fallback_seed="test-seed")
    endpoint.encrypted_credentials = cipher.encrypt_dict({"token": "abc123"})
    await repository.save_endpoint(endpoint)
    connector = FakeRestPullConnector({"records": ATTENDANCE_PAYLOAD})
    use_case = RunPullUseCase(repository, IngestService(repository, publisher), cipher, connector)

    runs = await use_case.execute()
    assert len(runs) == 1
    assert runs[0].status == RunStatus.SUCCESS
    assert runs[0].records_succeeded == 2

    reloaded = await repository.get_endpoint(TENANT, endpoint.id)
    assert reloaded.last_run_at is not None
    assert cipher.decrypt_dict(reloaded.encrypted_credentials) == {"token": "abc123"}


@pytest.mark.asyncio
async def test_run_pull_failure_records_failed_run():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(
        repository,
        connector_type=ConnectorType.REST_PULL,
        source_url="https://ponto.externo/api/batidas",
        schedule_interval_seconds=60,
        webhook_key=None,
        webhook_secret=None,
    )
    cipher = SecretCipher(fallback_seed="test-seed")
    connector = FakeRestPullConnector(None, error=RuntimeError("timeout"))
    use_case = RunPullUseCase(repository, IngestService(repository, publisher), cipher, connector)

    runs = await use_case.execute()
    assert runs[0].status == RunStatus.FAILED
    assert "timeout" in runs[0].message


@pytest.mark.asyncio
async def test_run_pull_skips_endpoints_not_due():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(
        repository,
        connector_type=ConnectorType.REST_PULL,
        source_url="https://ponto.externo/api/batidas",
        schedule_interval_seconds=3600,
        webhook_key=None,
        webhook_secret=None,
    )
    endpoint.mark_run(datetime.now(timezone.utc))
    await repository.save_endpoint(endpoint)
    cipher = SecretCipher(fallback_seed="test-seed")
    connector = FakeRestPullConnector({"records": []})
    use_case = RunPullUseCase(repository, IngestService(repository, publisher), cipher, connector)

    assert await use_case.execute() == []


@pytest.mark.asyncio
async def test_run_pull_manual_requires_rest_pull_connector():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    endpoint, mapping = await seed(repository)
    cipher = SecretCipher(fallback_seed="test-seed")
    use_case = RunPullUseCase(repository, IngestService(repository, publisher), cipher)

    with pytest.raises(ValidationError):
        await use_case.execute_endpoint(TENANT, endpoint.id)
