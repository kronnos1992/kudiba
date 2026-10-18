use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::SessionStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PosSession {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub register_id: Uuid,
    pub opened_by: String,
    pub opened_at: DateTime<Utc>,
    pub closed_by: Option<String>,
    pub closed_at: Option<DateTime<Utc>>,
    pub closing_notes: Option<String>,
    pub status: SessionStatus,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PosSession {
    pub fn open(
        tenant_id: Uuid,
        register_id: Uuid,
        opened_by: String,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        let opened_by = opened_by.trim().to_string();
        if opened_by.is_empty() {
            return Err(DomainError::ValidationError(
                "O identificador do gestor não pode ser vazio".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            register_id,
            opened_by,
            opened_at: now,
            closed_by: None,
            closed_at: None,
            closing_notes: None,
            status: SessionStatus::Open,
            notes,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn close(
        &mut self,
        closed_by: String,
        closing_notes: Option<String>,
    ) -> Result<(), DomainError> {
        if self.status != SessionStatus::Open {
            return Err(DomainError::InvalidSessionState(
                "A sessão POS já se encontra fechada".to_string(),
            ));
        }

        let closed_by = closed_by.trim().to_string();
        if closed_by.is_empty() {
            return Err(DomainError::ValidationError(
                "O identificador do gestor não pode ser vazio".to_string(),
            ));
        }

        let now = Utc::now();
        self.status = SessionStatus::Closed;
        self.closed_by = Some(closed_by);
        self.closed_at = Some(now);
        self.closing_notes = closing_notes;
        self.updated_at = now;

        Ok(())
    }
}
