use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::PosSession;
use crate::domain::error::DomainError;
use crate::domain::ports::PosSessionRepository;
use crate::domain::value_objects::SessionStatus;
use crate::infrastructure::persistence::models::PosSessionRow;

pub struct PostgresPosSessionRepository {
    pool: PgPool,
}

impl PostgresPosSessionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PosSessionRepository for PostgresPosSessionRepository {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<PosSession>, DomainError> {
        let row = sqlx::query_as::<_, PosSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, opened_by, opened_at, closed_by, closed_at,
                   closing_notes, status, notes, created_at, updated_at
            FROM kudiba_treasury.pos_sessions
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
    ) -> Result<Option<PosSession>, DomainError> {
        let row = sqlx::query_as::<_, PosSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, opened_by, opened_at, closed_by, closed_at,
                   closing_notes, status, notes, created_at, updated_at
            FROM kudiba_treasury.pos_sessions
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

    async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        limit: i64,
    ) -> Result<Vec<PosSession>, DomainError> {
        let rows = sqlx::query_as::<_, PosSessionRow>(
            r#"
            SELECT id, tenant_id, register_id, opened_by, opened_at, closed_by, closed_at,
                   closing_notes, status, notes, created_at, updated_at
            FROM kudiba_treasury.pos_sessions
            WHERE tenant_id = $1
            ORDER BY opened_at DESC
            LIMIT $2
            "#,
        )
        .bind(tenant_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn save(&self, session: &PosSession) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_treasury.pos_sessions
                (id, tenant_id, register_id, opened_by, opened_at, closed_by, closed_at,
                 closing_notes, status, notes, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            "#,
        )
        .bind(session.id)
        .bind(session.tenant_id)
        .bind(session.register_id)
        .bind(&session.opened_by)
        .bind(session.opened_at)
        .bind(&session.closed_by)
        .bind(session.closed_at)
        .bind(&session.closing_notes)
        .bind(session.status)
        .bind(&session.notes)
        .bind(session.created_at)
        .bind(session.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    async fn update(&self, session: &PosSession) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE kudiba_treasury.pos_sessions
            SET closed_by = $1, closed_at = $2, closing_notes = $3,
                status = $4, notes = $5, updated_at = $6
            WHERE tenant_id = $7 AND id = $8
            "#,
        )
        .bind(&session.closed_by)
        .bind(session.closed_at)
        .bind(&session.closing_notes)
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
