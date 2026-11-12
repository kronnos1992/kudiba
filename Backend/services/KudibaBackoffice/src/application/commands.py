import re
import logging
import secrets
import unicodedata
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List, Optional, Sequence

from src.application.alvara_verifier import evaluate_alvara_status
from src.application.dto import (
    ClientDetailDto,
    ClientDto,
    CreateClientCommand,
    LicenseDto,
    RenewLicenseCommand,
    SetLicenseStatusCommand,
    UpdateClientCommand,
)
from src.domain.entities import Client, License, TenantRecord
from src.domain.error import (
    ConflictError,
    DomainError,
    EntityNotFoundError,
    InvalidModulesError,
    RenewalImpossibleError,
)
from src.domain.modules import validate_modules
from src.domain.ports import (
    IChartProvisioner,
    IClientRepository,
    ILicenseRepository,
    ITenantProvisioner,
    ITenantReader,
)
from src.infrastructure.security.password_hasher import Argon2PasswordHasher

logger = logging.getLogger(__name__)


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


def derive_client_alvara_status(client: Client) -> str:
    if not client.alvara_number:
        return "MISSING"
    if client.alvara_issue_date is None and client.alvara_expiry_date is None:
        return "UNVERIFIED"
    status, _, _, _, _, _ = evaluate_alvara_status(
        client.alvara_number,
        client.alvara_issue_date,
        client.alvara_expiry_date,
    )
    return status


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
        alvara_number=client.alvara_number,
        alvara_issue_date=client.alvara_issue_date,
        alvara_expiry_date=client.alvara_expiry_date,
        alvara_status=derive_client_alvara_status(client),
        contact_name=client.contact_name,
        contact_email=client.contact_email,
        contact_phone=client.contact_phone,
        notes=client.notes,
        license_status=current.derived_status() if current else "NONE",
        license=license_to_dto(current) if current else None,
        created_at=client.created_at,
        updated_at=client.updated_at,
        sector_code=client.sector_code,
        accounting_template_code=client.accounting_template_code,
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
        chart_provisioner: Optional[IChartProvisioner] = None,
    ):
        self.client_repo = client_repo
        self.license_repo = license_repo
        self.provisioner = provisioner
        self.chart_provisioner = chart_provisioner

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

        sector_code = (cmd.sector_code or "GERAL").strip().upper()
        if not re.fullmatch(r"[A-Z0-9_\-]{2,32}", sector_code):
            raise DomainError("O código do setor de atividade é inválido.")
        accounting_template_code = (cmd.accounting_template_code or "PGC_GENERIC").strip().upper()
        if not re.fullmatch(r"[A-Z0-9_\-]{2,64}", accounting_template_code):
            raise DomainError("O código do template de plano de contas é inválido.")

        nif = cmd.nif.strip()
        alvara_number = (cmd.alvara_number or "").strip() or None
        today = date.today()

        issue_date = cmd.alvara_issue_date
        expiry_date = cmd.alvara_expiry_date
        if alvara_number and (issue_date is None or expiry_date is None):
            year_match = re.search(r"\b(20[12][0-9])\b", alvara_number)
            if year_match:
                year = int(year_match.group(1))
                issue_date = issue_date or date(year, 1, 15)
                expiry_date = expiry_date or date(year + 5, 1, 15)
            else:
                issue_date = issue_date or date(today.year, 1, 15)
                expiry_date = expiry_date or date(today.year + 5, 1, 15)

        if not alvara_number:
            issue_date = None
            expiry_date = None
        else:
            if issue_date > today:
                raise DomainError("A data de emissão do alvará não pode ser posterior à data actual.")
            if expiry_date <= issue_date:
                raise DomainError(
                    "A data de validade do alvará deve ser posterior à data de emissão."
                )
            if expiry_date < today:
                raise DomainError("O alvará comercial informado já se encontra expirado.")
        if await self.client_repo.find_by_nif(nif):
            raise ConflictError(f"Já existe um cliente registado com o NIF {nif}.")

        if await self.provisioner.nif_exists(nif):
            logger.warning(
                f"NIF {nif} encontrado nas bases de provisionamento sem registo correspondente em backoffice.clients. A purgar tenant órfão prévio..."
            )
            await self.provisioner.cleanup_orphan_by_nif(nif)

        if cmd.admin_email:
            clean_email = cmd.admin_email.strip().lower()
            await self.provisioner.cleanup_orphan_user(clean_email)
            if await self.provisioner.email_exists(clean_email):
                raise ConflictError(f"Já existe um utilizador com o e-mail {cmd.admin_email}.")

        slug = await self._unique_slug(cmd.company_name)
        valid_until = add_one_year(today)

        client = Client(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            company_name=cmd.company_name.strip(),
            nif=nif,
            alvara_number=alvara_number,
            alvara_issue_date=issue_date,
            alvara_expiry_date=expiry_date,
            contact_name=cmd.contact_name,
            contact_email=cmd.contact_email,
            contact_phone=cmd.contact_phone,
            notes=cmd.notes,
            sector_code=sector_code,
            accounting_template_code=accounting_template_code,
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

        try:
            await self.provisioner.provision_client_tenant(
                tenant_id=client.tenant_id,
                slug=slug,
                company_name=client.company_name,
                nif=nif,
                alvara_number=alvara_number,
                alvara_issue_date=issue_date,
                alvara_expiry_date=expiry_date,
                sector_code=sector_code,
                accounting_template_code=accounting_template_code,
                license_valid_until=_mirror_datetime(valid_until),
                modules=modules,
                admin_email=cmd.admin_email.strip().lower() if cmd.admin_email else None,
                admin_full_name=cmd.admin_full_name.strip() if cmd.admin_full_name else None,
                admin_password_hash=admin_password_hash,
            )
            await self.client_repo.save(client)
            await self.license_repo.save(license_entity)
            if self.chart_provisioner:
                try:
                    await self.chart_provisioner.provision_chart(
                        client.tenant_id,
                        accounting_template_code,
                        applied_by=cmd.admin_email or "BACKOFFICE",
                    )
                except Exception as e:
                    logger.warning(
                        f"Aviso ao provisionar plano de contas {accounting_template_code} para {client.company_name}: {e}"
                    )
        except Exception as exc:
            try:
                await self.provisioner.delete_tenant(client.tenant_id)
            except Exception as del_err:
                logger.warning(
                    f"Aviso ao reverter tenant {client.tenant_id} após erro de provisionamento: {del_err}"
                )
            msg = str(getattr(exc, "orig", exc)).lower()
            if "users_email" in msg or "idx_users_email" in msg:
                raise ConflictError(f"Já existe um utilizador com o e-mail {cmd.admin_email}.")
            if "tenants_nif" in msg or "clients_nif" in msg or "uq_tenants_nif" in msg:
                raise ConflictError(f"Já existe uma empresa com o NIF {nif}.")
            if "slug" in msg:
                raise ConflictError(f"Já existe uma empresa com o identificador '{slug}'.")
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
        if cmd.alvara_number is not None:
            client.alvara_number = cmd.alvara_number.strip() or None
        if cmd.alvara_issue_date is not None:
            client.alvara_issue_date = cmd.alvara_issue_date
        if cmd.alvara_expiry_date is not None:
            client.alvara_expiry_date = cmd.alvara_expiry_date
        if (
            client.alvara_issue_date is not None
            and client.alvara_expiry_date is not None
            and client.alvara_expiry_date <= client.alvara_issue_date
        ):
            raise DomainError(
                "A data de validade do alvará deve ser posterior à data de emissão."
            )
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


class SyncTenantsUseCase:
    """Importa tenants registados no onboarding (kudiba_core.tenants) para o
    registo B2B do backoffice (clientes + licença espelho), de forma idempotente."""

    def __init__(
        self,
        client_repo: IClientRepository,
        license_repo: ILicenseRepository,
        tenant_reader: ITenantReader,
    ):
        self.client_repo = client_repo
        self.license_repo = license_repo
        self.tenant_reader = tenant_reader

    async def execute(self) -> int:
        tenants: List[TenantRecord] = await self.tenant_reader.list_tenants()
        if not tenants:
            return 0

        existing = await self.client_repo.list_all()
        known_tenant_ids = {c.tenant_id for c in existing}
        known_nifs = {c.nif for c in existing}

        imported = 0
        for t in tenants:
            if t.id in known_tenant_ids or t.nif in known_nifs:
                continue

            client = Client(
                id=uuid.uuid4(),
                tenant_id=t.id,
                company_name=t.company_name.strip(),
                nif=t.nif.strip(),
                alvara_number=t.alvara_number,
                alvara_issue_date=t.alvara_issue_date,
                alvara_expiry_date=t.alvara_expiry_date,
                contact_email=t.email,
                contact_phone=t.phone,
                notes=f"Importado automaticamente do tenant de onboarding '{t.slug}'.",
            )

            license_entity = self._build_license(client, t)

            await self.client_repo.save(client)
            if license_entity is not None:
                await self.license_repo.save(license_entity)
            known_tenant_ids.add(t.id)
            known_nifs.add(t.nif)
            imported += 1

        return imported

    @staticmethod
    def _build_license(client: Client, tenant) -> Optional[License]:
        if not tenant.license_valid_until:
            return None

        valid_until = tenant.license_valid_until.date()
        valid_from = tenant.created_at.date() if tenant.created_at else date.today()
        if valid_until <= valid_from:
            valid_from = valid_until - timedelta(days=1)

        modules = tenant.subscribed_modules or []
        status = "SUSPENDED" if tenant.status.upper() == "SUSPENDED" else "ACTIVE"

        return License(
            id=uuid.uuid4(),
            client_id=client.id,
            license_key=f"KDB-{secrets.token_hex(4).upper()}",
            plan="STANDARD",
            seats=5,
            modules=modules,
            valid_from=valid_from,
            valid_until=valid_until,
            status=status,
            notes="Licença espelhada do tenant de onboarding.",
        )


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
