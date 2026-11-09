from contextlib import asynccontextmanager
import uuid
import pytest
from src.infrastructure.bootstrap import ensure_sysadmin_bootstrapped
from src.infrastructure.persistence.models import (
    TenantModel,
    UserModel,
    UserRoleModel,
    UserTenantModel,
)
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher


@pytest.mark.asyncio
async def test_sysadmin_bootstrap_requires_explicit_credentials():
    with pytest.raises(ValueError, match="requires an explicit email and password"):
        await ensure_sysadmin_bootstrapped(
            session_factory=None,
            email="",
            password="",
        )


class _FakeResult:
    def __init__(self, items):
        self._items = list(items)

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None

    def scalars(self):
        return self

    def all(self):
        return list(self._items)


class _InMemoryBootstrapSession:
    def __init__(self, store: dict):
        self.store = store

    async def execute(self, stmt):
        params = stmt.compile().params
        desc = stmt.column_descriptions[0] if stmt.column_descriptions else {}
        entity = desc.get("entity")
        expr = desc.get("expr")

        if entity is TenantModel:
            slug = params.get("slug_1")
            if slug is not None:
                matches = [t for t in self.store["tenants"] if t.slug == slug]
            else:
                matches = self.store["tenants"][:1]
            return _FakeResult(matches)

        if entity is UserModel:
            email = params.get("email_1")
            matches = [u for u in self.store["users"] if u.email == email]
            return _FakeResult(matches)

        if entity is UserTenantModel:
            uid = params.get("user_id_1")
            tid = params.get("tenant_id_1")
            matches = [
                ut
                for ut in self.store["user_tenants"]
                if ut.user_id == uid and ut.tenant_id == tid
            ]
            return _FakeResult(matches)

        if entity is UserRoleModel:
            uid = params.get("user_id_1")
            tid = params.get("tenant_id_1")
            rid = params.get("role_id_1")
            if expr is UserRoleModel.role_id:
                matches = [
                    ur.role_id
                    for ur in self.store["user_roles"]
                    if ur.user_id == uid
                ]
            else:
                matches = [
                    ur
                    for ur in self.store["user_roles"]
                    if ur.user_id == uid and ur.tenant_id == tid and ur.role_id == rid
                ]
            return _FakeResult(matches)

        return _FakeResult([])

    def add(self, obj):
        if isinstance(obj, TenantModel) and obj not in self.store["tenants"]:
            self.store["tenants"].append(obj)
        elif isinstance(obj, UserModel) and obj not in self.store["users"]:
            self.store["users"].append(obj)
        elif isinstance(obj, UserTenantModel) and obj not in self.store["user_tenants"]:
            self.store["user_tenants"].append(obj)
        elif isinstance(obj, UserRoleModel) and obj not in self.store["user_roles"]:
            self.store["user_roles"].append(obj)

    async def flush(self):
        pass

    async def commit(self):
        pass


@pytest.mark.asyncio
async def test_ensure_sysadmin_bootstrapped_creates_and_activates():
    store = {
        "tenants": [
            TenantModel(
                id=uuid.UUID("a0000000-0000-0000-0000-000000000001"),
                slug="demo",
                company_name="Kudiba Comercial & Serviços Lda",
                nif="5001234567",
                status="ACTIVE",
            )
        ],
        "users": [],
        "user_tenants": [],
        "user_roles": [],
    }

    @asynccontextmanager
    async def fake_session_factory():
        yield _InMemoryBootstrapSession(store)

    hasher = Argon2PasswordHasher()
    test_email = f"sysadmin-{uuid.uuid4().hex[:8]}@kudiba.ao"
    test_pass = "SysAdminSecret2026!"

    # 1. Primeira execução: criação
    success = await ensure_sysadmin_bootstrapped(
        session_factory=fake_session_factory,
        email=test_email,
        password=test_pass,
        full_name="SysAdmin Test",
        tenant_slug="demo",
        password_hasher=hasher,
    )
    assert success is True

    # 2. Validar utilizador criado e papéis atribuídos
    assert len(store["users"]) == 1
    user = store["users"][0]
    assert user.email == test_email
    assert user.is_active is True
    assert user.is_superadmin is True
    assert hasher.verify(test_pass, user.password_hash) is True

    roles = {ur.role_id for ur in store["user_roles"] if ur.user_id == user.id}
    assert "SYSADMIN" in roles
    assert "ADMIN" in roles

    # 3. Segunda execução (idempotência): actualização
    new_pass = "NovaSenhaForte2026!"
    success_repeat = await ensure_sysadmin_bootstrapped(
        session_factory=fake_session_factory,
        email=test_email,
        password=new_pass,
        full_name="SysAdmin Test (Updated)",
        tenant_slug="demo",
        password_hasher=hasher,
    )
    assert success_repeat is True

    user_updated = store["users"][0]
    assert "SysAdmin" in user_updated.full_name
    assert hasher.verify(new_pass, user_updated.password_hash) is True
