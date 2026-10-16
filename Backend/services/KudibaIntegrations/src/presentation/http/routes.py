from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status

from src.application.dto import (
    CreateEndpointRequest,
    CreateMappingRequest,
    EndpointResponse,
    MappingResponse,
    RunResponse,
    UpdateEndpointRequest,
    UpdateMappingRequest,
    WebhookAcceptedResponse,
)
from src.application.mappers import (
    endpoint_to_response,
    mapping_to_response,
    run_to_response,
)
from src.domain.error import ValidationError
from src.presentation.http.dependencies import get_app_state, get_current_tenant_id


def create_integrations_router() -> APIRouter:
    router = APIRouter()

    @router.get("/endpoints", response_model=List[EndpointResponse], tags=["Integrações"])
    async def list_endpoints(
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        endpoints = await app_state.list_endpoints.execute(tenant_id)
        return [endpoint_to_response(e) for e in endpoints]

    @router.post(
        "/endpoints",
        response_model=EndpointResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Integrações"],
    )
    async def create_endpoint(
        req: CreateEndpointRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        endpoint = await app_state.create_endpoint.execute(tenant_id, req)
        return endpoint_to_response(endpoint)

    @router.get(
        "/endpoints/{endpoint_id}", response_model=EndpointResponse, tags=["Integrações"]
    )
    async def get_endpoint(
        endpoint_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        endpoint = await app_state.get_endpoint.execute(tenant_id, endpoint_id)
        return endpoint_to_response(endpoint)

    @router.put(
        "/endpoints/{endpoint_id}", response_model=EndpointResponse, tags=["Integrações"]
    )
    async def update_endpoint(
        endpoint_id: UUID,
        req: UpdateEndpointRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        endpoint = await app_state.update_endpoint.execute(tenant_id, endpoint_id, req)
        return endpoint_to_response(endpoint)

    @router.delete(
        "/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Integrações"]
    )
    async def delete_endpoint(
        endpoint_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        await app_state.delete_endpoint.execute(tenant_id, endpoint_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.post(
        "/endpoints/{endpoint_id}/mappings",
        response_model=MappingResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["Integrações"],
    )
    async def create_mapping(
        endpoint_id: UUID,
        req: CreateMappingRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        mapping = await app_state.create_mapping.execute(tenant_id, endpoint_id, req)
        return mapping_to_response(mapping)

    @router.get("/mappings", response_model=List[MappingResponse], tags=["Integrações"])
    async def list_mappings(
        endpoint_id: Optional[UUID] = Query(None),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        mappings = await app_state.list_mappings.execute(tenant_id, endpoint_id=endpoint_id)
        return [mapping_to_response(m) for m in mappings]

    @router.put(
        "/mappings/{mapping_id}", response_model=MappingResponse, tags=["Integrações"]
    )
    async def update_mapping(
        mapping_id: UUID,
        req: UpdateMappingRequest,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        mapping = await app_state.update_mapping.execute(tenant_id, mapping_id, req)
        return mapping_to_response(mapping)

    @router.delete(
        "/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Integrações"]
    )
    async def delete_mapping(
        mapping_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        await app_state.delete_mapping.execute(tenant_id, mapping_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @router.get("/runs", response_model=List[RunResponse], tags=["Integrações"])
    async def list_runs(
        endpoint_id: Optional[UUID] = Query(None),
        limit: int = Query(50, ge=1, le=200),
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        runs = await app_state.list_runs.execute(tenant_id, endpoint_id=endpoint_id, limit=limit)
        return [run_to_response(r) for r in runs]

    @router.post(
        "/endpoints/{endpoint_id}/run",
        response_model=RunResponse,
        tags=["Integrações"],
    )
    async def run_endpoint_now(
        endpoint_id: UUID,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        run = await app_state.run_pull.execute_endpoint(tenant_id, endpoint_id)
        return run_to_response(run)

    @router.post(
        "/endpoints/{endpoint_id}/import",
        response_model=RunResponse,
        tags=["Integrações"],
    )
    async def import_file(
        endpoint_id: UUID,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        content = await request.body()
        if not content:
            raise ValidationError("O corpo do pedido está vazio (nenhum ficheiro recebido).")
        run = await app_state.import_file.execute(tenant_id, endpoint_id, content)
        return run_to_response(run)

    @router.post(
        "/webhooks/{webhook_key}",
        response_model=WebhookAcceptedResponse,
        status_code=status.HTTP_202_ACCEPTED,
        tags=["Integrações"],
    )
    async def receive_webhook(webhook_key: str, request: Request, app_state=Depends(get_app_state)):
        try:
            payload = await request.json()
        except Exception:
            raise ValidationError("O corpo do webhook não contém JSON válido.")
        headers = {k.lower(): v for k, v in request.headers.items()}
        run = await app_state.ingest_webhook.execute(webhook_key, payload, headers)
        return WebhookAcceptedResponse(
            accepted=run.status != "FAILED",
            run_id=run.id,
            status=run.status.value,
            records_received=run.records_received,
            records_succeeded=run.records_succeeded,
            records_failed=run.records_failed,
            records_skipped=run.records_skipped,
        )

    return router
