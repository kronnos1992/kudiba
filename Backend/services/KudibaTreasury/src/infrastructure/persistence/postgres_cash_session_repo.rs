use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::CashSession;
use crate::domain::error::DomainError;
use crate::domain::ports::CashSessionRepository;
use crate::domain::value_objects::SessionStatus;
use crate::infrastructure::persistence::models::CashSessionRow;

pub struct PostgresCashSessionRepository {
    pool: PgPool,
}

impl PostgresCashSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CashSessionRepository for PostgresCashSessionRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashSession>, DomainError> {
        let row = sqlx::query_as::<_, CashSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, operator_user_id, opened_at, closed_at,
                   opening_balance, closing_balance_counted, closing_balance_system,
                   discrepancy, status, notes, created_at, updated_at
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND id = $2
            "#,
        )
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn find_open_session_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
    ) -> Result<Option<CashSession>, DomainError> {
        let row = sqlx::query_as::<_, CashSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, operator_user_id, opened_at, closed_at,
                   opening_balance, closing_balance_counted, closing_balance_system,
                   discrepancy, status, notes, created_at, updated_at
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND register_id = $2 AND status = $3
            LIMIT 1
            "#,
        )
        .bind(tenant_id)
        .bind(register_id)
        .bind(SessionStatus::Open)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(row.map(Into::into))
    }

    async fn list_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
        limit: i64,
    ) -> Result<Vec<CashSession>, DomainError> {
        let rows = sqlx::query_as::<_, CashSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, operator_user_id, opened_at, closed_at,
                   opening_balance, closing_balance_counted, closing_balance_system,
                   discrepancy, status, notes, created_at, updated_at
            FROM kudiba_treasury.cash_sessions
            WHERE tenant_id = $1 AND register_id = $2
            ORDER BY opened_at DESC
            LIMIT $3
            "#,
        )
        .bind(tenant_id)
        .bind(register_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn save(&self, session: &CashSession) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.cash_sessions
                (id, tenant_id, register_id, operator_user_id, opened_at, closed_at,
                 opening_balance, closing_balance_counted, closing_balance_system,
                 discrepancy, status, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            "#,
        )
        .bind(session.id)
        .bind(session.tenant_id)
        .bind(session.register_id)
        .bind(&session.operator_user_id)
        .bind(session.opened_at)
        .bind(session.closed_at)
        .bind(session.opening_balance)
        .bind(session.closing_balance_counted)
        .bind(session.closing_balance_system)
        .bind(session.discrepancy)
        .bind(session.status)
        .bind(&session.notes)
        .bind(session.created_at)
        .bind(session.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn update(&self, session: &CashSession) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE kudiba_treasury.cash_sessions
            SET closed_at = $1, closing_balance_counted = $2, closing_balance_system = $3,
                discrepancy = $4, status = $5, notes = $6, updated_at = $7
            WHERE tenant_id = $8 AND id = $9
            "#,
        )
        .bind(session.closed_at)
        .bind(session.closing_balance_counted)
        .bind(session.closing_balance_system)
        .bind(session.discrepancy)
        .bind(session.status)
        .bind(&session.notes)
        .bind(session.updated_at)
        .bind(session.tenant_id)
        .bind(session.id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }
}
