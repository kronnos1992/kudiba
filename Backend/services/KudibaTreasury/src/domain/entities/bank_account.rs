use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::Currency;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BankAccount {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub bank_name: String,
    pub account_number: String,
    pub iban: String,
    pub currency: Currency,
    pub current_balance: Decimal,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl BankAccount {
    pub fn new(
        tenant_id: Uuid,
        bank_name: String,
        account_number: String,
        iban: String,
        currency: Currency,
        initial_balance: Decimal,
    ) -> Result<Self, DomainError> {
        let bank_name = bank_name.trim().to_string();
        if bank_name.is_empty() {
            return Err(DomainError::ValidationError(
                "O nome do banco não pode ser vazio".to_string(),
            ));
        }

        let account_number = account_number.trim().to_string();
        if account_number.is_empty() {
            return Err(DomainError::ValidationError(
                "O número da conta bancária não pode ser vazio".to_string(),
            ));
        }

        let iban = iban.trim().replace(' ', "").to_uppercase();
        if iban.is_empty() || iban.len() < 15 || iban.len() > 34 {
            return Err(DomainError::ValidationError(
                "O IBAN fornecido é inválido (deve conter entre 15 e 34 caracteres)".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            bank_name,
            account_number,
            iban,
            currency,
            current_balance: initial_balance,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn credit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "Montante a creditar deve ser positivo".to_string(),
            ));
        }
        self.current_balance += amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn debit(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "Montante a debitar deve ser positivo".to_string(),
            ));
        }
        if self.current_balance < amount {
            return Err(DomainError::InsufficientFunds(format!(
                "Saldo bancário insuficiente. Saldo atual: {} {}, Montante requerido: {}",
                self.current_balance, self.currency, amount
            )));
        }
        self.current_balance -= amount;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    pub fn activate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }
}
