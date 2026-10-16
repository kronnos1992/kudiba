from types import SimpleNamespace
from uuid import uuid4

import httpx
import pytest

from src.application.commands import (
    CreateEndpointUseCase,
    CreateMappingUseCase,
    DeleteEndpointUseCase,
    DeleteMappingUseCase,
    ImportFileUseCase,
    IngestWebhookUseCase,
    RunPullUseCase,
    UpdateEndpointUseCase,
    UpdateMappingUseCase,
)
from src.application.ingest_service import IngestService
from src.application.queries import (
    GetEndpointUseCase,
    ListEndpointsUseCase,
    ListMappingsUseCase,
    ListRunsUseCase,
)
from src.infrastructure.security import SecretCipher
from src.main import app
from tests.fakes import FakeEventPublisher, InMemoryIntegrationRepository

TENANT = str(uuid4())


def build_state(repository, publisher):
    cipher = SecretCipher(fallback_seed="test-seed")
    ingest = IngestService(repository, publisher)
    return SimpleNamespace(
        create_endpoint=CreateEndpointUseCase(repository, cipher),
        update_endpoint=UpdateEndpointUseCase(repository, cipher),
        delete_endpoint=DeleteEndpointUseCase(repository),
        create_mapping=CreateMappingUseCase(repository),
        update_mapping=UpdateMappingUseCase(repository),
        delete_mapping=DeleteMappingUseCase(repository),
        ingest_webhook=IngestWebhookUseCase(repository, ingest),
        run_pull=RunPullUseCase(repository, ingest, cipher),
        import_file=ImportFileUseCase(repository, ingest),
        list_endpoints=ListEndpointsUseCase(repository),
        get_endpoint=GetEndpointUseCase(repository),
        list_mappings=ListMappingsUseCase(repository),
        list_runs=ListRunsUseCase(repository),
    )


@pytest.fixture
def client():
    repository = InMemoryIntegrationRepository()
    publisher = FakeEventPublisher()
    app.state.app_state = build_state(repository, publisher)
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


def headers():
    return {"X-Resolved-Tenant-ID": TENANT}


@pytest.mark.asyncio
async def test_health_endpoint(client):
    async with client as http:
        response = await http.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "kudiba-integrations"


@pytest.mark.asyncio
async def test_missing_tenant_header_returns_400(client):
    async with client as http:
        response = await http.get("/api/v1/integrations/endpoints")
    assert response.status_code == 400
    assert response.json()["code"] == "BAD_REQUEST"


@pytest.mark.asyncio
async def test_create_and_list_endpoints(client):
    payload = {
        "name": "Relógio de Ponto",
        "system_type": "ATTENDANCE",
        "connector_type": "WEBHOOK",
        "webhook_secret": "s3cret",
    }
    async with client as http:
        created = await http.post("/api/v1/integrations/endpoints", json=payload, headers=headers())
        assert created.status_code == 201
        body = created.json()
        assert body["name"] == "Relógio de Ponto"
        assert body["webhook_key"]
        assert body["has_credentials"] is False

        listed = await http.get("/api/v1/integrations/endpoints", headers=headers())
        assert listed.status_code == 200
        assert len(listed.json()) == 1

        fetched = await http.get(
            f"/api/v1/integrations/endpoints/{body['id']}", headers=headers()
        )
        assert fetched.status_code == 200
        assert fetched.json()["id"] == body["id"]


@pytest.mark.asyncio
async def test_create_endpoint_with_credentials_reports_has_credentials(client):
    payload = {
        "name": "Banco",
        "system_type": "BANK",
        "connector_type": "REST_PULL",
        "auth_type": "BEARER",
        "credentials": {"token": "abc"},
        "source_url": "https://bank.example/api",
    }
    async with client as http:
        created = await http.post("/api/v1/integrations/endpoints", json=payload, headers=headers())
    assert created.status_code == 201
    body = created.json()
    assert body["has_credentials"] is True
    assert "abc" not in created.text


