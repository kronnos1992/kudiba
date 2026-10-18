from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.application.commands import (
    CreateClientUseCase,
    RenewLicenseUseCase,
    SetLicenseStatusUseCase,
    UpdateClientUseCase,
)
from src.application.queries import GetClientUseCase, GetPlatformSummaryUseCase, ListClientsUseCase
from src.config import Settings
from src.infrastructure.persistence.client_repository import SqlAlchemyClientRepository
from src.infrastructure.persistence.license_repository import SqlAlchemyLicenseRepository
from src.infrastructure.persistence.tenant_provisioner import SqlAlchemyTenantProvisioner
from src.infrastructure.security.jwt_service import JwtTokenService


@dataclass
class AppState:
    config: Settings
    session_factory: async_sessionmaker[AsyncSession]
    auth_session_factory: async_sessionmaker[AsyncSession]
    jwt_service: JwtTokenService
    create_client: CreateClientUseCase
    update_client: UpdateClientUseCase
    renew_license: RenewLicenseUseCase
    set_license_status: SetLicenseStatusUseCase
    list_clients: ListClientsUseCase
    get_client: GetClientUseCase
    get_platform_summary: GetPlatformSummaryUseCase
    tenant_provisioner: SqlAlchemyTenantProvisioner


def create_app_state(
    config: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    auth_session_factory: async_sessionmaker[AsyncSession],
) -> AppState:
    client_repo = SqlAlchemyClientRepository(session_factory)
    license_repo = SqlAlchemyLicenseRepository(session_factory)
    provisioner = SqlAlchemyTenantProvisioner(auth_session_factory)
    jwt_service = JwtTokenService(secret=config.jwt_secret, algorithm=config.jwt_algorithm)

    return AppState(
        config=config,
        session_factory=session_factory,
        auth_session_factory=auth_session_factory,
        jwt_service=jwt_service,
        create_client=CreateClientUseCase(client_repo, license_repo, provisioner),
        update_client=UpdateClientUseCase(client_repo, license_repo),
        renew_license=RenewLicenseUseCase(client_repo, license_repo, provisioner),
        set_license_status=SetLicenseStatusUseCase(client_repo, license_repo, provisioner),
        list_clients=ListClientsUseCase(client_repo, license_repo),
        get_client=GetClientUseCase(client_repo, license_repo),
        get_platform_summary=GetPlatformSummaryUseCase(client_repo, license_repo),
        tenant_provisioner=provisioner,
    )
