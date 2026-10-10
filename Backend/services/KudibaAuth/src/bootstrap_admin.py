import argparse
import asyncio
import getpass
import sys
import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import get_settings
from src.domain.value_objects.email import Email
from src.infrastructure.persistence.models import (
    BranchModel,
    TenantModel,
    UserModel,
    UserRoleModel,
    UserTenantModel,
)
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher


async def bootstrap_admin(tenant_id: uuid.UUID, email: Email, full_name: str, password: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with session_factory() as session:
            async with session.begin():
                await session.execute(
                    text("SELECT pg_advisory_xact_lock(hashtextextended(:tenant_id, 0))"),
                    {"tenant_id": str(tenant_id)},
                )
                tenant = await session.get(TenantModel, tenant_id)
                if not tenant or tenant.status != "ACTIVE":
                    raise ValueError("Tenant inexistente ou inactivo.")

                existing_admin = await session.scalar(
                    select(UserRoleModel.user_id)
                    .join(UserModel, UserRoleModel.user_id == UserModel.id)
                    .where(
                        UserRoleModel.tenant_id == tenant_id,
                        UserRoleModel.role_id == "ADMIN",
                        UserModel.is_active.is_(True),
                    )
                    .limit(1)
                )
                if existing_admin:
                    raise ValueError("Este tenant já possui um administrador; bootstrap recusado.")

                existing_user = await session.scalar(
                    select(UserModel.id).where(UserModel.email == email.value).limit(1)
                )
                if existing_user:
                    raise ValueError("Já existe um utilizador com este e-mail.")

                branch_id = await session.scalar(
                    select(BranchModel.id)
                    .where(BranchModel.tenant_id == tenant_id, BranchModel.is_active.is_(True))
                    .order_by(BranchModel.code)
                    .limit(1)
                )

                user = UserModel(
                    id=uuid.uuid4(),
                    email=email.value,
                    full_name=full_name.strip(),
                    password_hash=Argon2PasswordHasher().hash(password),
                    is_active=True,
                    is_superadmin=False,
                )
                session.add(user)
                await session.flush()
                session.add(
                    UserTenantModel(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        tenant_id=tenant_id,
                        default_branch_id=branch_id,
                        status="ACTIVE",
                    )
                )
                session.add(UserRoleModel(user_id=user.id, tenant_id=tenant_id, role_id="ADMIN"))
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Provisiona o primeiro administrador de um tenant Kudiba.")
    parser.add_argument("--tenant-id", type=uuid.UUID, required=True)
    args = parser.parse_args()

    try:
        email = Email(input("E-mail do administrador: "))
        full_name = input("Nome completo: ").strip()
        if len(full_name) < 2:
            raise ValueError("O nome completo deve conter pelo menos dois caracteres.")
        password = getpass.getpass("Password (mínimo 12 caracteres): ")
        confirmation = getpass.getpass("Confirmar password: ")
        if not 12 <= len(password) <= 1024 or password != confirmation:
            raise ValueError("Passwords inválidas ou diferentes; use entre 12 e 1024 caracteres.")
        asyncio.run(bootstrap_admin(args.tenant_id, email, full_name, password))
    except (ValueError, EOFError) as exc:
        print(f"Bootstrap não concluído: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    print(f"Administrador provisionado para o tenant {args.tenant_id}.")


if __name__ == "__main__":
    main()