@pytest.mark.asyncio
async def test_delete_endpoint_then_get_returns_404(client):
    payload = {"name": "Temp", "system_type": "X", "connector_type": "WEBHOOK"}
    async with client as http:
        created = await http.post("/api/v1/integrations/endpoints", json=payload, headers=headers())
        endpoint_id = created.json()["id"]
        removed = await http.delete(
            f"/api/v1/integrations/endpoints/{endpoint_id}", headers=headers()
        )
        assert removed.status_code == 204
        missing = await http.get(
            f"/api/v1/integrations/endpoints/{endpoint_id}", headers=headers()
        )
        assert missing.status_code == 404
        assert missing.json()["code"] == "NOT_FOUND"


@pytest.mark.asyncio
async def test_create_mapping_and_list(client):
    endpoint_payload = {"name": "Ponto", "system_type": "ATTENDANCE", "connector_type": "WEBHOOK"}
    async with client as http:
        created = await http.post(
            "/api/v1/integrations/endpoints", json=endpoint_payload, headers=headers()
        )
        endpoint_id = created.json()["id"]
        mapping_payload = {
            "name": "Batidas",
            "entity_type": "ATTENDANCE",
            "target_event_type": "attendance.recorded",
            "target_routing_key": "payroll.event.attendance.recorded",
            "record_path": "records",
            "field_mappings": [{"target": "employee_code", "source": "employee_code"}],
        }
        mapping = await http.post(
            f"/api/v1/integrations/endpoints/{endpoint_id}/mappings",
            json=mapping_payload,
            headers=headers(),
        )
        assert mapping.status_code == 201
        assert mapping.json()["endpoint_id"] == endpoint_id

        listed = await http.get(
            "/api/v1/integrations/mappings",
            params={"endpoint_id": endpoint_id},
            headers=headers(),
        )
        assert listed.status_code == 200
        assert len(listed.json()) == 1


@pytest.mark.asyncio
async def test_webhook_ingestion_returns_202(client):
    endpoint_payload = {
        "name": "Ponto",
        "system_type": "ATTENDANCE",
        "connector_type": "WEBHOOK",
        "webhook_secret": "s3cret",
    }
    mapping_payload = {
        "name": "Batidas",
        "entity_type": "ATTENDANCE",
        "target_event_type": "attendance.recorded",
        "target_routing_key": "payroll.event.attendance.recorded",
        "record_path": "records",
        "field_mappings": [
            {"target": "employee_code", "source": "employee_code", "required": True},
            {"target": "punched_at", "source": "punched_at", "type": "datetime", "required": True},
        ],
    }
    async with client as http:
        created = await http.post(
            "/api/v1/integrations/endpoints", json=endpoint_payload, headers=headers()
        )
        endpoint = created.json()
        key = endpoint["webhook_key"]
        await http.post(
            f"/api/v1/integrations/endpoints/{endpoint['id']}/mappings",
            json=mapping_payload,
            headers=headers(),
        )

        accepted = await http.post(
            f"/api/v1/integrations/webhooks/{key}",
            json={"records": [{"employee_code": "EMP001", "punched_at": "2025-03-01T07:59:00"}]},
            headers={"X-Webhook-Secret": "s3cret"},
        )
        assert accepted.status_code == 202
        body = accepted.json()
        assert body["accepted"] is True
        assert body["records_succeeded"] == 1

        bad_secret = await http.post(
            f"/api/v1/integrations/webhooks/{key}",
            json={"records": []},
            headers={"X-Webhook-Secret": "wrong"},
        )
        assert bad_secret.status_code == 422

        unknown = await http.post(
            "/api/v1/integrations/webhooks/whk_unknown",
            json={"records": []},
        )
        assert unknown.status_code == 404


@pytest.mark.asyncio
async def test_webhook_invalid_json_returns_422(client):
    endpoint_payload = {"name": "Ponto", "system_type": "ATTENDANCE", "connector_type": "WEBHOOK"}
    async with client as http:
        created = await http.post(
            "/api/v1/integrations/endpoints", json=endpoint_payload, headers=headers()
        )
        key = created.json()["webhook_key"]
        response = await http.post(
            f"/api/v1/integrations/webhooks/{key}",
            content=b"not-json",
            headers={"content-type": "application/json"},
        )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_validation_error_shape(client):
    async with client as http:
        response = await http.post(
            "/api/v1/integrations/endpoints", json={"name": "x"}, headers=headers()
        )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert "validation_errors" in response.json()
