use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::InventoryError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Warehouse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub branch_id: Uuid,
    pub code: String,
    pub name: String,
    pub is_default: bool,
    pub address_detail: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Warehouse {
    pub fn new(
        tenant_id: Uuid,
        branch_id: Uuid,
        code: String,
        name: String,
        is_default: bool,
        address_detail: Option<String>,
    ) -> Result<Self, InventoryError> {
        if code.trim().is_empty() {
            return Err(InventoryError::ValidationError(
                "Código do armazém não pode ser vazio".to_string(),
            ));
        }

        if name.trim().is_empty() {
            return Err(InventoryError::ValidationError(
                "Nome do armazém não pode ser vazio".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            branch_id,
            code: code.trim().to_uppercase(),
            name: name.trim().to_string(),
            is_default,
            address_detail: address_detail.map(|a| a.trim().to_string()),
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update(
        &mut self,
        name: Option<String>,
        is_default: Option<bool>,
        address_detail: Option<String>,
        is_active: Option<bool>,
    ) -> Result<(), InventoryError> {
        if let Some(n) = name {
            let trimmed = n.trim();
            if trimmed.is_empty() {
                return Err(InventoryError::ValidationError(
                    "Nome do armazém não pode ser vazio".to_string(),
                ));
            }
            self.name = trimmed.to_string();
        }
        if let Some(d) = is_default {
            self.is_default = d;
        }
        if let Some(a) = address_detail {
            self.address_detail = Some(a.trim().to_string());
        }
        if let Some(act) = is_active {
            self.is_active = act;
        }
        self.updated_at = Utc::now();
        Ok(())
    }
}
