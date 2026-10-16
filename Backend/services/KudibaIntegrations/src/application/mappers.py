from src.application.dto import EndpointResponse, MappingResponse, RunResponse
from src.domain.entities.integration import (
    IntegrationEndpoint,
    IntegrationMapping,
    IntegrationRun,
)


def endpoint_to_response(endpoint: IntegrationEndpoint) -> EndpointResponse:
    return EndpointResponse(
        id=endpoint.id,
        tenant_id=endpoint.tenant_id,
        name=endpoint.name,
        system_type=endpoint.system_type,
        connector_type=endpoint.connector_type,
        description=endpoint.description,
        is_enabled=endpoint.is_enabled,
        auth_type=endpoint.auth_type,
        has_credentials=bool(endpoint.encrypted_credentials),
        webhook_key=endpoint.webhook_key,
        webhook_header_name=endpoint.webhook_header_name,
        source_url=endpoint.source_url,
        http_method=endpoint.http_method,
        request_headers=endpoint.request_headers,
        query_params=endpoint.query_params,
        schedule_interval_seconds=endpoint.schedule_interval_seconds,
        data_format=endpoint.data_format,
        file_delimiter=endpoint.file_delimiter,
        file_has_header=endpoint.file_has_header,
        file_encoding=endpoint.file_encoding,
        column_widths=endpoint.column_widths,
        last_run_at=endpoint.last_run_at,
        created_at=endpoint.created_at,
        updated_at=endpoint.updated_at,
    )


def mapping_to_response(mapping: IntegrationMapping) -> MappingResponse:
    return MappingResponse(
        id=mapping.id,
        tenant_id=mapping.tenant_id,
        endpoint_id=mapping.endpoint_id,
        name=mapping.name,
        entity_type=mapping.entity_type,
        is_enabled=mapping.is_enabled,
        record_path=mapping.record_path,
        field_mappings=mapping.field_mappings,
        static_payload=mapping.static_payload,
        dedup_fields=mapping.dedup_fields,
        conflict_policy=mapping.conflict_policy,
        target_event_type=mapping.target_event_type,
        target_routing_key=mapping.target_routing_key,
        created_at=mapping.created_at,
        updated_at=mapping.updated_at,
    )


def run_to_response(run: IntegrationRun) -> RunResponse:
    return RunResponse(
        id=run.id,
        tenant_id=run.tenant_id,
        endpoint_id=run.endpoint_id,
        mapping_id=run.mapping_id,
        trigger=run.trigger.value,
        status=run.status.value,
        records_received=run.records_received,
        records_succeeded=run.records_succeeded,
        records_failed=run.records_failed,
        records_skipped=run.records_skipped,
        message=run.message,
        started_at=run.started_at,
        finished_at=run.finished_at,
        created_at=run.created_at,
    )
