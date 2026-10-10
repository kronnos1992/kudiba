"""Container de Injeção de Dependências partilhado pelos adaptadores de entrada (mirror de state.rs do Invoicing)."""
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.application.commands import (
    AuthenticateUserUseCase,
    InviteUserUseCase,
    LogoutUserUseCase,
    RotateRefreshTokenUseCase,
    SwitchTenantUseCase,
    UpdateUserRolesUseCase,
)
from src.application.queries import (
    GetUserProfileUseCase,
    ListBranchesUseCase,
    ListRolesUseCase,
    ListTenantMembersUseCase,
)
from src.config import Settings
from src.domain.services.security_policy import AccountSecurityPolicy
from src.infrastructure.cache.redis_cache import RedisCacheService
from src.infrastructure.persistence.audit_repository import SqlAlchemyAuditRepository
from src.infrastructure.persistence.refresh_token_repository import SqlAlchemyRefreshTokenRepository
from src.infrastructure.persistence.tenant_repository import SqlAlchemyTenantRepository
from src.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWorkFactory
from src.infrastructure.persistence.user_repository import SqlAlchemyUserRepository
from src.infrastructure.persistence.user_tenant_repository import SqlAlchemyUserTenantRepository
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher
from src.infrastructure.security.jwt_service import JwtTokenService


@dataclass
class AppState:
    config: Settings
    uow_factory: SqlAlchemyUnitOfWorkFactory
    hasher: Argon2PasswordHasher
    token_service: JwtTokenService
    cache: RedisCacheService
    
    # Casos de Uso (Commands)
    authenticate_user: AuthenticateUserUseCase
    rotate_refresh_token: RotateRefreshTokenUseCase
    logout_user: LogoutUserUseCase
    switch_tenant: SwitchTenantUseCase
    invite_user: InviteUserUseCase
    update_user_roles: UpdateUserRolesUseCase

    # Casos de Uso (Queries)
    get_user_profile: GetUserProfileUseCase
    list_tenant_members: ListTenantMembersUseCase
    list_branches: ListBranchesUseCase
    list_roles: ListRolesUseCase


def create_app_state(config: Settings, session_factory: async_sessionmaker[AsyncSession]) -> AppState:
    # 1. Adaptadores de Infraestrutura
    uow_factory = SqlAlchemyUnitOfWorkFactory(session_factory)
    user_repo = SqlAlchemyUserRepository(session_factory)
    tenant_repo = SqlAlchemyTenantRepository(session_factory)
    user_tenant_repo = SqlAlchemyUserTenantRepository(session_factory)
    refresh_token_repo = SqlAlchemyRefreshTokenRepository(session_factory)
    audit_repo = SqlAlchemyAuditRepository(session_factory)
    hasher = Argon2PasswordHasher()
    token_service = JwtTokenService(
        secret=config.jwt_secret,
        algorithm=config.jwt_algorithm,
        default_access_expiration_minutes=config.jwt_access_expiration_minutes,
    )
    cache = RedisCacheService(config.redis_url)
    security_policy = AccountSecurityPolicy(
        max_login_attempts=config.max_login_attempts,
        lockout_minutes=config.account_lockout_minutes,
    )

    # 2. Casos de Uso (Commands)
    authenticate_user = AuthenticateUserUseCase(
        uow_factory=uow_factory,
        user_repo=user_repo,
        tenant_repo=tenant_repo,
        user_tenant_repo=user_tenant_repo,
        refresh_token_repo=refresh_token_repo,
        password_hasher=hasher,
        token_service=token_service,
        audit_repo=audit_repo,
        security_policy=security_policy,
        refresh_token_days=config.refresh_token_expiration_days,
    )

    rotate_refresh_token = RotateRefreshTokenUseCase(
        uow_factory=uow_factory,
        user_repo=user_repo,
        tenant_repo=tenant_repo,
        user_tenant_repo=user_tenant_repo,
        refresh_token_repo=refresh_token_repo,
        token_service=token_service,
        audit_repo=audit_repo,
        refresh_token_days=config.refresh_token_expiration_days,
    )

    logout_user = LogoutUserUseCase(
        uow_factory=uow_factory,
        refresh_token_repo=refresh_token_repo,
        token_service=token_service,
        cache_service=cache,
        audit_repo=audit_repo,
    )

    switch_tenant = SwitchTenantUseCase(
        uow_factory=uow_factory,
        user_repo=user_repo,
        tenant_repo=tenant_repo,
        user_tenant_repo=user_tenant_repo,
        refresh_token_repo=refresh_token_repo,
        token_service=token_service,
        audit_repo=audit_repo,
        refresh_token_days=config.refresh_token_expiration_days,
    )

    invite_user = InviteUserUseCase(
        uow_factory=uow_factory,
        user_repo=user_repo,
        user_tenant_repo=user_tenant_repo,
        password_hasher=hasher,
        audit_repo=audit_repo,
    )

    update_user_roles = UpdateUserRolesUseCase(
        uow_factory=uow_factory,
        user_tenant_repo=user_tenant_repo,
        refresh_token_repo=refresh_token_repo,
        cache_service=cache,
        session_revocation_ttl_seconds=config.jwt_access_expiration_minutes * 60 + 60,
    )

    # 3. Casos de Uso (Queries)
    get_user_profile = GetUserProfileUseCase(
        user_repo=user_repo,
        tenant_repo=tenant_repo,
        user_tenant_repo=user_tenant_repo,
    )

    list_tenant_members = ListTenantMembersUseCase(
        user_tenant_repo=user_tenant_repo,
    )

    list_branches = ListBranchesUseCase(
        tenant_repo=tenant_repo,
    )

    list_roles = ListRolesUseCase(
        user_tenant_repo=user_tenant_repo,
    )

    return AppState(
        config=config,
        uow_factory=uow_factory,
        hasher=hasher,
        token_service=token_service,
        cache=cache,
        authenticate_user=authenticate_user,
        rotate_refresh_token=rotate_refresh_token,
        logout_user=logout_user,
        switch_tenant=switch_tenant,
        invite_user=invite_user,
        update_user_roles=update_user_roles,
        get_user_profile=get_user_profile,
        list_tenant_members=list_tenant_members,
        list_branches=list_branches,
        list_roles=list_roles,
    )
