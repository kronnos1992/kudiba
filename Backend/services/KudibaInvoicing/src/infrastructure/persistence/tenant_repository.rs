use async_trait::async_trait;
use sqlx::postgres::PgRow;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::entities::tenant::Tenant;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::tenant_repository::TenantRepository;

const SELECT_TENANT_BY_ID: &str =
    "SELECT id, slug, company_name, nif, commercial_registry, tax_office_code, \
     agt_cert_number, status, tax_regime_code, contingency_started_at \
     FROM kudiba_core.tenants WHERE id = $1";

#[allow(dead_code)]
const SELECT_TENANT_BY_SLUG: &str =
    "SELECT id, slug, company_name, nif, commercial_registry, tax_office_code, \
     agt_cert_number, status, tax_regime_code, contingency_started_at \
     FROM kudiba_core.tenants WHERE slug = $1";

/// Repositório PostgreSQL de dados cadastrais e fiscais do tenant
#[derive(Debug, Default, Clone, Copy)]
pub struct PgTenantRepository;

impl PgTenantRepository {
    pub const fn new() -> Self {
        Self
    }

    fn map_row(row: &PgRow) -> Result<Tenant, RepositoryError> {
        Ok(Tenant {
            id: row.try_get("id")?,
            slug: row.try_get("slug")?,
            company_name: row.try_get("company_name")?,
            nif: row.try_get("nif")?,
            commercial_registry: row.try_get("commercial_registry")?,
            tax_office_code: row.try_get("tax_office_code")?,
            agt_cert_number: row.try_get("agt_cert_number")?,
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
