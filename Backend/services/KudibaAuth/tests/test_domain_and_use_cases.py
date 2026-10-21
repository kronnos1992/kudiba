import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
import pytest

from src.application.commands import (
    AuthenticateUserUseCase,
    CreateBranchUseCase,
    CreateRoleUseCase,
    DeleteRoleUseCase,
    InviteUserUseCase,
    LogoutUserUseCase,
    RotateRefreshTokenUseCase,
    SwitchTenantUseCase,
    UpdateRolePermissionsUseCase,
    UpdateRoleUseCase,
    UpdateTenantSettingsUseCase,
    UpdateUserRolesUseCase,
)
from src.application.dto import (
    AuthenticateUserCommand,
    CreateBranchCommand,
    CreateRoleCommand,
    InviteUserCommand,
    LogoutUserCommand,
    RotateRefreshTokenCommand,
    SwitchTenantCommand,
    UpdateRoleCommand,
    UpdateRolePermissionsCommand,
    UpdateTenantSettingsCommand,
    UpdateUserRolesCommand,
)
from src.application.queries import GetTenantSettingsUseCase, ListRolesUseCase
from src.domain.entities.branch import Branch
from src.domain.entities.refresh_token import RefreshToken
from src.domain.entities.role import Permission, Role
from src.domain.entities.tenant import Tenant
from src.domain.entities.user import User
from src.domain.entities.user_tenant import UserTenant
from src.domain.error import (
    AccountLockedError,
    AuthorizationError,
    ConflictError,
    DomainError,
    EntityNotFoundError,
    InvalidCredentialsError,
    TenantAccessForbiddenError,
    TokenReusedError,
)
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.cache_service import ICacheService
from src.domain.ports.password_hasher import IPasswordHasher
from src.domain.ports.refresh_token_repository import IRefreshTokenRepository
from src.domain.ports.role_repository import IRoleRepository
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

    async def update_tenant(self, tenant: Tenant) -> Tenant:
        self.tenants[tenant.id] = tenant
        return tenant


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
    def create_access_token(self, user_id, tenant_id, roles, permissions, tenant_slug=None, branch_id=None, expires_minutes=None, modules=None):
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

    async def list_events(self, tenant_id, limit=100, offset=0):
        return [e for e in self.events if e.get("tenant_id") == tenant_id][offset : offset + limit]


class MockRoleRepository(IRoleRepository):
    def __init__(self):
        self.roles: Dict[str, Role] = {}
        self.permissions: Dict[str, Permission] = {}
        self.assignments: Dict[str, int] = {}
        for pid, module in [
            ("invoices:read", "fiscal"),
            ("invoices:issue", "fiscal"),
            ("users:read", "users"),
            ("pos:sale", "pos"),
        ]:
            self.permissions[pid] = Permission(id=pid, module=module, name=pid)

    def _visible(self, role: Role, tenant_id) -> bool:
        return role.tenant_id is None or role.tenant_id == tenant_id

    async def list_roles(self, tenant_id) -> List[Role]:
        return sorted(
            [r for r in self.roles.values() if self._visible(r, tenant_id)],
            key=lambda r: (not r.is_system, r.id),
        )

    async def find_role(self, role_id: str, tenant_id) -> Optional[Role]:
        role = self.roles.get(role_id.strip().upper())
        return role if role and self._visible(role, tenant_id) else None

    async def find_role_owned(self, role_id: str, tenant_id) -> Optional[Role]:
        role = self.roles.get(role_id.strip().upper())
        return role if role and role.tenant_id == tenant_id else None

    async def list_permissions(self) -> List[Permission]:
        return sorted(self.permissions.values(), key=lambda p: p.id)

    async def list_role_ids(self, tenant_id) -> List[str]:
        return sorted(r.id for r in self.roles.values() if self._visible(r, tenant_id))

    async def save_role(self, role: Role, permission_ids: List[str]) -> None:
        self.roles[role.id] = Role(
            id=role.id,
            name=role.name,
            description=role.description,
            is_system=False,
            tenant_id=role.tenant_id,
            permissions=[self.permissions[p] for p in permission_ids if p in self.permissions],
        )

    async def update_role(self, role_id: str, name: str, description: Optional[str]) -> None:
        r = self.roles[role_id]
        r.name = name
        r.description = description

    async def replace_role_permissions(self, role_id: str, permission_ids: List[str]) -> None:
        self.roles[role_id].permissions = [
            self.permissions[p] for p in permission_ids if p in self.permissions
        ]

    async def delete_role(self, role_id: str) -> None:
        self.roles.pop(role_id, None)

    async def count_role_assignments(self, role_id: str, tenant_id=None) -> int:
        return self.assignments.get(role_id, 0)


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


