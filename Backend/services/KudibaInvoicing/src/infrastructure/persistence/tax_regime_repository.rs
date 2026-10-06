use async_trait::async_trait;
use rust_decimal::Decimal;
use sqlx::postgres::PgRow;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::tax_regime_repository::{
    RegimeResolution, RegimeSource, TaxRegimeRepository, TenantTaxRegime,
};
use crate::domain::value_objects::tax_regime::TaxRegime;

/// Volume de facturação = soma das bases tributáveis liquidadas no exercício.
///
/// As notas de crédito (`NC`) são excluídas porque reduzem o volume facturado e
/// descolariam o sujeito passivo do regime que a AGT lhe atribuiu por força do
/// volume do ano em que facturou.
const SUM_ANNUAL_TURNOVER: &str = "SELECT COALESCE(SUM(net_total), 0) \
    FROM kudiba_core.invoices \
    WHERE tenant_id = $1 \
      AND EXTRACT(YEAR FROM issued_at)::INT = $2 \
      AND document_type <> 'NC'";

const SELECT_TENANT_REGIME: &str = "SELECT t.id AS tenant_id, t.tax_regime_code, \
    t.tax_regime_source, t.tax_regime_basis_turnover, t.tax_regime_resolved_at, \
    t.tax_regime_resolved_year \
    FROM kudiba_core.tenants t WHERE t.id = $1";

const SELECT_ALL_REGIMES: &str = "SELECT regime_code FROM kudiba_core.tax_regimes \
    ORDER BY min_turnover ASC";

const EXEMPTION_CODE_EXISTS: &str =
    "SELECT EXISTS(SELECT 1 FROM kudiba_core.tax_exemption_codes WHERE code = $1 AND is_active)";

/// Repositório PostgreSQL dos regimes de IVA e do enquadramento fiscal
#[derive(Debug, Default, Clone, Copy)]
pub struct PgTaxRegimeRepository;

impl PgTaxRegimeRepository {
    pub const fn new() -> Self {
        Self
    }

    fn map_tenant_regime(row: &PgRow) -> Result<TenantTaxRegime, RepositoryError> {
        let code: String = row.try_get("tax_regime_code")?;
        let source: String = row.try_get("tax_regime_source")?;

        Ok(TenantTaxRegime {
            tenant_id: row.try_get("tenant_id")?,
            regime: TaxRegime::from_code(&code).map_err(|err| {
                RepositoryError::Database(format!("Regime inválido na base de dados: {err}"))
            })?,
            source: RegimeSource::from_str(&source),
            basis_turnover: row.try_get("tax_regime_basis_turnover")?,
            resolved_at: row.try_get("tax_regime_resolved_at")?,
            resolved_year: row.try_get("tax_regime_resolved_year")?,
        })
    }
}

#[async_trait]
impl TaxRegimeRepository for PgTaxRegimeRepository {
    async fn get_tenant_regime(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
    ) -> Result<Option<TenantTaxRegime>, RepositoryError> {
        let row = sqlx::query(SELECT_TENANT_REGIME)
            .bind(tenant_id)
            .fetch_optional(&mut *session.connection())
            .await?;

        row.as_ref().map(Self::map_tenant_regime).transpose()
    }

    async fn sum_annual_turnover(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        fiscal_year: i32,
    ) -> Result<Decimal, RepositoryError> {
        let row = sqlx::query(SUM_ANNUAL_TURNOVER)
            .bind(tenant_id)
            .bind(fiscal_year)
            .fetch_one(&mut *session.connection())
            .await?;

        Ok(row.try_get(0)?)
    }

    async fn update_tenant_regime(
        &self,
        session: &mut dyn DbSession,
        resolution: &RegimeResolution,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "UPDATE kudiba_core.tenants \
             SET tax_regime_code = $1, \
                 tax_regime_source = $2, \
                 tax_regime_basis_turnover = $3, \
                 tax_regime_resolved_at = NOW(), \
                 tax_regime_resolved_year = $4 \
             WHERE id = $5",
        )
        .bind(resolution.resolved_regime.code())
        .bind(resolution.source.as_str())
        .bind(resolution.annual_turnover)
        .bind(resolution.fiscal_year)
        .bind(resolution.tenant_id)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn exemption_code_exists(
        &self,
        session: &mut dyn DbSession,
        code: &str,
    ) -> Result<bool, RepositoryError> {
        let row = sqlx::query(EXEMPTION_CODE_EXISTS)
            .bind(code.trim().to_uppercase())
            .fetch_one(&mut *session.connection())
            .await?;

        Ok(row.try_get(0)?)
    }

    async fn list_regimes(
        &self,
        session: &mut dyn DbSession,
    ) -> Result<Vec<TaxRegime>, RepositoryError> {
        let rows = sqlx::query(SELECT_ALL_REGIMES)
            .fetch_all(&mut *session.connection())
            .await?;

        rows.iter()
            .map(|row| {
                let code: String = row.try_get("regime_code")?;
                TaxRegime::from_code(&code).map_err(|err| {
                    RepositoryError::Database(format!("Regime inválido na base de dados: {err}"))
                })
            })
            .collect()
    }
}
