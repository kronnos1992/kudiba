use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::InventoryError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProductBatch {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub product_id: Uuid,
    pub batch_number: String,
    pub manufacture_date: Option<NaiveDate>,
    pub expiry_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
}

impl ProductBatch {
    pub fn new(
        tenant_id: Uuid,
        product_id: Uuid,
        batch_number: String,
        manufacture_date: Option<NaiveDate>,
        expiry_date: Option<NaiveDate>,
    ) -> Result<Self, InventoryError> {
        let trimmed_number = batch_number.trim();
        if trimmed_number.is_empty() {
            return Err(InventoryError::ValidationError(
                "Número de lote não pode ser vazio".to_string(),
            ));
        }

        if let (Some(mfg), Some(exp)) = (manufacture_date, expiry_date) {
            if exp < mfg {
                return Err(InventoryError::ValidationError(
                    "Data de validade não pode ser anterior à data de fabrico".to_string(),
                ));
            }
        }

        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            product_id,
            batch_number: trimmed_number.to_string(),
            manufacture_date,
            expiry_date,
            created_at: Utc::now(),
        })
    }

    pub fn is_expired(&self, current_date: NaiveDate) -> bool {
        self.expiry_date.is_some_and(|exp| exp < current_date)
    }
}
