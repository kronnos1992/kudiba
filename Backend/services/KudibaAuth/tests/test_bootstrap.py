import pytest
import uuid
from src.main import session_factory
from src.config import Settings
from src.infrastructure.bootstrap import ensure_sysadmin_bootstrapped
from src.infrastructure.persistence.models import RoleModel, TenantModel, UserModel, UserRoleModel, UserTenantModel
from src.infrastructure.persistence.unit_of_work import session_scope
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher
from sqlalchemy import select


@pytest.mark.asyncio
async def test_ensure_sysadmin_bootstrapped_creates_and_activates():
    hasher = Argon2PasswordHasher()
    test_email = f"sysadmin-{uuid.uuid4().hex[:8]}@kudiba.ao"
    test_pass = "SysAdminSecret2026!"

    # 1. Primeira execução: criação
    success = await ensure_sysadmin_bootstrapped(
        session_factory=session_factory,
        email=test_email,
        password=test_pass,
        full_name="SysAdmin Test",
        tenant_slug="demo",
        password_hasher=hasher,
    )
    assert success is True

    # 2. Validar utilizador no banco
    async with session_scope(session_factory) as (session, _):
        stmt = select(UserModel).where(UserModel.email == test_email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        assert user is not None
        assert user.is_active is True
        assert user.is_superadmin is True
        assert hasher.verify(test_pass, user.password_hash) is True

        # Validar papéis atribuídos
        roles_stmt = select(UserRoleModel.role_id).where(UserRoleModel.user_id == user.id)
        res_roles = await session.execute(roles_stmt)
        roles = set(res_roles.scalars().all())
        assert "SYSADMIN" in roles
        assert "ADMIN" in roles

    # 3. Segunda execução (idempotência): actualização
    new_pass = "NovaSenhaForte2026!"
    success_repeat = await ensure_sysadmin_bootstrapped(
        session_factory=session_factory,
        email=test_email,
        password=new_pass,
        full_name="SysAdmin Test (Updated)",
        tenant_slug="demo",
        password_hasher=hasher,
    )
    assert success_repeat is True

    async with session_scope(session_factory) as (session, _):
        stmt = select(UserModel).where(UserModel.email == test_email)
        res = await session.execute(stmt)
        user_updated = res.scalar_one_or_none()
        assert user_updated.full_name == "Administrador do Sistema (SYSADMIN)" or "SysAdmin" in user_updated.full_name
        assert hasher.verify(new_pass, user_updated.password_hash) is True
