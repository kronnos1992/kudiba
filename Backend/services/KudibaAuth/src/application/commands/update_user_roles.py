from datetime import datetime, timezone
from typing import Optional
from src.application.dto import UpdateUserRolesCommand
from src.domain.error import ConflictError, DomainError, EntityNotFoundError
from src.domain.ports.cache_service import ICacheService
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.unit_of_work import IUnitOfWorkFactory
from src.domain.ports.user_tenant_repository import IUserTenantRepository
from src.domain.value_objects.role_type import RoleType


class UpdateUserRolesUseCase:
    """Caso de uso de actualização de papéis RBAC de um membro de organização."""
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        user_tenant_repo: IUserTenantRepository,
        refresh_token_repo: Optional[IRefreshTokenRepository] = None,
        cache_service: Optional[ICacheService] = None,
        session_revocation_ttl_seconds: int = 3600,
    ):
        self.uow_factory = uow_factory
        self.user_tenant_repo = user_tenant_repo
        self.refresh_token_repo = refresh_token_repo
        self.cache_service = cache_service
        self.session_revocation_ttl_seconds = session_revocation_ttl_seconds

    async def execute(self, cmd: UpdateUserRolesCommand) -> None:
        roles_changed = False
        async with self.uow_factory.begin():
            await self.user_tenant_repo.lock_tenant_role_updates(cmd.tenant_id)
            membership = await self.user_tenant_repo.find_membership(cmd.target_user_id, cmd.tenant_id)
            if not membership:
                raise EntityNotFoundError("Membro da Empresa", str(cmd.target_user_id))

            clean_roles = list(dict.fromkeys(r.strip().upper() for r in cmd.roles if r.strip()))
            if not clean_roles:
                clean_roles = ["OPERADOR_CAIXA"]
            assignable_roles = {role.value for role in RoleType if role is not RoleType.SUPER_ADMIN}
            if not set(clean_roles).issubset(assignable_roles):
                raise DomainError("Um ou mais papéis não são válidos.", code="INVALID_ROLE")
            current_roles = await self.user_tenant_repo.get_user_roles_in_tenant(
                cmd.target_user_id,
                cmd.tenant_id,
            )
            if "ADMIN" in current_roles and "ADMIN" not in clean_roles:
                if cmd.actor_user_id == cmd.target_user_id:
                    raise ConflictError("Não é permitido remover os próprios privilégios de administrador.")
                if await self.user_tenant_repo.count_active_admins(cmd.tenant_id) <= 1:
                    raise ConflictError("Não é possível remover o último administrador activo da empresa.")

            roles_changed = set(current_roles) != set(clean_roles)
            await self.user_tenant_repo.update_roles(cmd.target_user_id, cmd.tenant_id, clean_roles)

        if roles_changed:
            await self._invalidate_existing_sessions(cmd)

    async def _invalidate_existing_sessions(self, cmd: UpdateUserRolesCommand) -> None:
        """Impede que tokens emitidos antes da mudança de papéis continuem válidos."""
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
