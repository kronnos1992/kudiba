import re
import secrets
import unicodedata
import uuid
from datetime import date, datetime, time, timezone
from typing import List, Optional, Sequence

from src.application.dto import (
    ClientDetailDto,
    ClientDto,
    CreateClientCommand,
    LicenseDto,
    RenewLicenseCommand,
    SetLicenseStatusCommand,
    UpdateClientCommand,
)
from src.domain.entities import Client, License
from src.domain.error import (
    ConflictError,
    DomainError,
    EntityNotFoundError,
    InvalidModulesError,
    RenewalImpossibleError,
)
from src.domain.modules import validate_modules
from src.domain.ports import IClientRepository, ILicenseRepository, ITenantProvisioner
from src.infrastructure.security.password_hasher import Argon2PasswordHasher


def add_one_year(value: date) -> date:
    try:
        return value.replace(year=value.year + 1)
    except ValueError:
        return value.replace(year=value.year + 1, day=28)


def slugify(company_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", company_name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug[:48].strip("-") or "cliente"


def license_to_dto(license_entity: License) -> LicenseDto:
    return LicenseDto(
        id=license_entity.id,
        license_key=license_entity.license_key,
        plan=license_entity.plan,
        seats=license_entity.seats,
        modules=list(license_entity.modules),
        valid_from=license_entity.valid_from,
        valid_until=license_entity.valid_until,
        status=license_entity.status,
        expired=license_entity.is_expired(),
        notes=license_entity.notes,
        created_at=license_entity.created_at,
    )


def build_client_detail(
    client: Client,
    current: Optional[License],
    history: Sequence[License],
) -> ClientDetailDto:
    base = ClientDto(
        id=client.id,
        tenant_id=client.tenant_id,
        company_name=client.company_name,
        nif=client.nif,
        contact_name=client.contact_name,
        contact_email=client.contact_email,
        contact_phone=client.contact_phone,
        notes=client.notes,
        license_status=current.derived_status() if current else "NONE",
        license=license_to_dto(current) if current else None,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )
    return ClientDetailDto(
        **base.__dict__,
        license_history=[license_to_dto(item) for item in history],
    )


def _license_start_date(current: Optional[License]) -> date:
    today = date.today()
    if current and current.valid_until > today:
        return current.valid_until
    return today


def _mirror_datetime(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


class CreateClientUseCase:
    def __init__(
        self,
        client_repo: IClientRepository,
        license_repo: ILicenseRepository,
        provisioner: ITenantProvisioner,
    ):
        self.client_repo = client_repo
        self.license_repo = license_repo
        self.provisioner = provisioner

    async def execute(self, cmd: CreateClientCommand) -> ClientDetailDto:
        modules = validate_modules(cmd.modules)
        if cmd.seats < 1:
            raise DomainError("O número de lugares (seats) deve ser positivo.")
        if cmd.admin_email and not cmd.admin_password:
            raise DomainError("Indique a palavra-passe inicial do administrador.")
        if cmd.admin_password and not 12 <= len(cmd.admin_password) <= 1024:
            raise DomainError("A palavra-passe do administrador deve ter entre 12 e 1024 caracteres.")
        if cmd.admin_email and not cmd.admin_full_name:
            raise DomainError("Indique o nome completo do administrador.")

        nif = cmd.nif.strip()
        if await self.client_repo.find_by_nif(nif) or await self.provisioner.nif_exists(nif):
            raise ConflictError(f"Já existe um cliente registado com o NIF {nif}.")
        if cmd.admin_email and await self.provisioner.email_exists(cmd.admin_email.strip().lower()):
            raise ConflictError(f"Já existe um utilizador com o e-mail {cmd.admin_email}.")

        slug = await self._unique_slug(cmd.company_name)
        today = date.today()
        valid_until = add_one_year(today)

        client = Client(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            company_name=cmd.company_name.strip(),
            nif=nif,
            contact_name=cmd.contact_name,
            contact_email=cmd.contact_email,
            contact_phone=cmd.contact_phone,
            notes=cmd.notes,
        )
        license_entity = License(
            id=uuid.uuid4(),
            client_id=client.id,
            license_key=f"KDB-{secrets.token_hex(4).upper()}",
            plan=(cmd.plan or "STANDARD").strip().upper(),
            seats=cmd.seats,
            modules=modules,
            valid_from=today,
            valid_until=valid_until,
            status="ACTIVE",
        )
        admin_password_hash = (
            Argon2PasswordHasher().hash(cmd.admin_password) if cmd.admin_password else None
        )

        await self.provisioner.provision_client_tenant(
            tenant_id=client.tenant_id,
            slug=slug,
            company_name=client.company_name,
            nif=nif,
            license_valid_until=_mirror_datetime(valid_until),
            modules=modules,
            admin_email=cmd.admin_email.strip().lower() if cmd.admin_email else None,
            admin_full_name=cmd.admin_full_name.strip() if cmd.admin_full_name else None,
            admin_password_hash=admin_password_hash,
        )
        try:
            await self.client_repo.save(client)
            await self.license_repo.save(license_entity)
        except Exception:
            await self.provisioner.delete_tenant(client.tenant_id)
            raise

        history = await self.license_repo.list_for_client(client.id)
        return build_client_detail(client, license_entity, history)

    async def _unique_slug(self, company_name: str) -> str:
        base = slugify(company_name)
        candidate = base
        suffix = 2
        while await self.provisioner.slug_exists(candidate):
            candidate = f"{base}-{suffix}"
            suffix += 1
            if suffix > 50:
                candidate = f"{base}-{uuid.uuid4().hex[:6]}"
                break
        return candidate


class UpdateClientUseCase:
    def __init__(self, client_repo: IClientRepository, license_repo: ILicenseRepository):
        self.client_repo = client_repo
        self.license_repo = license_repo

    async def execute(self, cmd: UpdateClientCommand) -> ClientDetailDto:
        client = await self.client_repo.find_by_id(cmd.client_id)
        if not client:
            raise EntityNotFoundError("Cliente", str(cmd.client_id))
        if cmd.company_name is not None:
            client.company_name = cmd.company_name.strip()
        if cmd.contact_name is not None:
            client.contact_name = cmd.contact_name
        if cmd.contact_email is not None:
            client.contact_email = cmd.contact_email
        if cmd.contact_phone is not None:
            client.contact_phone = cmd.contact_phone
        if cmd.notes is not None:
            client.notes = cmd.notes
        await self.client_repo.update(client)

        current = await self.license_repo.find_current_for_client(client.id)
        history = await self.license_repo.list_for_client(client.id)
        return build_client_detail(client, current, history)


class RenewLicenseUseCase:
    def __init__(
        self,
        client_repo: IClientRepository,
        license_repo: ILicenseRepository,
        provisioner: ITenantProvisioner,
    ):
        self.client_repo = client_repo
        self.license_repo = license_repo
        self.provisioner = provisioner

    async def execute(self, cmd: RenewLicenseCommand) -> ClientDetailDto:
        client = await self.client_repo.find_by_id(cmd.client_id)
        if not client:
            raise EntityNotFoundError("Cliente", str(cmd.client_id))

        current = await self.license_repo.find_current_for_client(client.id)
        if cmd.modules is not None:
            modules = validate_modules(cmd.modules)
        elif current:
            modules = list(current.modules)
        else:
            raise InvalidModulesError("Não há licença anterior; indique os módulos a subscrever.")

        valid_from = _license_start_date(current)
        valid_until = add_one_year(valid_from)

        plan = (cmd.plan or (current.plan if current else "STANDARD")).strip().upper()
        seats = cmd.seats or (current.seats if current else 5)
        if seats < 1:
            raise DomainError("O número de lugares (seats) deve ser positivo.")

        license_entity = License(
            id=uuid.uuid4(),
            client_id=client.id,
            license_key=f"KDB-{secrets.token_hex(4).upper()}",
            plan=plan,
            seats=seats,
            modules=modules,
            valid_from=valid_from,
            valid_until=valid_until,
            status="ACTIVE",
            notes=cmd.notes,
        )

        if current and current.status == "SUSPENDED":
            current.status = "ACTIVE"
            await self.license_repo.update(current)

        await self.license_repo.save(license_entity)
        await self.provisioner.update_license_mirror(
            client.tenant_id,
            license_valid_until=_mirror_datetime(valid_until),
            modules=modules,
            status="ACTIVE",
        )

        history = await self.license_repo.list_for_client(client.id)
        return build_client_detail(client, license_entity, history)


class SetLicenseStatusUseCase:
    def __init__(
        self,
        client_repo: IClientRepository,
        license_repo: ILicenseRepository,
        provisioner: ITenantProvisioner,
    ):
        self.client_repo = client_repo
        self.license_repo = license_repo
        self.provisioner = provisioner

    async def execute(self, cmd: SetLicenseStatusCommand) -> ClientDetailDto:
        if cmd.action not in ("suspend", "activate"):
            raise DomainError("Acção inválida; use 'suspend' ou 'activate'.")

        client = await self.client_repo.find_by_id(cmd.client_id)
        if not client:
            raise EntityNotFoundError("Cliente", str(cmd.client_id))
        current = await self.license_repo.find_current_for_client(client.id)
        if not current:
            raise EntityNotFoundError("Licença", str(cmd.client_id))

        if cmd.action == "suspend":
            current.status = "SUSPENDED"
            await self.license_repo.update(current)
            await self.provisioner.update_license_mirror(client.tenant_id, status="SUSPENDED")
        else:
            if current.is_expired():
                raise RenewalImpossibleError(
                    "O período da licença expirou; efectue a renovação antes de reactivar."
                )
            current.status = "ACTIVE"
            await self.license_repo.update(current)
            await self.provisioner.update_license_mirror(
                client.tenant_id,
                license_valid_until=_mirror_datetime(current.valid_until),
                modules=list(current.modules),
                status="ACTIVE",
            )

        history = await self.license_repo.list_for_client(client.id)
        return build_client_detail(client, current, history)
