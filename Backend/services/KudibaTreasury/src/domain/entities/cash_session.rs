use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::SessionStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashSession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub register_id: Uuid,
    pub operator_user_id: String,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
    pub opening_balance: Decimal,
    pub closing_balance_counted: Option<Decimal>,
    pub closing_balance_system: Option<Decimal>,
    pub discrepancy: Option<Decimal>,
    pub status: SessionStatus,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CashSession {
    pub fn open(
        tenant_id: Uuid,
        register_id: Uuid,
        operator_user_id: String,
        opening_balance: Decimal,
    ) -> Result<Self, DomainError> {
        let operator_user_id = operator_user_id.trim().to_string();
        if operator_user_id.is_empty() {
            return Err(DomainError::ValidationError(
                "O identificador do operador não pode ser vazio".to_string(),
            ));
        }

        if opening_balance.is_sign_negative() {
            return Err(DomainError::ValidationError(
                "O saldo de abertura não pode ser negativo".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            register_id,
            operator_user_id,
            opened_at: now,
            closed_at: None,
            opening_balance,
            closing_balance_counted: None,
            closing_balance_system: None,
            discrepancy: None,
            status: SessionStatus::Open,
            notes: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn close(
        &mut self,
        closing_balance_counted: Decimal,
        system_calculated_balance: Decimal,
        notes: Option<String>,
    ) -> Result<(), DomainError> {
        if self.status != SessionStatus::Open {
            return Err(DomainError::InvalidSessionState(
                "A sessão já se encontra fechada".to_string(),
            ));
        }

        if closing_balance_counted.is_sign_negative() {
            return Err(DomainError::ValidationError(
                "O saldo contado em caixa não pode ser negativo".to_string(),
            ));
        }

        let now = Utc::now();
        self.status = SessionStatus::Closed;
        self.closed_at = Some(now);
        self.closing_balance_counted = Some(closing_balance_counted);
        self.closing_balance_system = Some(system_calculated_balance);
        self.discrepancy = Some(closing_balance_counted - system_calculated_balance);
        self.notes = notes;
        self.updated_at = now;

        Ok(())
    }
}
