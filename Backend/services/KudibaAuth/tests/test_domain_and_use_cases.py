import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import pytest

from src.application.commands import (
    AuthenticateUserUseCase,
    InviteUserUseCase,
    LogoutUserUseCase,
    RotateRefreshTokenUseCase,
    SwitchTenantUseCase,
    UpdateUserRolesUseCase,
)
from src.application.dto import (
    AuthenticateUserCommand,
    InviteUserCommand,
    LogoutUserCommand,
    RotateRefreshTokenCommand,
    SwitchTenantCommand,
    UpdateUserRolesCommand,
)
from src.domain.entities.branch import Branch
from src.domain.entities.refresh_token import RefreshToken
from src.domain.entities.tenant import Tenant
from src.domain.entities.user import User
from src.domain.entities.user_tenant import UserTenant
from src.domain.error import (
    AccountLockedError,
    ConflictError,
    DomainError,
    InvalidCredentialsError,
    TenantAccessForbiddenError,
    TokenReusedError,
)
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.cache_service import ICacheService
from src.domain.ports.password_hasher import IPasswordHasher
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.tenant_repository import ITenantRepository
from src.domain.ports.token_service import ITokenService
from src.domain.ports.unit_of_work import IUnitOfWork, IUnitOfWorkFactory
from src.domain.ports.user_repository import IUserRepository
from src.domain.ports.user_tenant_repository import IUserTenantRepository
from src.domain.services.security_policy import AccountSecurityPolicy
from src.domain.value_objects.email import Email


# =============================================================================
# IN-MEMORY MOCKS DOS PORTS DE DOMÍNIO
# =============================================================================

class MockUnitOfWork(IUnitOfWork):
    async def commit(self) -> None:
        pass

    async def rollback(self) -> None:
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


class MockUnitOfWorkFactory(IUnitOfWorkFactory):
    def begin(self) -> IUnitOfWork:
        return MockUnitOfWork()


class MockUserRepository(IUserRepository):
    def __init__(self):
        self.users: Dict[uuid.UUID, User] = {}

    async def find_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return self.users.get(user_id)

    async def find_by_email(self, email: str) -> Optional[User]:
        clean = email.strip().lower()
        for u in self.users.values():
            if u.email.value == clean:
                return u
        return None

    async def save(self, user: User) -> None:
        self.users[user.id] = user

    async def update_login_state(self, user: User) -> None:
        self.users[user.id] = user


