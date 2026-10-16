from uuid import UUID

from src.application.dto import CreateMappingRequest, UpdateMappingRequest
from src.domain.entities.integration import IntegrationMapping
from src.domain.error import EntityNotFoundError, ValidationError
from src.domain.ports.integration_repository import IntegrationRepository


class CreateMappingUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(
        self, tenant_id: UUID, endpoint_id: UUID, req: CreateMappingRequest
    ) -> IntegrationMapping:
        endpoint = await self.repository.get_endpoint(tenant_id, endpoint_id)
        if not endpoint:
            raise EntityNotFoundError("Ponto de Integração", str(endpoint_id))

        if not req.field_mappings:
            raise ValidationError("O mapeamento exige pelo menos um campo em 'field_mappings'.")

        mapping = IntegrationMapping.create(
            tenant_id=tenant_id,
            endpoint_id=endpoint_id,
            name=req.name,
            entity_type=req.entity_type,
            target_event_type=req.target_event_type,
            target_routing_key=req.target_routing_key,
            is_enabled=req.is_enabled,
            record_path=req.record_path,
            field_mappings=req.field_mappings,
            static_payload=req.static_payload,
            dedup_fields=req.dedup_fields,
            conflict_policy=req.conflict_policy,
        )
        await self.repository.save_mapping(mapping)
        return mapping


class UpdateMappingUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(
        self, tenant_id: UUID, mapping_id: UUID, req: UpdateMappingRequest
    ) -> IntegrationMapping:
        mapping = await self.repository.get_mapping(tenant_id, mapping_id)
        if not mapping:
            raise EntityNotFoundError("Mapeamento de Integração", str(mapping_id))

        data = req.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(mapping, field, value)

        await self.repository.save_mapping(mapping)
        return mapping


class DeleteMappingUseCase:
    def __init__(self, repository: IntegrationRepository):
        self.repository = repository

    async def execute(self, tenant_id: UUID, mapping_id: UUID) -> None:
        deleted = await self.repository.delete_mapping(tenant_id, mapping_id)
        if not deleted:
            raise EntityNotFoundError("Mapeamento de Integração", str(mapping_id))
