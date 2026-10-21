import logging
import uuid
from sqlalchemy import select
from src.infrastructure.persistence.models import RoleModel, TenantModel, UserModel, UserRoleModel, UserTenantModel
from src.infrastructure.persistence.unit_of_work import session_scope
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher

logger = logging.getLogger("kudiba.auth.bootstrap")


async def ensure_sysadmin_bootstrapped(
    session_factory,
    email: str,
    password: str,
    full_name: str = "Administrador do Sistema (SYSADMIN)",
    tenant_slug: str = "demo",
    password_hasher: Argon2PasswordHasher = None,
) -> bool:
    hasher = password_hasher or Argon2PasswordHasher()
    clean_email = email.strip().lower()

    async with session_scope(session_factory) as (session, owns_session):
        # 1. Obter ou validar o tenant alvo
        tenant_stmt = select(TenantModel).where(TenantModel.slug == tenant_slug)
        res_tenant = await session.execute(tenant_stmt)
        tenant = res_tenant.scalar_one_or_none()
        if not tenant:
            # Fallback para o primeiro tenant existente
            res_any = await session.execute(select(TenantModel).limit(1))
            tenant = res_any.scalar_one_or_none()

        if not tenant:
            logger.warning("Nenhum tenant encontrado para associar o utilizador SYSADMIN.")
            return False

        # 2. Obter ou criar o utilizador
        user_stmt = select(UserModel).where(UserModel.email == clean_email)
        res_user = await session.execute(user_stmt)
        user = res_user.scalar_one_or_none()

        if not user:
            pw_hash = hasher.hash(password)
            user = UserModel(
                id=uuid.uuid4(),
                email=clean_email,
                full_name=full_name,
                password_hash=pw_hash,
                is_active=True,
                is_superadmin=True,
                failed_login_attempts=0,
                locked_until=None,
            )
            session.add(user)
            await session.flush()
            logger.info("Utilizador SYSADMIN criado com sucesso: %s", clean_email)
        else:
            user.is_active = True
            user.is_superadmin = True
            user.failed_login_attempts = 0
            user.locked_until = None
            if password:
                user.password_hash = hasher.hash(password)
            await session.flush()
            logger.info("Utilizador SYSADMIN atualizado e reativado: %s", clean_email)

        # 3. Garantir associação no tenant
        ut_stmt = select(UserTenantModel).where(
            UserTenantModel.user_id == user.id,
            UserTenantModel.tenant_id == tenant.id,
        )
        res_ut = await session.execute(ut_stmt)
        user_tenant = res_ut.scalar_one_or_none()

        if not user_tenant:
            user_tenant = UserTenantModel(
                user_id=user.id,
                tenant_id=tenant.id,
                status="ACTIVE",
            )
            session.add(user_tenant)
            await session.flush()
        else:
            user_tenant.status = "ACTIVE"
            await session.flush()

        # 4. Atribuir papéis SYSADMIN e ADMIN
        for role_code in ["SYSADMIN", "ADMIN"]:
            ur_stmt = select(UserRoleModel).where(
                UserRoleModel.user_id == user.id,
                UserRoleModel.tenant_id == tenant.id,
                UserRoleModel.role_id == role_code,
            )
            res_ur = await session.execute(ur_stmt)
            if not res_ur.scalar_one_or_none():
                ur = UserRoleModel(
                    user_id=user.id,
                    tenant_id=tenant.id,
                    role_id=role_code,
                )
                session.add(ur)

        if owns_session:
            await session.commit()

        logger.info("Privilégios de SYSADMIN e ADMIN assegurados para %s na empresa %s.", clean_email, tenant.company_name)
        return True
