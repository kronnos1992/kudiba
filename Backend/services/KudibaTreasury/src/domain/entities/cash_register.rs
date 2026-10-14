use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CashRegister {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub branch_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CashRegister {
    pub fn new(
        tenant_id: Uuid,
        branch_id: Option<Uuid>,
        code: String,
        name: String,
    ) -> Result<Self, DomainError> {
        let code = code.trim().to_uppercase();
        let name = name.trim().to_string();

        if code.is_empty() {
            return Err(DomainError::ValidationError(
                "O código do caixa não pode ser vazio".to_string(),
            ));
        }

        if name.is_empty() {
            return Err(DomainError::ValidationError(
                "O nome do caixa não pode ser vazio".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            branch_id,
            code,
            name,
            is_active: true,
            created_at: now,
            updated_at: now,
        })
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
