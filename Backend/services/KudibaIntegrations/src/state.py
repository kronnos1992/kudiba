from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

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
from src.config import Settings
from src.infrastructure.connectors.rest_pull import RestPullConnector
from src.infrastructure.events.rabbitmq_publisher import RabbitMqEventPublisher
from src.infrastructure.persistence import PostgresIntegrationRepository
from src.infrastructure.scheduling import IntegrationsScheduler
from src.infrastructure.security import SecretCipher


@dataclass
class AppState:
    config: Settings
    publisher: RabbitMqEventPublisher
    cipher: SecretCipher
    scheduler: Optional[IntegrationsScheduler]

    create_endpoint: CreateEndpointUseCase
    update_endpoint: UpdateEndpointUseCase
    delete_endpoint: DeleteEndpointUseCase
    create_mapping: CreateMappingUseCase
    update_mapping: UpdateMappingUseCase
    delete_mapping: DeleteMappingUseCase
    ingest_webhook: IngestWebhookUseCase
    run_pull: RunPullUseCase
    import_file: ImportFileUseCase

    list_endpoints: ListEndpointsUseCase
    get_endpoint: GetEndpointUseCase
    list_mappings: ListMappingsUseCase
    list_runs: ListRunsUseCase


def create_app_state(
    config: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    publisher: Optional[RabbitMqEventPublisher] = None,
) -> AppState:
    repository = PostgresIntegrationRepository(session_factory)
    cipher = SecretCipher(config.integration_encryption_key, config.jwt_secret)
    pub = publisher or RabbitMqEventPublisher(config.rabbitmq_url, config.event_exchange)
    rest_connector = RestPullConnector(config.http_timeout_seconds)

    ingest_service = IngestService(repository, pub)

    create_endpoint = CreateEndpointUseCase(repository, cipher)
    update_endpoint = UpdateEndpointUseCase(repository, cipher)
    delete_endpoint = DeleteEndpointUseCase(repository)
    create_mapping = CreateMappingUseCase(repository)
    update_mapping = UpdateMappingUseCase(repository)
    delete_mapping = DeleteMappingUseCase(repository)
    ingest_webhook = IngestWebhookUseCase(repository, ingest_service)
    run_pull = RunPullUseCase(repository, ingest_service, cipher, rest_connector)
    import_file = ImportFileUseCase(repository, ingest_service)

    list_endpoints = ListEndpointsUseCase(repository)
    get_endpoint = GetEndpointUseCase(repository)
    list_mappings = ListMappingsUseCase(repository)
    list_runs = ListRunsUseCase(repository)

    scheduler = (
        IntegrationsScheduler(run_pull, config.scheduler_tick_seconds)
        if config.scheduler_enabled
        else None
    )

    return AppState(
        config=config,
        publisher=pub,
        cipher=cipher,
        scheduler=scheduler,
        create_endpoint=create_endpoint,
        update_endpoint=update_endpoint,
        delete_endpoint=delete_endpoint,
        create_mapping=create_mapping,
        update_mapping=update_mapping,
        delete_mapping=delete_mapping,
        ingest_webhook=ingest_webhook,
        run_pull=run_pull,
        import_file=import_file,
        list_endpoints=list_endpoints,
        get_endpoint=get_endpoint,
        list_mappings=list_mappings,
        list_runs=list_runs,
    )
