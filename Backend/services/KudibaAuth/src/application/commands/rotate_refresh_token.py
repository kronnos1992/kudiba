import uuid
from datetime import datetime, timedelta, timezone
from src.application.dto import (
    AuthenticationResult,
    BranchSummaryDto,
    RotateRefreshTokenCommand,
    TenantSummaryDto,
    UserSummaryDto,
)
from src.domain.entities.refresh_token import RefreshToken
from src.domain.error import SessionExpiredError, TenantAccessForbiddenError, TokenReusedError
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.tenant_repository import ITenantRepository
from src.domain.ports.token_service import ITokenService
from src.domain.ports.unit_of_work import IUnitOfWorkFactory
from src.domain.ports.user_repository import IUserRepository
from src.domain.ports.user_tenant_repository import IUserTenantRepository


class RotateRefreshTokenUseCase:
    """Caso de uso de renovação de sessão e rotação de Refresh Token."""
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        user_repo: IUserRepository,
        tenant_repo: ITenantRepository,
        user_tenant_repo: IUserTenantRepository,
        refresh_token_repo: IRefreshTokenRepository,
        token_service: ITokenService,
        audit_repo: IAuditRepository,
        refresh_token_days: int = 7,
    ):
        self.uow_factory = uow_factory
        self.user_repo = user_repo
        self.tenant_repo = tenant_repo
        self.user_tenant_repo = user_tenant_repo
        self.refresh_token_repo = refresh_token_repo
        self.token_service = token_service
        self.audit_repo = audit_repo
        self.refresh_token_days = refresh_token_days

    async def execute(self, cmd: RotateRefreshTokenCommand) -> AuthenticationResult:
        now = datetime.now(timezone.utc)
        token_hash = self.token_service.hash_refresh_token(cmd.refresh_token)

        async with self.uow_factory.begin() as uow:
            token_entry = await self.refresh_token_repo.find_by_hash(token_hash)
            if not token_entry:
                raise SessionExpiredError("Token de renovação inválido ou expirado.")

            # DETECÇÃO CRÍTICA DE REUSO DE REFRESH TOKEN (ROUBO DE SESSÃO)
            if token_entry.is_revoked:
                await self.refresh_token_repo.revoke_family(token_entry.family_id)
                await self.audit_repo.record_event(
                    action="TOKEN_THEFT_DETECTED",
                    user_id=token_entry.user_id,
                    tenant_id=token_entry.tenant_id,
                    ip_address=cmd.ip_address,
                    user_agent=cmd.user_agent,
                    details={"family_id": str(token_entry.family_id)},
                )
                await uow.commit()
                raise TokenReusedError()

            if token_entry.is_expired(now):
                await self.refresh_token_repo.revoke_token(token_hash)
                await uow.commit()
                raise SessionExpiredError("O prazo do token de renovação expirou.")

            # Prepara o sucessor; o repositório consome o token anterior e guarda
            # este sucessor atomicamente, evitando duas rotações concorrentes.
            new_raw_refresh, new_refresh_hash = self.token_service.generate_refresh_token()
            new_entity = RefreshToken(
                id=uuid.uuid4(),
                user_id=token_entry.user_id,
                tenant_id=token_entry.tenant_id,
                token_hash=new_refresh_hash,
                family_id=token_entry.family_id,
                expires_at=now + timedelta(days=self.refresh_token_days),
                user_agent=cmd.user_agent,
                ip_address=cmd.ip_address,
            )

            # Carrega dados actualizados do utilizador e tenant
            user = await self.user_repo.find_by_id(token_entry.user_id)
            if not user or not user.is_active:
                raise SessionExpiredError("Utilizador inactivo.")

            membership = await self.user_tenant_repo.find_membership(user.id, token_entry.tenant_id)
            if not membership or not membership.is_active:
                raise TenantAccessForbiddenError("Acesso à empresa desactivado.")

            rotated = await self.refresh_token_repo.replace_active_token(token_hash, new_entity, now)
            if not rotated:
                await self.refresh_token_repo.revoke_family(token_entry.family_id)
                await self.audit_repo.record_event(
                    action="TOKEN_THEFT_DETECTED",
                    user_id=token_entry.user_id,
                    tenant_id=token_entry.tenant_id,
                    ip_address=cmd.ip_address,
                    user_agent=cmd.user_agent,
                    details={"family_id": str(token_entry.family_id)},
                )
                await uow.commit()
                raise TokenReusedError()

            tenant = await self.tenant_repo.find_by_id(token_entry.tenant_id)
            if not tenant or not tenant.is_active:
                raise TenantAccessForbiddenError("A empresa associada à sessão não existe ou está inactiva.")
            tenant_slug = tenant.slug
            tenant_name = tenant.company_name
            tenant_nif = tenant.nif

            branch_id = membership.default_branch_id
            branch_dto = None
            if branch_id:
                branch = await self.tenant_repo.find_branch_by_id(branch_id, token_entry.tenant_id)
                if branch:
                    branch_dto = BranchSummaryDto(id=branch.id, code=branch.code, name=branch.name, city=branch.city)

            roles = await self.user_tenant_repo.get_user_roles_in_tenant(user.id, token_entry.tenant_id)
            permissions = await self.user_tenant_repo.get_roles_permissions(roles)

            access_token, _, exp_ts = self.token_service.create_access_token(
                user_id=str(user.id),
                tenant_id=str(token_entry.tenant_id),
                roles=roles,
                permissions=permissions,
                tenant_slug=tenant_slug,
                branch_id=str(branch_id) if branch_id else None,
            )

            await self.audit_repo.record_event(
                action="REFRESH_SUCCESS",
                user_id=user.id,
                tenant_id=token_entry.tenant_id,
                ip_address=cmd.ip_address,
                user_agent=cmd.user_agent,
                details={"family_id": str(token_entry.family_id)},
            )

            branches = await self.tenant_repo.find_branches(token_entry.tenant_id)
            branch_dtos = [
                BranchSummaryDto(id=b.id, code=b.code, name=b.name, city=b.city) for b in branches
            ]

            return AuthenticationResult(
                access_token=access_token,
                refresh_token=new_raw_refresh,
                token_type="Bearer",
                expires_in=max(0, exp_ts - int(datetime.now(timezone.utc).timestamp())),
                user=UserSummaryDto(
                    id=user.id,
                    email=user.email.value,
                    full_name=user.full_name,
                    is_superadmin=user.is_superadmin,
                ),
                active_tenant=TenantSummaryDto(
                    id=token_entry.tenant_id,
                    slug=tenant_slug,
                    company_name=tenant_name,
                    nif=tenant_nif,
                    roles=roles,
                    permissions=permissions,
                    default_branch=branch_dto,
                    branches=branch_dtos,
                ),
            )
