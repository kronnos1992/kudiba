use async_trait::async_trait;
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::entities::CashMovement;
use crate::domain::error::DomainError;
use crate::domain::ports::CashMovementRepository;
use crate::domain::value_objects::MovementType;
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
        let existing = sqlx::query(
            r#"
            SELECT id, tenant_id, session_id, movement_type, amount
            FROM kudiba_treasury.cash_movements
            WHERE tenant_id = $1 AND idempotency_key = $2
            "#,
        )
        .bind(movement.tenant_id)
        .bind(key)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::DatabaseError(e.to_string()))?;

        let existing_id: Uuid = existing
            .try_get("id")
            .map_err(|e| DomainError::DatabaseError(e.to_string()))?;
        assert_same_movement(
            movement,
            existing
                .try_get("tenant_id")
                .map_err(|e| DomainError::DatabaseError(e.to_string()))?,
            existing
                .try_get("session_id")
                .map_err(|e| DomainError::DatabaseError(e.to_string()))?,
            existing
                .try_get("movement_type")
                .map_err(|e| DomainError::DatabaseError(e.to_string()))?,
            existing
                .try_get("amount")
                .map_err(|e| DomainError::DatabaseError(e.to_string()))?,
        )
        .map(|_| existing_id)
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

fn assert_same_movement(
    movement: &CashMovement,
    existing_tenant_id: Uuid,
    existing_session_id: Uuid,
    existing_type: MovementType,
    existing_amount: Decimal,
) -> Result<(), DomainError> {
    if movement.tenant_id == existing_tenant_id
        && movement.session_id == existing_session_id
        && movement.movement_type == existing_type
        && movement.amount == existing_amount
    {
        return Ok(());
    }

    Err(DomainError::AlreadyExists(format!(
        "chave de idempotência '{}' já usada com movimento diferente (tenant/sessão/tipo/montante)",
        movement
            .idempotency_key
            .as_deref()
            .unwrap_or("desconhecida")
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn movement() -> CashMovement {
        CashMovement::new(
            Uuid::from_u128(1),
            Uuid::from_u128(2),
            Uuid::from_u128(3),
            MovementType::SaleReceipt,
            Decimal::new(10000, 2),
            "Venda POS".into(),
            "operador".into(),
        )
        .unwrap()
        .with_idempotency_key(Some("pos-checkout:sale:cash".into()))
    }

    #[test]
    fn accepts_a_matching_idempotent_retry() {
        let movement = movement();
        assert!(assert_same_movement(
            &movement,
            movement.tenant_id,
            movement.session_id,
            movement.movement_type,
            movement.amount,
        )
        .is_ok());
    }

    #[test]
    fn rejects_a_retry_with_a_different_tenant_session_type_or_amount() {
        let movement = movement();
        let base = (
            movement.tenant_id,
            movement.session_id,
            movement.movement_type,
            movement.amount,
        );

        assert!(
            assert_same_movement(&movement, Uuid::from_u128(99), base.1, base.2, base.3,).is_err()
        );
        assert!(
            assert_same_movement(&movement, base.0, Uuid::from_u128(99), base.2, base.3,).is_err()
        );
        assert!(
            assert_same_movement(&movement, base.0, base.1, MovementType::Bleed, base.3,).is_err()
        );
        assert!(
            assert_same_movement(&movement, base.0, base.1, base.2, Decimal::from(101),).is_err()
        );
    }
}
