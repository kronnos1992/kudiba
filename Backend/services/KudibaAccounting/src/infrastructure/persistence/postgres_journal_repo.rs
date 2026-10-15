use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::Journal;
use crate::domain::error::DomainError;
use crate::domain::ports::JournalRepository;
use crate::infrastructure::persistence::models::JournalRow;

pub struct PostgresJournalRepository {
    pool: PgPool,
}

impl PostgresJournalRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl JournalRepository for PostgresJournalRepository {
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Journal>, DomainError> {
        let row: Option<JournalRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, code, name, journal_type::text, is_active, created_at
            FROM kudiba_accounting.journals
            WHERE tenant_id = $1 AND code = $2
            "#,
        )
        .bind(tenant_id)
        .bind(code)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(|r| r.into_domain()))
    }

    async fn find_by_id(&self, tenant_id: Uuid, id: Uuid) -> Result<Option<Journal>, DomainError> {
        let row: Option<JournalRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, code, name, journal_type::text, is_active, created_at
            FROM kudiba_accounting.journals
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

    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<Journal>, DomainError> {
        let rows: Vec<JournalRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, code, name, journal_type::text, is_active, created_at
            FROM kudiba_accounting.journals
            WHERE tenant_id = $1 AND is_active = TRUE
            ORDER BY code ASC
            "#,
        )
        .bind(tenant_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(|r| r.into_domain()).collect())
    }

    async fn save(&self, journal: &Journal) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_accounting.journals (id, tenant_id, code, name, journal_type, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5::kudiba_accounting.journal_type, $6, $7)
            ON CONFLICT (tenant_id, code) DO UPDATE SET
                name = EXCLUDED.name,
                is_active = EXCLUDED.is_active
            "#,
        )
        .bind(journal.id)
        .bind(journal.tenant_id)
        .bind(&journal.code)
        .bind(&journal.name)
        .bind(journal.journal_type.as_str())
        .bind(journal.is_active)
        .bind(journal.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn next_entry_number(
        &self,
        tenant_id: Uuid,
        journal_code: &str,
        year: i32,
    ) -> Result<i64, DomainError> {
        let row: (i64,) = sqlx::query_as(
            r#"
            INSERT INTO kudiba_accounting.accounting_sequences (tenant_id, journal_code, fiscal_year, current_number, updated_at)
            VALUES ($1, $2, $3, 1, NOW())
            ON CONFLICT (tenant_id, journal_code, fiscal_year)
            DO UPDATE SET current_number = kudiba_accounting.accounting_sequences.current_number + 1, updated_at = NOW()
            RETURNING current_number
            "#,
        )
        .bind(tenant_id)
        .bind(journal_code)
        .bind(year)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.0)
    }
}
