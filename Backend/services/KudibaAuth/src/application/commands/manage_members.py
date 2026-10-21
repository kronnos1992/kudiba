import uuid
from datetime import datetime, timezone
from typing import Optional

from src.application.dto import RemoveMemberCommand, UpdateMemberStatusCommand
from src.domain.error import ConflictError, DomainError, EntityNotFoundError
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.cache_service import ICacheService
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.unit_of_work import IUnitOfWorkFactory
from src.domain.ports.user_tenant_repository import IUserTenantRepository


ALLOWED_MEMBER_STATUSES = {"ACTIVE", "SUSPENDED"}


class UpdateMemberStatusUseCase:
    """Caso de uso para alterar o estado de um membro (ex: ACTIVE, SUSPENDED)."""

    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        user_tenant_repo: IUserTenantRepository,
        refresh_token_repo: Optional[IRefreshTokenRepository] = None,
        cache_service: Optional[ICacheService] = None,
        session_revocation_ttl_seconds: int = 3600,
        audit_repo: Optional[IAuditRepository] = None,
    ):
        self.uow_factory = uow_factory
        self.user_tenant_repo = user_tenant_repo
        self.refresh_token_repo = refresh_token_repo
        self.cache_service = cache_service
        self.session_revocation_ttl_seconds = session_revocation_ttl_seconds
        self.audit_repo = audit_repo

    async def execute(self, cmd: UpdateMemberStatusCommand) -> None:
        normalized_status = cmd.status.strip().upper()
        if normalized_status not in ALLOWED_MEMBER_STATUSES:
            raise DomainError(
                f"Estado inválido: '{cmd.status}'. Os estados permitidos são ACTIVE ou SUSPENDED.",
                code="INVALID_STATUS",
            )

        async with self.uow_factory.begin():
            await self.user_tenant_repo.lock_tenant_role_updates(cmd.tenant_id)
            membership = await self.user_tenant_repo.find_membership(cmd.target_user_id, cmd.tenant_id)
            if not membership:
                raise EntityNotFoundError("Membro da Empresa", str(cmd.target_user_id))

            if cmd.target_user_id == cmd.actor_user_id and normalized_status != "ACTIVE":
                raise ConflictError("Não é permitido suspender a sua própria conta.")

            if normalized_status != "ACTIVE":
                roles = await self.user_tenant_repo.get_user_roles_in_tenant(cmd.target_user_id, cmd.tenant_id)
                if "ADMIN" in roles and await self.user_tenant_repo.count_active_admins(cmd.tenant_id) <= 1:
                    raise ConflictError("Não é possível suspender o último administrador activo da empresa.")

            previous_status = membership.status
            await self.user_tenant_repo.update_member_status(cmd.target_user_id, cmd.tenant_id, normalized_status)

        if self.audit_repo is not None:
            action = "MEMBER_SUSPENDED" if normalized_status == "SUSPENDED" else "MEMBER_ACTIVATED"
            await self.audit_repo.record_event(
                action=action,
                user_id=cmd.target_user_id,
                tenant_id=cmd.tenant_id,
                ip_address=cmd.ip_address,
                user_agent=cmd.user_agent,
                details={
                    "actor_user_id": str(cmd.actor_user_id),
                    "status": normalized_status,
                    "previous_status": previous_status,
                },
            )

        if normalized_status == "SUSPENDED":
            if self.refresh_token_repo is not None:
                await self.refresh_token_repo.revoke_user_tenant_tokens(cmd.target_user_id, cmd.tenant_id)
            if self.cache_service is not None:
                epoch = int(datetime.now(timezone.utc).timestamp())
                await self.cache_service.revoke_sessions_before(
                    str(cmd.target_user_id),
                    str(cmd.tenant_id),
                    epoch,
                    self.session_revocation_ttl_seconds,
                )


class RemoveMemberUseCase:
    """Caso de uso para desvincular um utilizador da organização."""

    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        user_tenant_repo: IUserTenantRepository,
        refresh_token_repo: Optional[IRefreshTokenRepository] = None,
        cache_service: Optional[ICacheService] = None,
        session_revocation_ttl_seconds: int = 3600,
        audit_repo: Optional[IAuditRepository] = None,
    ):
        self.uow_factory = uow_factory
        self.user_tenant_repo = user_tenant_repo
        self.refresh_token_repo = refresh_token_repo
        self.cache_service = cache_service
        self.session_revocation_ttl_seconds = session_revocation_ttl_seconds
        self.audit_repo = audit_repo

    async def execute(self, cmd: RemoveMemberCommand) -> None:
        async with self.uow_factory.begin():
            await self.user_tenant_repo.lock_tenant_role_updates(cmd.tenant_id)
            membership = await self.user_tenant_repo.find_membership(cmd.target_user_id, cmd.tenant_id)
            if not membership:
                raise EntityNotFoundError("Membro da Empresa", str(cmd.target_user_id))

            if cmd.target_user_id == cmd.actor_user_id:
                raise ConflictError("Não é permitido remover a sua própria conta da organização.")

            roles = await self.user_tenant_repo.get_user_roles_in_tenant(cmd.target_user_id, cmd.tenant_id)
            if "ADMIN" in roles and await self.user_tenant_repo.count_active_admins(cmd.tenant_id) <= 1:
                raise ConflictError("Não é possível remover o último administrador activo da empresa.")

            await self.user_tenant_repo.remove_member(cmd.target_user_id, cmd.tenant_id)

        if self.audit_repo is not None:
            await self.audit_repo.record_event(
                action="MEMBER_REMOVED",
                user_id=cmd.target_user_id,
                tenant_id=cmd.tenant_id,
                ip_address=cmd.ip_address,
                user_agent=cmd.user_agent,
                details={
                    "actor_user_id": str(cmd.actor_user_id),
                },
            )

        if self.refresh_token_repo is not None:
            await self.refresh_token_repo.revoke_user_tenant_tokens(cmd.target_user_id, cmd.tenant_id)
        if self.cache_service is not None:
            epoch = int(datetime.now(timezone.utc).timestamp())
            await self.cache_service.revoke_sessions_before(
                str(cmd.target_user_id),
                str(cmd.tenant_id),
                epoch,
                self.session_revocation_ttl_seconds,
            )
