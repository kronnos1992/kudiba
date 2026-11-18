use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::CashMovement;
use crate::domain::error::DomainError;
use crate::domain::ports::CashMovementRepository;
use crate::infrastructure::persistence::models::CashMovementRow;

pub struct PostgresCashMovementRepository {
    pool: PgPool,
}

impl PostgresCashMovementRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CashMovementRepository for PostgresCashMovementRepository {
    async fn save(&self, movement: &CashMovement) -> Result<Uuid, DomainError> {
        let inserted = sqlx::query_scalar::<_, Uuid>(
            r#"
            INSERT INTO kudiba_treasury.cash_movements
                (id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, idempotency_key, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
            RETURNING id
            "#,
        )
        .bind(movement.id)
        .bind(movement.tenant_id)
        .bind(movement.session_id)
        .bind(movement.register_id)
        .bind(movement.movement_type)
        .bind(movement.amount)
        .bind(&movement.reason)
        .bind(&movement.operator_user_id)
        .bind(&movement.idempotency_key)
        .bind(movement.created_at)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        if let Some(id) = inserted {
            return Ok(id);
        }

        let key = movement.idempotency_key.as_ref().ok_or_else(|| {
            DomainError::DatabaseError(
                "inserção de movimento de caixa sem idempotência falhou".to_string(),
            )
        })?;
        sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT id FROM kudiba_treasury.cash_movements
            WHERE tenant_id = $1 AND idempotency_key = $2
            "#,
        )
        .bind(movement.tenant_id)
        .bind(key)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))
    }

    async fn list_by_session(
        &self,
        tenant_id: Uuid,
        session_id: Uuid,
    ) -> Result<Vec<CashMovement>, DomainError> {
        let rows = sqlx::query_as::<_, CashMovementRow>(
            r#"
            SELECT id, tenant_id, session_id, register_id, movement_type, amount, reason, operator_user_id, created_at
            FROM kudiba_treasury.cash_movements
            WHERE tenant_id = $1 AND session_id = $2
            ORDER BY created_at ASC
            "#,
        )
        .bind(tenant_id)
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }
}
