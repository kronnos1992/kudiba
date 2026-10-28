import time
import uuid

from src.domain.error import EntityNotFoundError, InvalidCredentialsError
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.cache_service import ICacheService
from src.domain.ports.password_hasher import IPasswordHasher
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.user_repository import IUserRepository


class ManagePasswordUseCase:
    def __init__(
        self,
        user_repo: IUserRepository,
        password_hasher: IPasswordHasher,
        refresh_token_repo: IRefreshTokenRepository,
        cache_service: ICacheService,
        audit_repo: IAuditRepository,
        session_revocation_ttl_seconds: int = 3600,
    ):
        self.user_repo = user_repo
        self.password_hasher = password_hasher
        self.refresh_token_repo = refresh_token_repo
        self.cache_service = cache_service
        self.audit_repo = audit_repo
        self.session_revocation_ttl_seconds = session_revocation_ttl_seconds

    async def change_own_password(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        current_password: str,
        new_password: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        user = await self.user_repo.find_by_id(user_id)
        if not user or not user.is_active:
            raise EntityNotFoundError("Utilizador", str(user_id))
        if not self.password_hasher.verify(current_password, user.password_hash):
            raise InvalidCredentialsError()
        await self._set_password(user_id, tenant_id, user_id, new_password, ip_address, user_agent, "PASSWORD_CHANGED")

    async def reset_user_password(
        self,
        target_user_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        new_password: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> None:
        user = await self.user_repo.find_by_id(target_user_id)
        if not user or not user.is_active:
            raise EntityNotFoundError("Utilizador", str(target_user_id))
        await self._set_password(
            target_user_id,
            tenant_id,
            actor_user_id,
            new_password,
            ip_address,
            user_agent,
            "PASSWORD_RESET_BY_SYSADMIN",
        )

    async def _set_password(
        self,
        target_user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        actor_user_id: uuid.UUID,
        new_password: str,
        ip_address: str | None,
        user_agent: str | None,
        action: str,
    ) -> None:
        updated = await self.user_repo.update_password_hash(
            target_user_id,
            self.password_hasher.hash(new_password),
        )
        if not updated:
            raise EntityNotFoundError("Utilizador", str(target_user_id))

        await self.refresh_token_repo.revoke_user_tokens(target_user_id)
        await self.cache_service.revoke_user_sessions_before(
            str(target_user_id),
            int(time.time()),
            self.session_revocation_ttl_seconds,
        )
        await self.audit_repo.record_event(
            action=action,
            user_id=actor_user_id,
            tenant_id=tenant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details={"target_user_id": str(target_user_id)},
        )