@pytest.mark.asyncio
async def test_update_and_get_tenant_settings_use_case():
    uow_factory = MockUnitOfWorkFactory()
    tenant_repo = MockTenantRepository()
    audit_repo = MockAuditRepository()

    tenant_id = uuid.uuid4()
    actor_id = uuid.uuid4()
    tenant_repo.tenants[tenant_id] = Tenant(
        id=tenant_id,
        slug="empresa-nova",
        company_name="Empresa Nova Lda",
        nif="5417123456",
        onboarding_completed=False,
    )

    update_uc = UpdateTenantSettingsUseCase(uow_factory, tenant_repo, audit_repo)
    get_uc = GetTenantSettingsUseCase(tenant_repo)

    initial = await get_uc.execute(tenant_id)
    assert initial.onboarding_completed is False
    assert initial.company_name == "Empresa Nova Lda"

    updated = await update_uc.execute(
        UpdateTenantSettingsCommand(
            tenant_id=tenant_id,
            company_name="Empresa Nova Angola, Lda.",
            nif="5417123456",
            trade_name="Empresa Nova",
            address_detail="Av. Comandante Valódia, 100",
            city="Luanda",
            province="Luanda",
            postal_code="1000",
            country="AO",
            phone="+244 923 111 222",
            email="geral@empresanova.ao",
            website="https://www.empresanova.ao",
            commercial_registry="Matrícula n.º 9988-24/CML",
            share_capital="2.000.000,00 AOA",
            currency="AOA",
            tax_regime_code="REGIME_GERAL",
            tax_office_code="1ª Repartição Fiscal de Luanda",
            agt_cert_number="AGT/2026/0099",
            default_withholding_rate=6.5,
            invoice_footer_notes="Processado por programa validado n.º AGT/2026/0099",
            bank_accounts=[
                {
                    "bank_name": "BAI",
                    "iban": "AO06.0040.0000.1234.5678.9012.3",
                    "account_number": "1234567890",
                    "swift": "BAIPAOlu",
                    "currency": "AOA",
                    "is_primary": True,
                }
            ],
            onboarding_completed=True,
            actor_user_id=actor_id,
        )
    )

    assert updated.company_name == "Empresa Nova Angola, Lda."
    assert updated.trade_name == "Empresa Nova"
    assert updated.onboarding_completed is True
    assert len(updated.bank_accounts) == 1
    assert updated.bank_accounts[0]["bank_name"] == "BAI"
    assert audit_repo.events[-1]["action"] == "TENANT_SETTINGS_UPDATED"

    create_branch_uc = CreateBranchUseCase(uow_factory, tenant_repo, audit_repo)
    branch_dto = await create_branch_uc.execute(
        CreateBranchCommand(
            tenant_id=tenant_id,
            code="FILIAL-01",
            name="Filial Talatona",
            address_detail="Via S8, Talatona",
            city="Luanda",
            actor_user_id=actor_id,
        )
    )
    assert branch_dto.code == "FILIAL-01"
    assert branch_dto.name == "Filial Talatona"
    assert branch_dto.address_detail == "Via S8, Talatona"



async def test_role_catalog_crud_lifecycle():
    tenant_id = uuid.uuid4()
    role_repo = MockRoleRepository()
    role_repo.roles["ADMIN"] = Role(
        id="ADMIN", name="Administrador Geral", description="Acesso total", is_system=True
    )

    create_uc = CreateRoleUseCase(role_repo)
    update_uc = UpdateRoleUseCase(role_repo)
    perms_uc = UpdateRolePermissionsUseCase(role_repo)
    delete_uc = DeleteRoleUseCase(role_repo)
    list_uc = ListRolesUseCase(role_repo)

    created = await create_uc.execute(
        CreateRoleCommand(
            tenant_id=tenant_id,
            role_id="gerente_loja",
            name="Gerente de Loja",
            description="Gestão comercial da loja",
            permissions=["invoices:read", "pos:sale"],
        )
    )
    assert created.id == "GERENTE_LOJA"
    assert created.is_system is False
    assert created.permissions == ["invoices:read", "pos:sale"]

    with pytest.raises(ConflictError):
        await create_uc.execute(
            CreateRoleCommand(tenant_id=tenant_id, role_id="GERENTE_LOJA", name="Duplicado")
        )

    with pytest.raises(DomainError):
        await create_uc.execute(
            CreateRoleCommand(
                tenant_id=tenant_id, role_id="OUTRO_PERFIL", name="Outro", permissions=["nao:existe"]
            )
        )

    with pytest.raises(DomainError):
        await create_uc.execute(
            CreateRoleCommand(tenant_id=tenant_id, role_id="SUPER_ADMIN", name="Reservado")
        )

    updated = await update_uc.execute(
        UpdateRoleCommand(
            tenant_id=tenant_id, role_id="gerente_loja", name="Gerente Comercial", description="Gestão da loja"
        )
    )
    assert updated.name == "Gerente Comercial"

    with pytest.raises(AuthorizationError):
        await update_uc.execute(
            UpdateRoleCommand(tenant_id=tenant_id, role_id="ADMIN", name="Hackeado")
        )

    republished = await perms_uc.execute(
        UpdateRolePermissionsCommand(
            tenant_id=tenant_id, role_id="GERENTE_LOJA", permissions=["invoices:issue"]
        )
    )
    assert republished.permissions == ["invoices:issue"]

    with pytest.raises(AuthorizationError):
        await perms_uc.execute(
            UpdateRolePermissionsCommand(tenant_id=tenant_id, role_id="ADMIN", permissions=["invoices:issue"])
        )

    catalog = await list_uc.execute(tenant_id)
    assert [r.id for r in catalog] == ["ADMIN", "GERENTE_LOJA"]
    assert catalog[0].is_system is True
    assert catalog[1].users_count == 0

    role_repo.assignments["GERENTE_LOJA"] = 2
    with pytest.raises(ConflictError):
        await delete_uc.execute("GERENTE_LOJA", tenant_id)

    role_repo.assignments["GERENTE_LOJA"] = 0
    await delete_uc.execute("GERENTE_LOJA", tenant_id)
    assert await role_repo.find_role("GERENTE_LOJA", tenant_id) is None

    with pytest.raises(EntityNotFoundError):
        await delete_uc.execute("GERENTE_LOJA", tenant_id)


