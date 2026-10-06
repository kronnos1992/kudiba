use async_trait::async_trait;
use sqlx::postgres::PgRow;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::entities::fiscal_series::FiscalSeries;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::series_repository::FiscalSeriesRepository;

const SELECT_SERIES: &str = "SELECT id, tenant_id, document_type, series_code, fiscal_year, \
    current_sequence, last_hash, is_active, created_at \
    FROM kudiba_core.series_fiscais \
    WHERE tenant_id = $1 AND document_type = $2 AND series_code = $3 AND fiscal_year = $4";

const SELECT_SERIES_FOR_UPDATE: &str = "SELECT id, tenant_id, document_type, series_code, \
    fiscal_year, current_sequence, last_hash, is_active, created_at \
    FROM kudiba_core.series_fiscais \
    WHERE tenant_id = $1 AND document_type = $2 AND series_code = $3 AND fiscal_year = $4 \
    FOR UPDATE";

/// Repositório PostgreSQL da série fiscal (raiz de concorrência da emissão)
#[derive(Debug, Default, Clone, Copy)]
pub struct PgFiscalSeriesRepository;

impl PgFiscalSeriesRepository {
    pub const fn new() -> Self {
        Self
    }

    fn map_row(row: &PgRow) -> Result<FiscalSeries, RepositoryError> {
        Ok(FiscalSeries::restore(
            row.try_get("id")?,
            row.try_get("tenant_id")?,
            row.try_get("document_type")?,
            row.try_get("series_code")?,
            row.try_get("fiscal_year")?,
            row.try_get("current_sequence")?,
            row.try_get("last_hash")?,
            row.try_get("is_active")?,
            row.try_get("created_at")?,
        ))
    }
}

#[async_trait]
impl FiscalSeriesRepository for PgFiscalSeriesRepository {
    /// `SELECT ... FOR UPDATE`: serializa as emissões concorrentes da mesma série
    async fn get_and_lock(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_type: &str,
        series_code: &str,
        fiscal_year: i32,
    ) -> Result<Option<FiscalSeries>, RepositoryError> {
        let row = sqlx::query(SELECT_SERIES_FOR_UPDATE)
            .bind(tenant_id)
            .bind(document_type.to_uppercase())
            .bind(series_code.to_uppercase())
            .bind(fiscal_year)
            .fetch_optional(&mut *session.connection())
            .await?;

        row.as_ref().map(Self::map_row).transpose()
    }

    async fn get_by_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_type: &str,
        series_code: &str,
        fiscal_year: i32,
    ) -> Result<Option<FiscalSeries>, RepositoryError> {
        let row = sqlx::query(SELECT_SERIES)
            .bind(tenant_id)
            .bind(document_type.to_uppercase())
            .bind(series_code.to_uppercase())
            .bind(fiscal_year)
            .fetch_optional(&mut *session.connection())
            .await?;

        row.as_ref().map(Self::map_row).transpose()
    }

    async fn create(
        &self,
        session: &mut dyn DbSession,
        series: &FiscalSeries,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO kudiba_core.series_fiscais (id, tenant_id, document_type, series_code, \
             fiscal_year, current_sequence, last_hash, is_active, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(series.id)
        .bind(series.tenant_id)
        .bind(&series.document_type)
        .bind(&series.series_code)
        .bind(series.fiscal_year)
        .bind(series.current_sequence)
        .bind(&series.last_hash)
        .bind(series.is_active)
        .bind(series.created_at)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn update_sequence_and_hash(
        &self,
        session: &mut dyn DbSession,
        series_id: Uuid,
        new_sequence: i64,
        new_hash: &str,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "UPDATE kudiba_core.series_fiscais \
             SET current_sequence = $1, last_hash = $2 \
             WHERE id = $3",
        )
        .bind(new_sequence)
        .bind(new_hash)
        .bind(series_id)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }
}
