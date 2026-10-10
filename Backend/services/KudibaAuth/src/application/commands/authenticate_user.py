import uuid
from datetime import datetime, timedelta, timezone
from src.application.dto import (
    AuthenticateUserCommand,
    AuthenticationResult,
    BranchSummaryDto,
    TenantSummaryDto,
    UserSummaryDto,
)
from src.domain.error import (
    AccountInactiveError,
    AccountLockedError,
    InvalidCredentialsError,
    TenantAccessForbiddenError,
)
from src.domain.entities.refresh_token import RefreshToken
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.password_hasher import IPasswordHasher
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.tenant_repository import ITenantRepository
from src.domain.ports.token_service import ITokenService
from src.domain.ports.unit_of_work import IUnitOfWorkFactory
from src.domain.ports.user_repository import IUserRepository
from src.domain.ports.user_tenant_repository import IUserTenantRepository
from src.domain.services.security_policy import AccountSecurityPolicy
from src.domain.value_objects.email import Email


DUMMY_PASSWORD_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=4$ZntcwQVQCRVv7a1EopD77Q$"
    "Jc8mZVbf/CDgIishv/hzmCLpOzzubFcXTJooWRKilDE"
)


class AuthenticateUserUseCase:
    """Caso de uso de autenticação de utilizador (CQRS Command)."""
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        user_repo: IUserRepository,
        tenant_repo: ITenantRepository,
        user_tenant_repo: IUserTenantRepository,
        refresh_token_repo: IRefreshTokenRepository,
        password_hasher: IPasswordHasher,
        token_service: ITokenService,
        audit_repo: IAuditRepository,
        security_policy: AccountSecurityPolicy,
        refresh_token_days: int = 7,
    ):
        self.uow_factory = uow_factory
        self.user_repo = user_repo
        self.tenant_repo = tenant_repo
        self.user_tenant_repo = user_tenant_repo
        self.refresh_token_repo = refresh_token_repo
        self.password_hasher = password_hasher
        self.token_service = token_service
        self.audit_repo = audit_repo
        self.security_policy = security_policy
        self.refresh_token_days = refresh_token_days

    async def execute(self, cmd: AuthenticateUserCommand) -> AuthenticationResult:
        now = datetime.now(timezone.utc)
        try:
            email_vo = Email(cmd.email)
        except Exception:
            raise InvalidCredentialsError()

        # 1. Abre transação delimitada (Unit of Work)
        async with self.uow_factory.begin() as uow:
            user = await self.user_repo.find_by_email(email_vo.value)
            if not user:
                self.password_hasher.verify(cmd.password, DUMMY_PASSWORD_HASH)
                await self.audit_repo.record_event(
                    action="LOGIN_FAILED",
                    email_attempted=email_vo.value,
                    ip_address=cmd.ip_address,
                    user_agent=cmd.user_agent,
                    details={"reason": "USER_NOT_FOUND"},
                )
                await uow.commit()
                raise InvalidCredentialsError()

            # 2. Verificação de Bloqueio por Força Bruta
            if self.security_policy.is_locked(user, now):
                minutes = self.security_policy.minutes_remaining(user, now)
                await self.audit_repo.record_event(
                    action="LOGIN_BLOCKED",
                    user_id=user.id,
                    email_attempted=email_vo.value,
                    ip_address=cmd.ip_address,
                    user_agent=cmd.user_agent,
                    details={"reason": "ACCOUNT_LOCKED", "minutes": minutes},
                )
                await uow.commit()
                raise AccountLockedError(minutes_remaining=minutes)

            if not user.is_active:
                raise AccountInactiveError()

            # 3. Validação da Palavra-passe
            if not self.password_hasher.verify(cmd.password, user.password_hash):
                locked = self.security_policy.check_and_apply_failure(user, now)
                await self.user_repo.update_login_state(user)
                await self.audit_repo.record_event(
                    action="USER_LOCKED" if locked else "LOGIN_FAILED",
                    user_id=user.id,
                    email_attempted=email_vo.value,
                    ip_address=cmd.ip_address,
                    user_agent=cmd.user_agent,
                    details={"failed_attempts": user.failed_login_attempts},
                )
                await uow.commit()
                if locked:
                    raise AccountLockedError(minutes_remaining=self.security_policy.lockout_minutes)
                raise InvalidCredentialsError()

            # 4. Sucesso: Reseta tentativas
            user.reset_failed_logins()
            await self.user_repo.update_login_state(user)

            # 5. Resolução da Organização (Tenant)
            memberships = await self.user_tenant_repo.find_user_memberships(user.id)
            active_memberships = [m for m in memberships if m.is_active]
            if not active_memberships and not user.is_superadmin:
                raise TenantAccessForbiddenError("O utilizador não possui nenhuma empresa activa associada.")

            target_membership = None
            if cmd.target_tenant_id:
                target_membership = next((m for m in active_memberships if m.tenant_id == cmd.target_tenant_id), None)
                if not target_membership and not user.is_superadmin:
                    raise TenantAccessForbiddenError("O utilizador não está associado à empresa solicitada.")
                tenant_id = cmd.target_tenant_id
            elif active_memberships:
                target_membership = active_memberships[0]
                tenant_id = target_membership.tenant_id
            else:
                raise TenantAccessForbiddenError("Indique uma empresa activa para iniciar sessão.")

            tenant = await self.tenant_repo.find_by_id(tenant_id)
            if not tenant or not tenant.is_active:
                raise TenantAccessForbiddenError("A empresa solicitada não existe ou está inactiva.")
            tenant_slug = tenant.slug
            tenant_name = tenant.company_name
            tenant_nif = tenant.nif

            # 6. Carrega Filial, Papéis e Permissões
            branch_id = target_membership.default_branch_id if target_membership else None
            branch_dto = None
            if branch_id:
                branch = await self.tenant_repo.find_branch_by_id(branch_id, tenant_id)
                if branch:
                    branch_dto = BranchSummaryDto(id=branch.id, code=branch.code, name=branch.name, city=branch.city)

            roles = await self.user_tenant_repo.get_user_roles_in_tenant(user.id, tenant_id)
            if not roles:
                roles = ["ADMIN"] if user.is_superadmin else ["OPERADOR_CAIXA"]
            permissions = await self.user_tenant_repo.get_roles_permissions(roles)

            # 7. Emite Access Token JWT
            access_token, jti, exp_ts = self.token_service.create_access_token(
                user_id=str(user.id),
                tenant_id=str(tenant_id),
                roles=roles,
                permissions=permissions,
                tenant_slug=tenant_slug,
                branch_id=str(branch_id) if branch_id else None,
            )

            # 8. Emite e persiste Refresh Token rotativo
            raw_refresh, refresh_hash = self.token_service.generate_refresh_token()
            refresh_entity = RefreshToken(
                id=uuid.uuid4(),
                user_id=user.id,
                tenant_id=tenant_id,
                token_hash=refresh_hash,
                family_id=uuid.uuid4(),
                expires_at=now + timedelta(days=self.refresh_token_days),
                user_agent=cmd.user_agent,
                ip_address=cmd.ip_address,
            )
            await self.refresh_token_repo.save(refresh_entity)

            # 9. Registo de Auditoria
            await self.audit_repo.record_event(
                action="LOGIN_SUCCESS",
                user_id=user.id,
                tenant_id=tenant_id,
                email_attempted=email_vo.value,
                ip_address=cmd.ip_address,
                user_agent=cmd.user_agent,
                details={"roles": roles, "branch_id": str(branch_id) if branch_id else None},
            )

            # Carrega filiais do tenant para o resumo
            branches = await self.tenant_repo.find_branches(tenant_id)
            branch_dtos = [
                BranchSummaryDto(id=b.id, code=b.code, name=b.name, city=b.city) for b in branches
            ]

            return AuthenticationResult(
                access_token=access_token,
                refresh_token=raw_refresh,
                token_type="Bearer",
                expires_in=max(0, exp_ts - int(datetime.now(timezone.utc).timestamp())),
                user=UserSummaryDto(
                    id=user.id,
                    email=user.email.value,
                    full_name=user.full_name,
                    is_superadmin=user.is_superadmin,
                ),
                active_tenant=TenantSummaryDto(
                    id=tenant_id,
                    slug=tenant_slug,
                    company_name=tenant_name,
                    nif=tenant_nif,
                    roles=roles,
                    permissions=permissions,
                    default_branch=branch_dto,
                    branches=branch_dtos,
                ),
            )