class MockTenantRepository(ITenantRepository):
    def __init__(self):
        self.tenants: Dict[uuid.UUID, Tenant] = {}
        self.branches: Dict[uuid.UUID, Branch] = {}

    async def find_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        return self.tenants.get(tenant_id)

    async def find_by_slug(self, slug: str) -> Optional[Tenant]:
        for t in self.tenants.values():
            if t.slug == slug:
                return t
        return None

    async def find_branches(self, tenant_id: uuid.UUID) -> List[Branch]:
        return [b for b in self.branches.values() if b.tenant_id == tenant_id]

    async def find_branch_by_id(self, branch_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[Branch]:
        b = self.branches.get(branch_id)
        return b if b and b.tenant_id == tenant_id else None

    async def save_branch(self, branch: Branch) -> None:
        self.branches[branch.id] = branch


class MockUserTenantRepository(IUserTenantRepository):
    def __init__(self):
        self.memberships: List[UserTenant] = []
        self.roles: Dict[str, List[str]] = {}  # f"{user_id}:{tenant_id}" -> list of roles

    async def find_membership(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[UserTenant]:
        for m in self.memberships:
            if m.user_id == user_id and m.tenant_id == tenant_id:
                return m
        return None

    async def find_user_memberships(self, user_id: uuid.UUID) -> List[UserTenant]:
        return [m for m in self.memberships if m.user_id == user_id]

    async def find_tenant_members(self, tenant_id: uuid.UUID):
        return []

    async def save_membership(self, membership: UserTenant) -> None:
        self.memberships.append(membership)

    async def get_user_roles_in_tenant(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> List[str]:
        return self.roles.get(f"{user_id}:{tenant_id}", ["OPERADOR_CAIXA"])

    async def get_roles_permissions(self, role_ids: List[str]) -> List[str]:
        perms = []
        for r in role_ids:
            if r.upper() in ["ADMIN", "CONTABILISTA"]:
                perms.extend(["invoices:issue", "invoices:cancel", "fiscal:saft:export"])
            else:
                perms.append("invoices:issue")
        return sorted(list(set(perms)))

    async def assign_roles(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: List[str]) -> None:
        self.roles[f"{user_id}:{tenant_id}"] = roles

    async def update_roles(self, user_id: uuid.UUID, tenant_id: uuid.UUID, roles: List[str]) -> None:
        self.roles[f"{user_id}:{tenant_id}"] = roles

    async def lock_tenant_role_updates(self, tenant_id: uuid.UUID) -> None:
        pass

    async def count_active_admins(self, tenant_id: uuid.UUID) -> int:
        return sum(
            1
            for key, roles in self.roles.items()
            if key.endswith(f":{tenant_id}") and "ADMIN" in roles
        )


class MockRefreshTokenRepository(IRefreshTokenRepository):
    def __init__(self):
        self.tokens: Dict[str, RefreshToken] = {}

    async def find_by_hash(self, token_hash: str) -> Optional[RefreshToken]:
        return self.tokens.get(token_hash)

    async def save(self, token: RefreshToken) -> None:
        self.tokens[token.token_hash] = token

    async def revoke_family(self, family_id: uuid.UUID) -> None:
        for t in self.tokens.values():
            if t.family_id == family_id:
                t.is_revoked = True

    async def revoke_token(self, token_hash: str) -> None:
        if token_hash in self.tokens:
            self.tokens[token_hash].is_revoked = True

    async def revoke_user_tenant_tokens(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> int:
        revoked = 0
        for t in self.tokens.values():
            if t.user_id == user_id and t.tenant_id == tenant_id and not t.is_revoked:
                t.is_revoked = True
                revoked += 1
        return revoked

    async def replace_active_token(self, token_hash: str, replacement: RefreshToken, now: datetime) -> bool:
        token = self.tokens.get(token_hash)
        if not token or token.is_revoked or token.is_expired(now):
            return False
        token.is_revoked = True
        self.tokens[replacement.token_hash] = replacement
        return True


class MockPasswordHasher(IPasswordHasher):
    def __init__(self):
        self.verification_count = 0

    def hash(self, password: str) -> str:
        return f"hashed_{password}"

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        self.verification_count += 1
        return hashed_password == f"hashed_{plain_password}"


class MockTokenService(ITokenService):
    def create_access_token(self, user_id, tenant_id, roles, permissions, tenant_slug=None, branch_id=None, expires_minutes=None):
        return f"jwt_{user_id}_{tenant_id}", str(uuid.uuid4()), int(datetime.now(timezone.utc).timestamp()) + 900

    def decode_access_token(self, token: str):
        return {"sub": str(uuid.uuid4()), "tenant_id": str(uuid.uuid4()), "roles": ["ADMIN"], "jti": "jti-1", "exp": 1000}

    def generate_refresh_token(self):
        raw = f"raw_{uuid.uuid4()}"
        return raw, f"hash_{raw}"

    def hash_refresh_token(self, raw_token: str) -> str:
        return f"hash_{raw_token}"


class MockCacheService(ICacheService):
    def __init__(self):
        self.blacklist = set()
        self.revoked_before: Dict[str, int] = {}

    async def blacklist_token(self, jti: str, ttl_seconds: int) -> None:
        self.blacklist.add(jti)

    async def is_token_blacklisted(self, jti: str) -> bool:
        return jti in self.blacklist

    async def revoke_sessions_before(self, user_id: str, tenant_id: str, epoch: int, ttl_seconds: int) -> None:
        self.revoked_before[f"{user_id}:{tenant_id}"] = epoch

    async def get_revoked_before(self, user_id: str, tenant_id: str) -> int:
        return self.revoked_before.get(f"{user_id}:{tenant_id}", 0)


class MockAuditRepository(IAuditRepository):
    def __init__(self):
        self.events = []

    async def record_event(self, action, user_id=None, tenant_id=None, email_attempted=None, ip_address=None, user_agent=None, details=None):
        self.events.append({"action": action, "user_id": user_id, "tenant_id": tenant_id})


# =============================================================================
# TESTES DE UNIDADE E CASOS DE USO
# =============================================================================

def test_domain_email_value_object():
    valid = Email("admin@kudiba.ao")
    assert valid.value == "admin@kudiba.ao"

    with pytest.raises(DomainError):
        Email("invalido_sem_arroba")


def test_domain_user_lockout_policy():
    policy = AccountSecurityPolicy(max_login_attempts=3, lockout_minutes=10)
    user = User(
        id=uuid.uuid4(),
        email=Email("user@test.ao"),
        full_name="User Teste",
        password_hash="pass",
    )

    assert policy.is_locked(user) is False

    # 1ª e 2ª falhas: não bloqueia
    assert policy.check_and_apply_failure(user) is False
    assert policy.check_and_apply_failure(user) is False
    assert policy.is_locked(user) is False

    # 3ª falha: bloqueia!
    assert policy.check_and_apply_failure(user) is True
    assert policy.is_locked(user) is True
    assert policy.minutes_remaining(user) > 0

    # Reseta tentativas
    user.reset_failed_logins()
    assert policy.is_locked(user) is False


@pytest.mark.asyncio
async def test_authenticate_user_use_case_success_and_failure():
    uow_factory = MockUnitOfWorkFactory()
    user_repo = MockUserRepository()
    tenant_repo = MockTenantRepository()
    user_tenant_repo = MockUserTenantRepository()
    refresh_token_repo = MockRefreshTokenRepository()
    hasher = MockPasswordHasher()
    token_svc = MockTokenService()
    audit_repo = MockAuditRepository()
    policy = AccountSecurityPolicy(max_login_attempts=3, lockout_minutes=15)

    use_case = AuthenticateUserUseCase(
        uow_factory=uow_factory,
        user_repo=user_repo,
        tenant_repo=tenant_repo,
        user_tenant_repo=user_tenant_repo,
        refresh_token_repo=refresh_token_repo,
        password_hasher=hasher,
        token_service=token_svc,
        audit_repo=audit_repo,
        security_policy=policy,
    )

    # Cria dados de teste
    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=Email("admin@kudiba.ao"),
        full_name="Admin",
        password_hash=hasher.hash("SenhaCorreta123"),
    )
    await user_repo.save(user)

    tenant = Tenant(id=tenant_id, slug="demo", company_name="Kudiba Lda", nif="5000000000")
    tenant_repo.tenants[tenant_id] = tenant

    membership = UserTenant(id=uuid.uuid4(), user_id=user_id, tenant_id=tenant_id)
    await user_tenant_repo.save_membership(membership)
    await user_tenant_repo.assign_roles(user_id, tenant_id, ["ADMIN", "CONTABILISTA"])

    # 1. Falha: Senha errada
    cmd_fail = AuthenticateUserCommand(email="admin@kudiba.ao", password="SenhaErrada")
    with pytest.raises(InvalidCredentialsError):
        await use_case.execute(cmd_fail)
    assert user.failed_login_attempts == 1

    # 2. Sucesso: Senha correta
    cmd_ok = AuthenticateUserCommand(email="admin@kudiba.ao", password="SenhaCorreta123")
    result = await use_case.execute(cmd_ok)
    assert result.access_token.startswith("jwt_")
    assert result.user.email == "admin@kudiba.ao"
    assert result.active_tenant.slug == "demo"
    assert "ADMIN" in result.active_tenant.roles
    assert user.failed_login_attempts == 0

    with pytest.raises(TenantAccessForbiddenError):
        await use_case.execute(
            AuthenticateUserCommand(
                email="admin@kudiba.ao",
                password="SenhaCorreta123",
                target_tenant_id=uuid.uuid4(),
            )
        )

    verification_count = hasher.verification_count
    with pytest.raises(InvalidCredentialsError):
        await use_case.execute(
            AuthenticateUserCommand(
                email="unknown@kudiba.ao",
                password="SenhaCorreta123",
            )
        )
    assert hasher.verification_count == verification_count + 1


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_theft_detection():
    uow_factory = MockUnitOfWorkFactory()
    user_repo = MockUserRepository()
    tenant_repo = MockTenantRepository()
    user_tenant_repo = MockUserTenantRepository()
    refresh_token_repo = MockRefreshTokenRepository()
    token_svc = MockTokenService()
    audit_repo = MockAuditRepository()

    use_case = RotateRefreshTokenUseCase(
        uow_factory=uow_factory,
        user_repo=user_repo,
        tenant_repo=tenant_repo,
        user_tenant_repo=user_tenant_repo,
        refresh_token_repo=refresh_token_repo,
        token_service=token_svc,
        audit_repo=audit_repo,
    )

    user_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    family_id = uuid.uuid4()
    tenant_repo.tenants[tenant_id] = Tenant(
        id=tenant_id,
        slug="test-tenant",
        company_name="Tenant Teste",
        nif="5000000000",
    )
    user = User(id=user_id, email=Email("user@test.ao"), full_name="User", password_hash="h")
    await user_repo.save(user)

    membership = UserTenant(id=uuid.uuid4(), user_id=user_id, tenant_id=tenant_id)
    await user_tenant_repo.save_membership(membership)

    raw_token = "valid_raw_token"
    token_hash = token_svc.hash_refresh_token(raw_token)
    token_entity = RefreshToken(
        id=uuid.uuid4(),
        user_id=user_id,
        tenant_id=tenant_id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await refresh_token_repo.save(token_entity)

    # 1. Rotação bem-sucedida
    res = await use_case.execute(RotateRefreshTokenCommand(refresh_token=raw_token))
    assert res.access_token is not None
    assert token_entity.is_revoked is True  # O token anterior foi invalidado

    # 2. DETECÇÃO DE ROUBO: Reuso do token já revogado!
    with pytest.raises(TokenReusedError):
        await use_case.execute(RotateRefreshTokenCommand(refresh_token=raw_token))


@pytest.mark.asyncio
async def test_inviting_new_user_requires_an_explicit_password():
    users = MockUserRepository()
    use_case = InviteUserUseCase(
        uow_factory=MockUnitOfWorkFactory(),
        user_repo=users,
        user_tenant_repo=MockUserTenantRepository(),
        password_hasher=MockPasswordHasher(),
        audit_repo=MockAuditRepository(),
    )

    with pytest.raises(DomainError, match="password inicial"):
        await use_case.execute(
            InviteUserCommand(
                target_tenant_id=uuid.uuid4(),
                email="new-user@test.ao",
                full_name="New User",
                roles=["OPERADOR_CAIXA"],
            )
        )
    assert not users.users


@pytest.mark.asyncio
async def test_invite_deduplicates_roles_and_audits_the_actor():
    users = MockUserRepository()
    memberships = MockUserTenantRepository()
    audit = MockAuditRepository()
    actor_id = uuid.uuid4()
    tenant_id = uuid.uuid4()
    use_case = InviteUserUseCase(
        uow_factory=MockUnitOfWorkFactory(),
        user_repo=users,
        user_tenant_repo=memberships,
        password_hasher=MockPasswordHasher(),
        audit_repo=audit,
    )

    result = await use_case.execute(
        InviteUserCommand(
            target_tenant_id=tenant_id,
            email="new-user@test.ao",
            full_name="New User",
            password="long-enough-password",
            roles=[" operador_caixa ", "OPERADOR_CAIXA"],
            actor_user_id=actor_id,
        )
    )

    assert result.roles == ["OPERADOR_CAIXA"]
    assert memberships.roles[f"{result.user_id}:{tenant_id}"] == ["OPERADOR_CAIXA"]
    assert audit.events[-1] == {"action": "USER_INVITED", "user_id": actor_id, "tenant_id": tenant_id}


@pytest.mark.asyncio
async def test_invite_rejects_unknown_roles_before_creating_users():
    users = MockUserRepository()
    use_case = InviteUserUseCase(
        uow_factory=MockUnitOfWorkFactory(),
        user_repo=users,
        user_tenant_repo=MockUserTenantRepository(),
        password_hasher=MockPasswordHasher(),
        audit_repo=MockAuditRepository(),
    )

    with pytest.raises(DomainError, match="papéis não são válidos"):
        await use_case.execute(
            InviteUserCommand(
                target_tenant_id=uuid.uuid4(),
                email="new-user@test.ao",
                full_name="New User",
                password="long-enough-password",
                roles=["NOT_A_ROLE"],
            )
        )
    assert not users.users


@pytest.mark.asyncio
async def test_role_update_cannot_remove_the_last_active_admin():
    memberships = MockUserTenantRepository()
    tenant_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    await memberships.save_membership(UserTenant(id=uuid.uuid4(), user_id=admin_id, tenant_id=tenant_id))
    await memberships.assign_roles(admin_id, tenant_id, ["ADMIN"])
    use_case = UpdateUserRolesUseCase(MockUnitOfWorkFactory(), memberships)

    with pytest.raises(ConflictError, match="último administrador"):
        await use_case.execute(
            UpdateUserRolesCommand(
                tenant_id=tenant_id,
                target_user_id=admin_id,
                roles=["OPERADOR_CAIXA"],
                actor_user_id=uuid.uuid4(),
            )
        )
    assert await memberships.get_user_roles_in_tenant(admin_id, tenant_id) == ["ADMIN"]

    second_admin_id = uuid.uuid4()
    await memberships.save_membership(
        UserTenant(id=uuid.uuid4(), user_id=second_admin_id, tenant_id=tenant_id)
    )
    await memberships.assign_roles(second_admin_id, tenant_id, ["ADMIN"])
    with pytest.raises(ConflictError, match="próprios privilégios"):
        await use_case.execute(
            UpdateUserRolesCommand(
                tenant_id=tenant_id,
                target_user_id=admin_id,
                roles=["OPERADOR_CAIXA"],
                actor_user_id=admin_id,
            )
        )


@pytest.mark.asyncio
async def test_role_update_revokes_existing_sessions():
    memberships = MockUserTenantRepository()
    refresh_tokens = MockRefreshTokenRepository()
    cache = MockCacheService()
    tenant_id = uuid.uuid4()
    target_id = uuid.uuid4()
    await memberships.save_membership(UserTenant(id=uuid.uuid4(), user_id=target_id, tenant_id=tenant_id))
    await memberships.assign_roles(target_id, tenant_id, ["OPERADOR_CAIXA"])

    active = RefreshToken(
        id=uuid.uuid4(),
        user_id=target_id,
        tenant_id=tenant_id,
        token_hash="hash-active",
        family_id=uuid.uuid4(),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    await refresh_tokens.save(active)

    use_case = UpdateUserRolesUseCase(
        MockUnitOfWorkFactory(),
        memberships,
        refresh_token_repo=refresh_tokens,
        cache_service=cache,
    )

    await use_case.execute(
        UpdateUserRolesCommand(
            tenant_id=tenant_id,
            target_user_id=target_id,
            roles=["CONTABILISTA"],
            actor_user_id=uuid.uuid4(),
        )
    )

    assert await memberships.get_user_roles_in_tenant(target_id, tenant_id) == ["CONTABILISTA"]
    assert active.is_revoked is True
    assert await cache.get_revoked_before(str(target_id), str(tenant_id)) > 0


@pytest.mark.asyncio
async def test_role_update_without_changes_keeps_sessions():
    memberships = MockUserTenantRepository()
    cache = MockCacheService()
    tenant_id = uuid.uuid4()
    target_id = uuid.uuid4()
    await memberships.save_membership(UserTenant(id=uuid.uuid4(), user_id=target_id, tenant_id=tenant_id))
    await memberships.assign_roles(target_id, tenant_id, ["CONTABILISTA"])

    use_case = UpdateUserRolesUseCase(
        MockUnitOfWorkFactory(),
        memberships,
        cache_service=cache,
    )

    await use_case.execute(
        UpdateUserRolesCommand(
            tenant_id=tenant_id,
            target_user_id=target_id,
            roles=["CONTABILISTA"],
            actor_user_id=uuid.uuid4(),
        )
    )

    assert await cache.get_revoked_before(str(target_id), str(tenant_id)) == 0


@pytest.mark.asyncio
async def test_logout_use_case_blacklists_jwt():
    uow_factory = MockUnitOfWorkFactory()
    refresh_token_repo = MockRefreshTokenRepository()
    token_svc = MockTokenService()
    cache_svc = MockCacheService()
    audit_repo = MockAuditRepository()

    use_case = LogoutUserUseCase(
        uow_factory=uow_factory,
        refresh_token_repo=refresh_token_repo,
        token_service=token_svc,
        cache_service=cache_svc,
        audit_repo=audit_repo,
    )

    cmd = LogoutUserCommand(
        user_id=uuid.uuid4(),
        access_token_jti="jwt-uuid-1234",
        access_token_exp=int(datetime.now(timezone.utc).timestamp()) + 600,
    )
    await use_case.execute(cmd)

    assert await cache_svc.is_token_blacklisted("jwt-uuid-1234") is True
