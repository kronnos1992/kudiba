import asyncio
import argparse
import sys
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.config import get_settings
from src.infrastructure.bootstrap import ensure_sysadmin_bootstrapped
from src.infrastructure.security.argon2_hasher import Argon2PasswordHasher


async def main():
    parser = argparse.ArgumentParser(description="Kudiba ERP — Utilitário de Injeção de Utilizador SYSADMIN")
    parser.add_argument("--email", type=str, default=None, help="E-mail do utilizador SYSADMIN")
    parser.add_argument("--password", type=str, default=None, help="Palavra-passe")
    parser.add_argument("--name", type=str, default=None, help="Nome completo")
    parser.add_argument("--tenant", type=str, default=None, help="Slug da empresa / tenant (default: demo)")
    args = parser.parse_args()

    settings = get_settings()

    target_email = args.email or settings.bootstrap_sysadmin_email
    target_pass = args.password or settings.bootstrap_sysadmin_password
    target_name = args.name or settings.bootstrap_sysadmin_name
    target_tenant = args.tenant or settings.bootstrap_sysadmin_tenant_slug

    print("=================================================================")
    print("Kudiba ERP: Injeção de Utilizador SYSADMIN (Superadministrador)")
    print("=================================================================")
    print(f"E-mail:       {target_email}")
    print(f"Nome:         {target_name}")
    print(f"Tenant Alvo:  {target_tenant}")
    print(f"Base Dados:   {settings.database_url.split('@')[-1] if '@' in settings.database_url else 'local'}")
    print("-----------------------------------------------------------------")

    engine = create_async_engine(settings.async_database_url)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    hasher = Argon2PasswordHasher()

    try:
        success = await ensure_sysadmin_bootstrapped(
            session_factory=session_factory,
            email=target_email,
            password=target_pass,
            full_name=target_name,
            tenant_slug=target_tenant,
            password_hasher=hasher,
        )
        if success:
            print(">> SUCESSO: Utilizador SYSADMIN provisionado e activo com todas as permissões!")
        else:
            print(">> ERRO: Falha ao provisionar utilizador SYSADMIN.", file=sys.stderr)
            sys.exit(1)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
