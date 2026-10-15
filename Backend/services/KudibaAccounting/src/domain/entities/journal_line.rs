use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::Currency;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalLine {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entry_id: Uuid,
    pub line_number: i32,
    pub account_code: String,
    pub description: Option<String>,
    pub debit_amount: Decimal,
    pub credit_amount: Decimal,
    pub entity_id: Option<Uuid>,
    pub cost_center_id: Option<Uuid>,
    pub currency: Currency,
    pub exchange_rate: Decimal,
    pub foreign_amount: Option<Decimal>,
    pub created_at: DateTime<Utc>,
}

impl JournalLine {
    pub fn new_debit(
        tenant_id: Uuid,
        entry_id: Uuid,
        line_number: i32,
        account_code: String,
        amount: Decimal,
        description: Option<String>,
        entity_id: Option<Uuid>,
        cost_center_id: Option<Uuid>,
    ) -> Result<Self, DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::InvalidLine(
                "Valor do débito tem de ser estritamente superior a zero".to_string(),
            ));
        }

        let code_clean = account_code.trim().to_string();
        if code_clean.is_empty() {
            return Err(DomainError::InvalidLine(
                "Código de conta obrigatório na linha".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            entry_id,
            line_number,
            account_code: code_clean,
            description,
            debit_amount: amount,
            credit_amount: Decimal::ZERO,
            entity_id,
            cost_center_id,
            currency: Currency::Aoa,
            exchange_rate: Decimal::ONE,
            foreign_amount: None,
            created_at: Utc::now(),
        })
    }

    pub fn new_credit(
        tenant_id: Uuid,
        entry_id: Uuid,
        line_number: i32,
        account_code: String,
        amount: Decimal,
        description: Option<String>,
        entity_id: Option<Uuid>,
        cost_center_id: Option<Uuid>,
    ) -> Result<Self, DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::InvalidLine(
                "Valor do crédito tem de ser estritamente superior a zero".to_string(),
            ));
        }

        let code_clean = account_code.trim().to_string();
        if code_clean.is_empty() {
            return Err(DomainError::InvalidLine(
                "Código de conta obrigatório na linha".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            entry_id,
            line_number,
            account_code: code_clean,
            description,
            debit_amount: Decimal::ZERO,
            credit_amount: amount,
            entity_id,
            cost_center_id,
            currency: Currency::Aoa,
            exchange_rate: Decimal::ONE,
            foreign_amount: None,
            created_at: Utc::now(),
        })
    }
}
