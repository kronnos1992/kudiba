import uuid
from typing import List, Optional

from src.application.dto import BranchSummaryDto, TenantSettingsDto, TenantSummaryDto
from src.domain.entities.tenant import Tenant
from src.domain.error import EntityNotFoundError
from src.domain.ports.tenant_repository import ITenantRepository


def _extract_backup_settings(tenant: Tenant) -> dict:
    raw = dict((tenant.database_connections or {}).get("backup_settings") or {})
    default_folder = f"C:\\Backups\\Kudiba\\{tenant.slug or tenant.nif}"
    freq = str(raw.get("schedule_frequency") or "DAILY").upper()
    freq_hours = {
        "HOURLY_1": 1,
        "HOURLY_6": 6,
        "HOURLY_12": 12,
        "DAILY": 24,
        "WEEKLY": 168,
        "MONTHLY": 720,
    }
    return {
        "storage_location": str(raw.get("storage_location") or default_folder),
        "auto_save_local": bool(raw.get("auto_save_local", True)),
        "preferred_format": str(raw.get("preferred_format") or "ZIP_DECIFRADO"),
        "schedule_enabled": bool(raw.get("schedule_enabled", True)),
        "schedule_frequency": freq if freq in freq_hours else "DAILY",
        "schedule_interval_hours": int(
            raw.get("schedule_interval_hours") or freq_hours.get(freq, 24)
        ),
        "schedule_time": str(raw.get("schedule_time") or "02:00"),
        "retention_days": int(raw.get("retention_days") or 30),
    }


def tenant_to_settings_dto(tenant: Tenant) -> TenantSettingsDto:
    return TenantSettingsDto(
        id=tenant.id,
        slug=tenant.slug,
        company_name=tenant.company_name,
        trade_name=tenant.trade_name,
        nif=tenant.nif,
        address_detail=tenant.address_detail,
        city=tenant.city,
        province=tenant.province,
        postal_code=tenant.postal_code,
        country=tenant.country or "AO",
        phone=tenant.phone,
        email=tenant.email,
        website=tenant.website,
        logo_data_url=tenant.logo_data_url,
        alvara_number=tenant.alvara_number,
        alvara_issue_date=tenant.alvara_issue_date,
        alvara_expiry_date=tenant.alvara_expiry_date,
        commercial_registry=tenant.commercial_registry,
        share_capital=tenant.share_capital,
        currency=tenant.currency or "AOA",
        tax_regime_code=tenant.tax_regime_code or "REGIME_GERAL",
        tax_office_code=tenant.tax_office_code,
        agt_cert_number=tenant.agt_cert_number,
        default_withholding_rate=float(tenant.default_withholding_rate) if tenant.default_withholding_rate is not None else 6.50,
        invoice_footer_notes=tenant.invoice_footer_notes,
        bank_accounts=list(tenant.bank_accounts or []),
        onboarding_completed=bool(tenant.onboarding_completed),
        status=tenant.status,
        subscribed_modules=list(tenant.subscribed_modules or []),
        license_valid_until=tenant.license_valid_until,
        backup_settings=_extract_backup_settings(tenant),
    )


def build_tenant_summary_dto(
    tenant: Tenant,
    roles: List[str],
    permissions: List[str],
    default_branch: Optional[BranchSummaryDto],
    branches: List[BranchSummaryDto],
) -> TenantSummaryDto:
    return TenantSummaryDto(
        id=tenant.id,
        slug=tenant.slug,
        company_name=tenant.company_name,
        nif=tenant.nif,
        roles=roles,
        permissions=permissions,
        default_branch=default_branch,
        branches=branches,
        subscribed_modules=list(tenant.subscribed_modules or []),
        license_valid_until=tenant.license_valid_until,
        trade_name=tenant.trade_name,
        address_detail=tenant.address_detail,
        city=tenant.city,
        province=tenant.province,
        postal_code=tenant.postal_code,
        country=tenant.country or "AO",
        phone=tenant.phone,
        email=tenant.email,
        website=tenant.website,
        logo_data_url=tenant.logo_data_url,
        alvara_number=tenant.alvara_number,
        alvara_issue_date=tenant.alvara_issue_date,
        alvara_expiry_date=tenant.alvara_expiry_date,
        commercial_registry=tenant.commercial_registry,
        share_capital=tenant.share_capital,
        currency=tenant.currency or "AOA",
        tax_regime_code=tenant.tax_regime_code or "REGIME_GERAL",
        tax_office_code=tenant.tax_office_code,
        agt_cert_number=tenant.agt_cert_number,
        default_withholding_rate=float(tenant.default_withholding_rate) if tenant.default_withholding_rate is not None else 6.50,
        invoice_footer_notes=tenant.invoice_footer_notes,
        bank_accounts=list(tenant.bank_accounts or []),
        backup_settings=_extract_backup_settings(tenant),
        onboarding_completed=bool(tenant.onboarding_completed),
    )


class GetTenantSettingsUseCase:
    def __init__(self, tenant_repo: ITenantRepository):
        self.tenant_repo = tenant_repo

    async def execute(self, tenant_id: uuid.UUID) -> TenantSettingsDto:
        tenant = await self.tenant_repo.find_by_id(tenant_id)
        if not tenant:
            raise EntityNotFoundError("Empresa", str(tenant_id))
        return tenant_to_settings_dto(tenant)
