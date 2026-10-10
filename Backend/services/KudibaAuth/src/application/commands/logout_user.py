from datetime import datetime, timezone
from src.application.dto import LogoutUserCommand
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.cache_service import ICacheService
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.token_service import ITokenService
from src.domain.ports.unit_of_work import IUnitOfWorkFactory


class LogoutUserUseCase:
    """Caso de uso de encerramento de sessão (Logout com Blacklist no Redis)."""
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        refresh_token_repo: IRefreshTokenRepository,
        token_service: ITokenService,
        cache_service: ICacheService,
        audit_repo: IAuditRepository,
    ):
        self.uow_factory = uow_factory
        self.refresh_token_repo = refresh_token_repo
        self.token_service = token_service
        self.cache_service = cache_service
        self.audit_repo = audit_repo

    async def execute(self, cmd: LogoutUserCommand) -> None:
        # 1. Invalida o Refresh Token no banco de dados
        if cmd.refresh_token:
            token_hash = self.token_service.hash_refresh_token(cmd.refresh_token)
            async with self.uow_factory.begin():
                await self.refresh_token_repo.revoke_token(token_hash)

        # 2. Adiciona o JTI do Access Token na Blacklist do Redis (consumido pelo Gateway Rust)
        if cmd.access_token_jti:
            now_ts = int(datetime.now(timezone.utc).timestamp())
            ttl = (cmd.access_token_exp - now_ts) if cmd.access_token_exp and cmd.access_token_exp > now_ts else 3600
            await self.cache_service.blacklist_token(cmd.access_token_jti, ttl)

        # 3. Log de Auditoria
        if cmd.user_id:
            await self.audit_repo.record_event(
                action="LOGOUT",
                user_id=cmd.user_id,
                ip_address=cmd.ip_address,
                details={"jti": cmd.access_token_jti},
            )
