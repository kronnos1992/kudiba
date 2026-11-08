import uuid
from typing import Optional

from src.application.dto import (
    BranchSummaryDto,
    CreateBranchCommand,
    TenantSettingsDto,
    UpdateTenantSettingsCommand,
)
from src.application.queries.get_tenant_settings import tenant_to_settings_dto
from src.domain.entities.branch import Branch
from src.domain.error import ConflictError, DomainError, EntityNotFoundError
from src.domain.ports.audit_repository import IAuditRepository
from src.domain.ports.tenant_repository import ITenantRepository
from src.domain.ports.unit_of_work import IUnitOfWorkFactory

VALID_TAX_REGIMES = {"REGIME_GERAL", "REGIME_SIMPLIFICADO", "REGIME_EXCLUSAO"}
VALID_CURRENCIES = {"AOA", "USD", "EUR"}


def _clean_opt(val: Optional[str]) -> Optional[str]:
    if val is None:
        return None
    stripped = str(val).strip()
    return stripped if stripped else None


class UpdateTenantSettingsUseCase:
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        tenant_repo: ITenantRepository,
        audit_repo: IAuditRepository,
    ):
        self.uow_factory = uow_factory
        self.tenant_repo = tenant_repo
        self.audit_repo = audit_repo

    async def execute(self, cmd: UpdateTenantSettingsCommand) -> TenantSettingsDto:
        async with self.uow_factory.begin():
            tenant = await self.tenant_repo.find_by_id(cmd.tenant_id)
            if not tenant:
                raise EntityNotFoundError("Empresa", str(cmd.tenant_id))

            if cmd.company_name is not None:
                name = cmd.company_name.strip()
                if len(name) < 2:
                    raise DomainError("A denominação social da empresa deve ter pelo menos 2 caracteres.")
                tenant.company_name = name

            if cmd.trade_name is not None:
                tenant.trade_name = _clean_opt(cmd.trade_name)

            if cmd.nif is not None:
                nif = cmd.nif.strip()
                if len(nif) < 5:
                    raise DomainError("O NIF da empresa deve ser válido.")
                tenant.nif = nif

            if cmd.address_detail is not None:
                tenant.address_detail = _clean_opt(cmd.address_detail)

            if cmd.city is not None:
                tenant.city = _clean_opt(cmd.city)

            if cmd.province is not None:
                tenant.province = _clean_opt(cmd.province)

            if cmd.postal_code is not None:
                tenant.postal_code = _clean_opt(cmd.postal_code)

            if cmd.country is not None:
                country = cmd.country.strip().upper()
                tenant.country = country[:2] if country else "AO"

            if cmd.phone is not None:
                tenant.phone = _clean_opt(cmd.phone)

            if cmd.email is not None:
                tenant.email = _clean_opt(cmd.email)

            if cmd.website is not None:
                tenant.website = _clean_opt(cmd.website)

            if cmd.logo_data_url is not None:
                tenant.logo_data_url = _clean_opt(cmd.logo_data_url)

            if cmd.alvara_number is not None:
                tenant.alvara_number = _clean_opt(cmd.alvara_number)

            if cmd.alvara_issue_date is not None:
                tenant.alvara_issue_date = cmd.alvara_issue_date

            if cmd.alvara_expiry_date is not None:
                tenant.alvara_expiry_date = cmd.alvara_expiry_date

            if (
                tenant.alvara_issue_date is not None
                and tenant.alvara_expiry_date is not None
                and tenant.alvara_expiry_date <= tenant.alvara_issue_date
            ):
                raise DomainError(
                    "A data de validade do alvará comercial deve ser posterior à data de emissão."
                )

            if cmd.commercial_registry is not None:
                tenant.commercial_registry = _clean_opt(cmd.commercial_registry)

            if cmd.share_capital is not None:
                tenant.share_capital = _clean_opt(cmd.share_capital)

            if cmd.currency is not None:
                curr = cmd.currency.strip().upper()
                if curr not in VALID_CURRENCIES:
                    raise DomainError(f"Moeda operacional inválida ({curr}). Use AOA, USD ou EUR.")
                tenant.currency = curr

            if cmd.tax_regime_code is not None:
                regime = cmd.tax_regime_code.strip().upper()
                if regime not in VALID_TAX_REGIMES:
                    raise DomainError(f"Regime fiscal de IVA inválido: {regime}.")
                tenant.tax_regime_code = regime

            if cmd.tax_office_code is not None:
                tenant.tax_office_code = _clean_opt(cmd.tax_office_code)

            if cmd.agt_cert_number is not None:
                tenant.agt_cert_number = _clean_opt(cmd.agt_cert_number)

            if cmd.default_withholding_rate is not None:
                if cmd.default_withholding_rate < 0 or cmd.default_withholding_rate > 100:
                    raise DomainError("A taxa de retenção na fonte deve estar entre 0% e 100%.")
                tenant.default_withholding_rate = round(float(cmd.default_withholding_rate), 2)

            if cmd.invoice_footer_notes is not None:
                tenant.invoice_footer_notes = _clean_opt(cmd.invoice_footer_notes)

            if cmd.bank_accounts is not None:
                cleaned_accounts = []
                for acc in cmd.bank_accounts:
                    bank_name = str(acc.get("bank_name", "")).strip()
                    iban = str(acc.get("iban", "")).strip()
                    if not bank_name and not iban:
                        continue
                    cleaned_accounts.append(
                        {
                            "bank_name": bank_name,
                            "iban": iban,
                            "account_number": str(acc.get("account_number", "")).strip(),
                            "swift": str(acc.get("swift", "")).strip(),
                            "currency": str(acc.get("currency", "AOA")).strip() or "AOA",
                            "is_primary": bool(acc.get("is_primary", False)),
                        }
                    )
                tenant.bank_accounts = cleaned_accounts

            if cmd.backup_settings is not None:
                db_conns = dict(tenant.database_connections or {})
                current_backup = dict(db_conns.get("backup_settings") or {})
                raw_loc = str(cmd.backup_settings.get("storage_location") or "").strip()
                if raw_loc:
                    current_backup["storage_location"] = raw_loc
                if "auto_save_local" in cmd.backup_settings:
                    current_backup["auto_save_local"] = bool(cmd.backup_settings.get("auto_save_local"))
                if "preferred_format" in cmd.backup_settings:
                    fmt = str(cmd.backup_settings.get("preferred_format") or "ZIP_DECIFRADO").strip().upper()
                    current_backup["preferred_format"] = (
                        fmt if fmt in {"ZIP_DECIFRADO", "AES_256_GCM"} else "ZIP_DECIFRADO"
                    )
                if "schedule_enabled" in cmd.backup_settings:
                    current_backup["schedule_enabled"] = bool(cmd.backup_settings.get("schedule_enabled"))
                if "schedule_frequency" in cmd.backup_settings:
                    freq = str(cmd.backup_settings.get("schedule_frequency") or "DAILY").strip().upper()
                    freq_hours = {
                        "HOURLY_1": 1,
                        "HOURLY_6": 6,
                        "HOURLY_12": 12,
                        "DAILY": 24,
                        "WEEKLY": 168,
                        "MONTHLY": 720,
                    }
                    if freq not in freq_hours:
                        freq = "DAILY"
                    current_backup["schedule_frequency"] = freq
                    current_backup["schedule_interval_hours"] = freq_hours[freq]
                if "schedule_interval_hours" in cmd.backup_settings and "schedule_frequency" not in cmd.backup_settings:
                    try:
                        current_backup["schedule_interval_hours"] = max(
                            1, min(8760, int(cmd.backup_settings.get("schedule_interval_hours") or 24))
                        )
                    except (TypeError, ValueError):
                        current_backup["schedule_interval_hours"] = 24
                if "schedule_time" in cmd.backup_settings:
                    raw_time = str(cmd.backup_settings.get("schedule_time") or "02:00").strip()
                    current_backup["schedule_time"] = raw_time if ":" in raw_time else "02:00"
                if "retention_days" in cmd.backup_settings:
                    try:
                        days = max(1, min(3650, int(cmd.backup_settings.get("retention_days") or 30)))
                    except (TypeError, ValueError):
                        days = 30
                    current_backup["retention_days"] = days
                db_conns["backup_settings"] = current_backup
                tenant.database_connections = db_conns

            if cmd.onboarding_completed is not None:
                tenant.onboarding_completed = bool(cmd.onboarding_completed)
            elif (
                tenant.company_name
                and tenant.nif
                and tenant.address_detail
                and tenant.city
            ):
                tenant.onboarding_completed = True

            updated = await self.tenant_repo.update_tenant(tenant)

            await self.audit_repo.record_event(
                action="TENANT_SETTINGS_UPDATED",
                user_id=cmd.actor_user_id,
                tenant_id=cmd.tenant_id,
                ip_address=cmd.ip_address,
                user_agent=cmd.user_agent,
                details={
                    "company_name": updated.company_name,
                    "trade_name": updated.trade_name,
                    "nif": updated.nif,
                    "tax_regime_code": updated.tax_regime_code,
                    "onboarding_completed": updated.onboarding_completed,
                },
            )

            return tenant_to_settings_dto(updated)


