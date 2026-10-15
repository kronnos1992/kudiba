use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::JournalType;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Journal {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub name: String,
    pub journal_type: JournalType,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

impl Journal {
    pub fn new(
        tenant_id: Uuid,
        code: String,
        name: String,
        journal_type: JournalType,
    ) -> Result<Self, DomainError> {
        let code_clean = code.trim().to_uppercase();
        if code_clean.is_empty() {
            return Err(DomainError::ValidationError(
                "Código do diário não pode ser vazio".to_string(),
            ));
        }

        let name_clean = name.trim();
        if name_clean.is_empty() {
            return Err(DomainError::ValidationError(
                "Nome do diário não pode ser vazio".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            code: code_clean,
            name: name_clean.to_string(),
            journal_type,
            is_active: true,
            created_at: Utc::now(),
        })
    }
}
