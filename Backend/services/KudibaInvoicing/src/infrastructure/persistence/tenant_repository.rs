use async_trait::async_trait;
use sqlx::postgres::PgRow;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::entities::tenant::{Tenant, TenantBankAccount};
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::tenant_repository::TenantRepository;

const SELECT_TENANT_BY_ID: &str =
    "SELECT id, slug, company_name, trade_name, nif, address_detail, city, province, postal_code, country, \
     phone, email, website, commercial_registry, share_capital, currency, tax_office_code, \
     agt_cert_number, invoice_footer_notes, bank_accounts::text AS bank_accounts, status, tax_regime_code, contingency_started_at \
     FROM kudiba_core.tenants WHERE id = $1";

#[allow(dead_code)]
const SELECT_TENANT_BY_SLUG: &str =
    "SELECT id, slug, company_name, trade_name, nif, address_detail, city, province, postal_code, country, \
     phone, email, website, commercial_registry, share_capital, currency, tax_office_code, \
     agt_cert_number, invoice_footer_notes, bank_accounts::text AS bank_accounts, status, tax_regime_code, contingency_started_at \
     FROM kudiba_core.tenants WHERE slug = $1";

/// Repositório PostgreSQL de dados cadastrais e fiscais do tenant
#[derive(Debug, Default, Clone, Copy)]
pub struct PgTenantRepository;

impl PgTenantRepository {
    pub const fn new() -> Self {
        Self
    }

    pub fn map_row(row: &PgRow) -> Result<Tenant, RepositoryError> {
        let bank_accounts_raw: Option<String> = row.try_get("bank_accounts").ok().flatten();
        let bank_accounts: Vec<TenantBankAccount> = bank_accounts_raw
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default();

        Ok(Tenant {
            id: row.try_get("id")?,
            slug: row.try_get("slug")?,
            company_name: row.try_get("company_name")?,
            trade_name: row.try_get("trade_name").ok().flatten(),
            nif: row.try_get("nif")?,
            address_detail: row.try_get("address_detail")?,
            city: row.try_get("city")?,
            province: row.try_get("province").ok().flatten(),
            postal_code: row.try_get("postal_code").ok().flatten(),
            country: row.try_get("country")?,
            phone: row.try_get("phone").ok().flatten(),
            email: row.try_get("email").ok().flatten(),
            website: row.try_get("website").ok().flatten(),
            commercial_registry: row.try_get("commercial_registry")?,
            share_capital: row.try_get("share_capital").ok().flatten(),
            currency: row.try_get("currency").ok().flatten(),
            tax_office_code: row.try_get("tax_office_code")?,
            agt_cert_number: row.try_get("agt_cert_number")?,
            invoice_footer_notes: row.try_get("invoice_footer_notes").ok().flatten(),
            bank_accounts,
            status: row.try_get("status")?,
            tax_regime_code: row.try_get("tax_regime_code")?,
            contingency_started_at: row.try_get("contingency_started_at")?,
        })
    }
}

#[async_trait]
impl TenantRepository for PgTenantRepository {
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        id: Uuid,
    ) -> Result<Option<Tenant>, RepositoryError> {
        let row = sqlx::query(SELECT_TENANT_BY_ID)
            .bind(id)
            .fetch_optional(&mut *session.connection())
            .await?;

        row.as_ref().map(Self::map_row).transpose()
    }

    async fn find_by_slug(
        &self,
        session: &mut dyn DbSession,
        slug: &str,
    ) -> Result<Option<Tenant>, RepositoryError> {
        let row = sqlx::query(SELECT_TENANT_BY_SLUG)
            .bind(slug)
            .fetch_optional(&mut *session.connection())
            .await?;

        row.as_ref().map(Self::map_row).transpose()
    }
}