class CreateBranchUseCase:
    def __init__(
        self,
        uow_factory: IUnitOfWorkFactory,
        tenant_repo: ITenantRepository,
        audit_repo: IAuditRepository,
    ):
        self.uow_factory = uow_factory
        self.tenant_repo = tenant_repo
        self.audit_repo = audit_repo

    async def execute(self, cmd: CreateBranchCommand) -> BranchSummaryDto:
        code = cmd.code.strip().upper()
        name = cmd.name.strip()
        if len(code) < 2 or len(name) < 2:
            raise DomainError("Código e nome da filial devem ter pelo menos 2 caracteres.")

        async with self.uow_factory.begin():
            existing = await self.tenant_repo.find_branches(cmd.tenant_id)
            if any(b.code.upper() == code for b in existing):
                raise ConflictError(f"Já existe uma filial com o código '{code}' nesta empresa.")

            branch = Branch(
                id=uuid.uuid4(),
                tenant_id=cmd.tenant_id,
                code=code,
                name=name,
                city=_clean_opt(cmd.city),
                address_detail=_clean_opt(cmd.address_detail),
                is_active=True,
            )
            await self.tenant_repo.save_branch(branch)
            await self.audit_repo.record_event(
                action="BRANCH_CREATED",
                user_id=cmd.actor_user_id,
                tenant_id=cmd.tenant_id,
                details={"branch_id": str(branch.id), "code": branch.code, "name": branch.name},
            )
            return BranchSummaryDto(
                id=branch.id,
                code=branch.code,
                name=branch.name,
                city=branch.city,
                address_detail=branch.address_detail,
            )
