from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.application.alvara_verifier import VerifyAlvaraUseCase
from src.application.commands import (
    CreateClientUseCase,
    RenewLicenseUseCase,
    SetLicenseStatusUseCase,
    SyncTenantsUseCase,
    UpdateClientUseCase,
)
from src.application.queries import (
    GetClientUseCase,
    GetPlatformCommercialSummaryUseCase,
    GetPlatformSummaryUseCase,
    ListClientsUseCase,
)
from src.config import Settings
from src.domain.ports import IChartProvisioner
from src.infrastructure.persistence.audit_repository import SqlAlchemyAuditRepository
from src.infrastructure.persistence.chart_provisioner import SqlAlchemyChartProvisioner
from src.infrastructure.persistence.client_repository import SqlAlchemyClientRepository
from src.infrastructure.persistence.license_repository import SqlAlchemyLicenseRepository
from src.infrastructure.persistence.tenant_provisioner import SqlAlchemyTenantProvisioner
from src.infrastructure.persistence.tenant_reader import SqlAlchemyTenantReader
from src.infrastructure.security.jwt_service import JwtTokenService


@dataclass
class AppState:
    config: Settings
    session_factory: async_sessionmaker[AsyncSession]
    auth_session_factory: async_sessionmaker[AsyncSession]
    accounting_session_factory: Optional[async_sessionmaker[AsyncSession]]
    jwt_service: JwtTokenService
    create_client: CreateClientUseCase
    update_client: UpdateClientUseCase
    renew_license: RenewLicenseUseCase
    set_license_status: SetLicenseStatusUseCase
    list_clients: ListClientsUseCase
    get_client: GetClientUseCase
    get_platform_summary: GetPlatformSummaryUseCase
    get_platform_commercial_summary: GetPlatformCommercialSummaryUseCase
    verify_alvara: VerifyAlvaraUseCase
    tenant_provisioner: SqlAlchemyTenantProvisioner
    tenant_reader: SqlAlchemyTenantReader
    audit_repo: SqlAlchemyAuditRepository
    chart_provisioner: Optional[IChartProvisioner] = None


def create_app_state(
    config: Settings,
    session_factory: async_sessionmaker[AsyncSession],
    auth_session_factory: async_sessionmaker[AsyncSession],
    accounting_session_factory: Optional[async_sessionmaker[AsyncSession]] = None,
) -> AppState:
    client_repo = SqlAlchemyClientRepository(session_factory)
    license_repo = SqlAlchemyLicenseRepository(session_factory)
    audit_repo = SqlAlchemyAuditRepository(session_factory)
    provisioner = SqlAlchemyTenantProvisioner(auth_session_factory)
    tenant_reader = SqlAlchemyTenantReader(auth_session_factory)
    chart_provisioner = (
        SqlAlchemyChartProvisioner(accounting_session_factory)
        if accounting_session_factory is not None
        else None
    )
    sync_tenants = SyncTenantsUseCase(client_repo, license_repo, tenant_reader)
    jwt_service = JwtTokenService(secret=config.jwt_secret, algorithm=config.jwt_algorithm)

    return AppState(
        config=config,
        session_factory=session_factory,
        auth_session_factory=auth_session_factory,
        accounting_session_factory=accounting_session_factory,
        jwt_service=jwt_service,
        create_client=CreateClientUseCase(
            client_repo, license_repo, provisioner, chart_provisioner=chart_provisioner
        ),
        update_client=UpdateClientUseCase(client_repo, license_repo),
        renew_license=RenewLicenseUseCase(client_repo, license_repo, provisioner),
        set_license_status=SetLicenseStatusUseCase(client_repo, license_repo, provisioner),
        list_clients=ListClientsUseCase(client_repo, license_repo, sync=sync_tenants),
        get_client=GetClientUseCase(client_repo, license_repo),
        get_platform_summary=GetPlatformSummaryUseCase(
            client_repo, license_repo, sync=sync_tenants
        ),
        get_platform_commercial_summary=GetPlatformCommercialSummaryUseCase(
            client_repo, sync=sync_tenants
        ),
        verify_alvara=VerifyAlvaraUseCase(client_repo=client_repo),
        tenant_provisioner=provisioner,
        tenant_reader=tenant_reader,
        audit_repo=audit_repo,
        chart_provisioner=chart_provisioner,
    )
