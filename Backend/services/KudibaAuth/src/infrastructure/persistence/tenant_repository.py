import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from src.domain.entities.branch import Branch
from src.domain.entities.tenant import Tenant
from src.domain.ports.tenant_repository import ITenantRepository
from src.infrastructure.persistence.models import BranchModel, TenantModel
from src.infrastructure.persistence.unit_of_work import session_scope


class SqlAlchemyTenantRepository(ITenantRepository):
    def __init__(self, session_factory: async_sessionmaker[AsyncSession]):
        self._session_factory = session_factory

    async def find_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantModel).where(TenantModel.id == tenant_id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._tenant_to_entity(m) if m else None

    async def find_by_slug(self, slug: str) -> Optional[Tenant]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(TenantModel).where(TenantModel.slug == slug.strip().lower())
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._tenant_to_entity(m) if m else None

    async def find_branches(self, tenant_id: uuid.UUID) -> List[Branch]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(BranchModel).where(BranchModel.tenant_id == tenant_id)
            res = await session.execute(stmt)
            models = res.scalars().all()
            return [self._branch_to_entity(m) for m in models]

    async def find_branch_by_id(self, branch_id: uuid.UUID, tenant_id: uuid.UUID) -> Optional[Branch]:
        async with session_scope(self._session_factory) as (session, _):
            stmt = select(BranchModel).where(BranchModel.id == branch_id, BranchModel.tenant_id == tenant_id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            return self._branch_to_entity(m) if m else None

    async def save_branch(self, branch: Branch) -> None:
        async with session_scope(self._session_factory) as (session, owns_session):
            m = BranchModel(
                id=branch.id,
                tenant_id=branch.tenant_id,
                code=branch.code,
                name=branch.name,
                city=branch.city,
                address_detail=branch.address_detail,
                is_active=branch.is_active,
            )
            session.add(m)
            if owns_session:
                await session.commit()

    async def update_tenant(self, tenant: Tenant) -> Tenant:
        async with session_scope(self._session_factory) as (session, owns_session):
            stmt = select(TenantModel).where(TenantModel.id == tenant.id)
            res = await session.execute(stmt)
            m = res.scalar_one_or_none()
            if not m:
                raise ValueError(f"Tenant {tenant.id} not found")
            m.company_name = tenant.company_name
            m.trade_name = tenant.trade_name
            m.nif = tenant.nif
            m.address_detail = tenant.address_detail
            m.city = tenant.city
            m.province = tenant.province
            m.postal_code = tenant.postal_code
            m.country = tenant.country or "AO"
            m.phone = tenant.phone
            m.email = tenant.email
            m.website = tenant.website
            m.logo_data_url = tenant.logo_data_url
            m.commercial_registry = tenant.commercial_registry
            m.share_capital = tenant.share_capital
            m.currency = tenant.currency or "AOA"
            m.tax_regime_code = tenant.tax_regime_code or "REGIME_GERAL"
            m.tax_office_code = tenant.tax_office_code
            m.agt_cert_number = tenant.agt_cert_number
            m.default_withholding_rate = tenant.default_withholding_rate
            m.invoice_footer_notes = tenant.invoice_footer_notes
            m.bank_accounts = list(tenant.bank_accounts or [])
            m.onboarding_completed = bool(tenant.onboarding_completed)
            await session.flush()
            if owns_session:
                await session.commit()
            return self._tenant_to_entity(m)

    @staticmethod
    def _tenant_to_entity(m: TenantModel) -> Tenant:
        return Tenant(
            id=m.id,
            slug=m.slug,
            company_name=m.company_name,
            trade_name=m.trade_name,
            nif=m.nif,
            status=m.status,
            address_detail=m.address_detail,
            city=m.city,
            province=m.province,
            postal_code=m.postal_code,
            country=m.country or "AO",
            phone=m.phone,
            email=m.email,
            website=m.website,
            logo_data_url=m.logo_data_url,
            commercial_registry=m.commercial_registry,
            share_capital=m.share_capital,
            currency=m.currency or "AOA",
            tax_regime_code=m.tax_regime_code or "REGIME_GERAL",
            tax_office_code=m.tax_office_code,
            agt_cert_number=m.agt_cert_number,
            default_withholding_rate=float(m.default_withholding_rate) if m.default_withholding_rate is not None else 6.50,
            invoice_footer_notes=m.invoice_footer_notes,
            bank_accounts=list(m.bank_accounts) if m.bank_accounts else [],
            onboarding_completed=bool(m.onboarding_completed),
            license_valid_until=m.license_valid_until,
            subscribed_modules=list(m.subscribed_modules) if m.subscribed_modules else None,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

    @staticmethod
    def _branch_to_entity(m: BranchModel) -> Branch:
        return Branch(
            id=m.id,
            tenant_id=m.tenant_id,
            code=m.code,
            name=m.name,
            city=m.city,
            address_detail=m.address_detail,
            is_active=m.is_active,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )

