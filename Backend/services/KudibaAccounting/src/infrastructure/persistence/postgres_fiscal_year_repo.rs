use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::FiscalYear;
use crate::domain::error::DomainError;
use crate::domain::ports::FiscalYearRepository;
use crate::infrastructure::persistence::models::FiscalYearRow;

pub struct PostgresFiscalYearRepository {
    pool: PgPool,
}

impl PostgresFiscalYearRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FiscalYearRepository for PostgresFiscalYearRepository {
    async fn find_by_year(
        &self,
        tenant_id: Uuid,
        year: i32,
    ) -> Result<Option<FiscalYear>, DomainError> {
        let row: Option<FiscalYearRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, year_code, start_date, end_date, status::text, is_active, created_at
            FROM kudiba_accounting.fiscal_years
            WHERE tenant_id = $1 AND year_code = $2
            "#,
        )
        .bind(tenant_id)
        .bind(year)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(|r| r.into_domain()))
    }

    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<FiscalYear>, DomainError> {
        let row: Option<FiscalYearRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, year_code, start_date, end_date, status::text, is_active, created_at
            FROM kudiba_accounting.fiscal_years
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(|r| r.into_domain()))
    }

    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<FiscalYear>, DomainError> {
        let rows: Vec<FiscalYearRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, year_code, start_date, end_date, status::text, is_active, created_at
            FROM kudiba_accounting.fiscal_years
            WHERE tenant_id = $1
            ORDER BY year_code DESC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(|r| r.into_domain()).collect())
    }

    async fn save(&self, fiscal_year: &FiscalYear) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.fiscal_years (
                id, tenant_id, year_code, start_date, end_date, status, is_active, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::kudiba_accounting.fiscal_year_status, $7, $8)
            "#,
        )
        .bind(fiscal_year.id)
        .bind(fiscal_year.tenant_id)
        .bind(fiscal_year.year_code)
        .bind(fiscal_year.start_date)
        .bind(fiscal_year.end_date)
        .bind(fiscal_year.status.as_str())
        .bind(fiscal_year.is_active)
        .bind(fiscal_year.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn update(&self, fiscal_year: &FiscalYear) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE kudiba_accounting.fiscal_years
            SET status = $1::kudiba_accounting.fiscal_year_status, is_active = $2
            WHERE tenant_id = $3 AND id = $4
            "#,
        )
        .bind(fiscal_year.status.as_str())
        .bind(fiscal_year.is_active)
        .bind(fiscal_year.tenant_id)
        .bind(fiscal_year.id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
