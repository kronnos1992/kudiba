use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::MovementType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashMovement {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub session_id: Uuid,
    pub register_id: Uuid,
    pub movement_type: MovementType,
    pub amount: Decimal,
    pub reason: String,
    pub operator_user_id: String,
    pub created_at: DateTime<Utc>,
}

impl CashMovement {
    pub fn new(
        tenant_id: Uuid,
        session_id: Uuid,
        register_id: Uuid,
        movement_type: MovementType,
        amount: Decimal,
        reason: String,
        operator_user_id: String,
    ) -> Result<Self, DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O montante do movimento de caixa deve ser estritamente positivo".to_string(),
            ));
        }

        let reason = reason.trim().to_string();
        if reason.is_empty() {
            return Err(DomainError::ValidationError(
                "O motivo do movimento de caixa não pode ser vazio".to_string(),
            ));
        }

        let operator_user_id = operator_user_id.trim().to_string();
        if operator_user_id.is_empty() {
            return Err(DomainError::ValidationError(
                "O operador do movimento de caixa não pode ser vazio".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            session_id,
            register_id,
            movement_type,
            amount,
            reason,
            operator_user_id,
            created_at: Utc::now(),
        })
    }
}
