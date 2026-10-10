import uuid
from src.application.dto import InviteUserCommand, TenantMemberDto
from src.domain.entities.user import User
from src.domain.entities.user_tenant import UserTenant
from src.domain.error import ConflictError, DomainError
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.password_hasher import IPasswordHasher
from src.domain.ports.unit_of_work import IUnitOfWorkFactory
from src.domain.ports.user_repository import IUserRepository
from src.domain.ports.user_tenant_repository import IUserTenantRepository
from src.domain.value_objects.email import Email
from src.domain.value_objects.role_type import RoleType


class InviteUserUseCase:
    """Caso de uso para convidar ou associar utilizador a uma organização."""
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        user_repo: IUserRepository,
        user_tenant_repo: IUserTenantRepository,
        password_hasher: IPasswordHasher,
        audit_repo: IAuditRepository,
    ):
        self.uow_factory = uow_factory
        self.user_repo = user_repo
        self.user_tenant_repo = user_tenant_repo
        self.password_hasher = password_hasher
        self.audit_repo = audit_repo

    async def execute(self, cmd: InviteUserCommand) -> TenantMemberDto:
        email_vo = Email(cmd.email)
        roles = list(dict.fromkeys(r.strip().upper() for r in cmd.roles if r.strip()))
        if not roles:
            roles = ["OPERADOR_CAIXA"]
        assignable_roles = {role.value for role in RoleType if role is not RoleType.SUPER_ADMIN}
        if not set(roles).issubset(assignable_roles):
            raise DomainError("Um ou mais papéis não são válidos.", code="INVALID_ROLE")

        async with self.uow_factory.begin():
            user = await self.user_repo.find_by_email(email_vo.value)
            if not user:
                if not cmd.password or not 12 <= len(cmd.password) <= 1024:
                    raise DomainError("A password inicial deve ter entre 12 e 1024 caracteres.", code="INVALID_PASSWORD")
                user = User(
                    id=uuid.uuid4(),
                    email=email_vo,
                    full_name=cmd.full_name.strip(),
                    password_hash=self.password_hasher.hash(cmd.password),
                    is_active=True,
                )
                await self.user_repo.save(user)

            # Verifica se já pertence à organização
            existing_membership = await self.user_tenant_repo.find_membership(user.id, cmd.target_tenant_id)
            if existing_membership:
                raise ConflictError("O utilizador já se encontra associado a esta empresa.")

            # Cria novo vínculo
            new_membership = UserTenant(
                id=uuid.uuid4(),
                user_id=user.id,
                tenant_id=cmd.target_tenant_id,
                default_branch_id=cmd.branch_id,
                status="ACTIVE",
            )
            await self.user_tenant_repo.save_membership(new_membership)

            # Atribui papéis
            await self.user_tenant_repo.assign_roles(user.id, cmd.target_tenant_id, roles)
            await self.audit_repo.record_event(
                action="USER_INVITED",
                user_id=cmd.actor_user_id,
                tenant_id=cmd.target_tenant_id,
                email_attempted=email_vo.value,
                details={"target_user_id": str(user.id), "roles": roles},
            )

            return TenantMemberDto(
                user_id=user.id,
                email=user.email.value,
                full_name=user.full_name,
                roles=roles,
                status="ACTIVE",
                default_branch_id=cmd.branch_id,
            )