async def test_role_catalog_is_isolated_between_tenants():
    tenant_a = uuid.uuid4()
    tenant_b = uuid.uuid4()
    role_repo = MockRoleRepository()
    role_repo.roles["ADMIN"] = Role(id="ADMIN", name="Administrador Geral", is_system=True)

    create_uc = CreateRoleUseCase(role_repo)
    list_uc = ListRolesUseCase(role_repo)
    update_uc = UpdateRoleUseCase(role_repo)
    delete_uc = DeleteRoleUseCase(role_repo)

    await create_uc.execute(
        CreateRoleCommand(
            tenant_id=tenant_a,
            role_id="SUPERVISOR",
            name="Supervisor A",
            permissions=["invoices:issue"],
        )
    )
    await create_uc.execute(
        CreateRoleCommand(
            tenant_id=tenant_b,
            role_id="CAIXEIRO",
            name="Caixeiro B",
            permissions=["pos:sale"],
        )
    )

    catalog_a = {r.id: r for r in await list_uc.execute(tenant_a)}
    catalog_b = {r.id: r for r in await list_uc.execute(tenant_b)}
    assert set(catalog_a) == {"ADMIN", "SUPERVISOR"}
    assert set(catalog_b) == {"ADMIN", "CAIXEIRO"}
    assert catalog_a["SUPERVISOR"].permissions == ["invoices:issue"]

    # O tenant B não pode ver nem editar o perfil personalizado do tenant A
    with pytest.raises(EntityNotFoundError):
        await update_uc.execute(
            UpdateRoleCommand(tenant_id=tenant_b, role_id="SUPERVISOR", name="Hack")
        )
    with pytest.raises(EntityNotFoundError):
        await delete_uc.execute("SUPERVISOR", tenant_b)

    # O tenant B pode criar um perfil com outro código, com permissões diferentes
    created_b = await create_uc.execute(
        CreateRoleCommand(
            tenant_id=tenant_b,
            role_id="SUPERVISOR_B",
            name="Supervisor B",
            permissions=["invoices:read"],
        )
    )
    assert created_b.permissions == ["invoices:read"]


async def test_invite_accepts_custom_roles_from_catalog():
    tenant_id = uuid.uuid4()
    role_repo = MockRoleRepository()
    role_repo.roles["OPERADOR_CAIXA"] = Role(id="OPERADOR_CAIXA", name="Operador", is_system=True)
    role_repo.roles["SUPERVISOR"] = Role(
        id="SUPERVISOR", name="Supervisor", is_system=False, tenant_id=tenant_id
    )

    uow_factory = MockUnitOfWorkFactory()
    user_repo = MockUserRepository()
    user_tenant_repo = MockUserTenantRepository()
    audit_repo = MockAuditRepository()
    hasher = MockPasswordHasher()

    invite_uc = InviteUserUseCase(
        uow_factory, user_repo, user_tenant_repo, hasher, audit_repo, role_repo=role_repo
    )
    dto = await invite_uc.execute(
        InviteUserCommand(
            target_tenant_id=tenant_id,
            email="supervisor@kudiba.ao",
            full_name="Supervisor Loja",
            roles=["SUPERVISOR"],
            password="PasswordForte2026!",
        )
    )
    assert dto.roles == ["SUPERVISOR"]

    with pytest.raises(DomainError):
        await invite_uc.execute(
            InviteUserCommand(
                target_tenant_id=uuid.uuid4(),
                email="invalido@kudiba.ao",
                full_name="Inválido",
                roles=["SUPERVISOR"],
                password="PasswordForte2026!",
            )
        )
