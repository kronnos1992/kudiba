from typing import List, Optional, Tuple
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


def extract_actor(request: Request) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    actor_id = request.headers.get("X-User-ID")
    actor_name = request.headers.get("X-User-Name")
    ip_addr = request.headers.get("X-Forwarded-For")
    if ip_addr:
        ip_addr = ip_addr.split(",")[0].strip()
    elif request.client:
        ip_addr = request.client.host
    return actor_id, actor_name, ip_addr


async def record_audit(
    app_state,
    tenant_id: UUID,
    module: str,
    action: str,
    entity_type: str,
    entity_id: str,
    document_reference: Optional[str] = None,
    request: Optional[Request] = None,
    details: Optional[dict] = None,
):
    if not hasattr(app_state, "audit_repo") or not app_state.audit_repo:
        return
    actor_id, actor_name, ip_addr = (None, None, None)
    if request:
        actor_id, actor_name, ip_addr = extract_actor(request)
    await app_state.audit_repo.record_event(
        tenant_id=tenant_id,
        module=module,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        document_reference=document_reference,
        actor_user_id=actor_id,
        actor_name=actor_name,
        ip_address=ip_addr,
        details=details or {},
    )


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
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        endpoint = await app_state.create_endpoint.execute(tenant_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="CRIACAO_ENDPOINT_INTEGRACAO",
            entity_type="INTEGRATION_ENDPOINT",
            entity_id=str(endpoint.id),
            document_reference=endpoint.name,
            request=request,
            details={"name": endpoint.name, "connector_type": endpoint.connector_type.value if hasattr(endpoint.connector_type, "value") else str(endpoint.connector_type)},
        )
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
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        endpoint = await app_state.update_endpoint.execute(tenant_id, endpoint_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="ATUALIZACAO_ENDPOINT_INTEGRACAO",
            entity_type="INTEGRATION_ENDPOINT",
            entity_id=str(endpoint_id),
            document_reference=endpoint.name,
            request=request,
            details={"name": endpoint.name},
        )
        return endpoint_to_response(endpoint)

    @router.delete(
        "/endpoints/{endpoint_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Integrações"]
    )
    async def delete_endpoint(
        endpoint_id: UUID,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        await app_state.delete_endpoint.execute(tenant_id, endpoint_id)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="REMOCAO_ENDPOINT_INTEGRACAO",
            entity_type="INTEGRATION_ENDPOINT",
            entity_id=str(endpoint_id),
            document_reference=f"END-{endpoint_id}",
            request=request,
            details={"endpoint_id": str(endpoint_id)},
        )
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
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        mapping = await app_state.create_mapping.execute(tenant_id, endpoint_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="CRIACAO_MAPEAMENTO_INTEGRACAO",
            entity_type="INTEGRATION_MAPPING",
            entity_id=str(mapping.id),
            document_reference=mapping.name,
            request=request,
            details={"entity_type": mapping.entity_type, "endpoint_id": str(endpoint_id)},
        )
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
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        mapping = await app_state.update_mapping.execute(tenant_id, mapping_id, req)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="ATUALIZACAO_MAPEAMENTO_INTEGRACAO",
            entity_type="INTEGRATION_MAPPING",
            entity_id=str(mapping_id),
            document_reference=mapping.name,
            request=request,
            details={"entity_type": mapping.entity_type},
        )
        return mapping_to_response(mapping)

    @router.delete(
        "/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Integrações"]
    )
    async def delete_mapping(
        mapping_id: UUID,
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        await app_state.delete_mapping.execute(tenant_id, mapping_id)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="REMOCAO_MAPEAMENTO_INTEGRACAO",
            entity_type="INTEGRATION_MAPPING",
            entity_id=str(mapping_id),
            document_reference=f"MAP-{mapping_id}",
            request=request,
            details={"mapping_id": str(mapping_id)},
        )
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
        request: Request,
        tenant_id: UUID = Depends(get_current_tenant_id),
        app_state=Depends(get_app_state),
    ):
        run = await app_state.run_pull.execute_endpoint(tenant_id, endpoint_id)
        status_val = run.status.value if hasattr(run.status, "value") else str(run.status)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="EXECUCAO_MANUAL_INTEGRACAO",
            entity_type="INTEGRATION_RUN",
            entity_id=str(run.id),
            document_reference=f"RUN-{run.id}",
            request=request,
            details={"endpoint_id": str(endpoint_id), "status": status_val},
        )
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
        status_val = run.status.value if hasattr(run.status, "value") else str(run.status)
        await record_audit(
            app_state,
            tenant_id=tenant_id,
            module="INTEGRATIONS",
            action="IMPORTACAO_FICHEIRO_INTEGRACAO",
            entity_type="INTEGRATION_RUN",
            entity_id=str(run.id),
            document_reference=f"RUN-{run.id}",
            request=request,
            details={"endpoint_id": str(endpoint_id), "status": status_val},
        )
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
        status_val = run.status.value if hasattr(run.status, "value") else str(run.status)
        await record_audit(
            app_state,
            tenant_id=run.tenant_id,
            module="INTEGRATIONS",
            action="RECECAO_WEBHOOK_INTEGRACAO",
            entity_type="INTEGRATION_RUN",
            entity_id=str(run.id),
            document_reference=f"RUN-{run.id}",
            request=request,
            details={"status": status_val, "webhook_key": webhook_key},
        )
        return WebhookAcceptedResponse(
            accepted=run.status != "FAILED",
            run_id=run.id,
            status=run.status.value,
            records_received=run.records_received,
            records_succeeded=run.records_succeeded,
            records_failed=run.records_failed,
            records_skipped=run.records_skipped,
        )

    @router.get("/system-audit-trail", tags=["Auditoria"])
    async def get_system_audit_trail(
        tenant_id: UUID = Depends(get_current_tenant_id),
        module: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        app_state=Depends(get_app_state),
    ):
        items = await app_state.audit_repo.list_events(
            tenant_id=tenant_id,
            module=module,
            action=action,
            limit=limit,
            offset=offset,
        )
        total = await app_state.audit_repo.count_events(
            tenant_id=tenant_id,
            module=module,
            action=action,
        )
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    return router
