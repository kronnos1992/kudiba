use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::InventoryError;
use crate::domain::value_objects::TaxId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EntityKind {
    Customer,
    Supplier,
    Both,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommercialEntity {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub entity_type: EntityKind,
    pub tax_id: TaxId,
    pub name: String,
    pub trade_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_withholding_agent: bool,
    pub country_code: String,
    pub province: Option<String>,
    pub city: Option<String>,
    pub address_detail: Option<String>,
    pub iban: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CommercialEntity {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tenant_id: Uuid,
        entity_type: EntityKind,
        tax_id: TaxId,
        name: String,
        trade_name: Option<String>,
        email: Option<String>,
        phone: Option<String>,
        is_withholding_agent: bool,
        country_code: Option<String>,
        province: Option<String>,
        city: Option<String>,
        address_detail: Option<String>,
        iban: Option<String>,
    ) -> Result<Self, InventoryError> {
        if name.trim().is_empty() {
            return Err(InventoryError::ValidationError(
                "Nome da entidade comercial não pode ser vazio".to_string(),
            ));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            entity_type,
            tax_id,
            name: name.trim().to_string(),
            trade_name: trade_name.map(|t| t.trim().to_string()),
            email: email.map(|e| e.trim().to_lowercase()),
            phone: phone.map(|p| p.trim().to_string()),
            is_withholding_agent,
            country_code: country_code
                .unwrap_or_else(|| "AO".to_string())
                .to_uppercase(),
            province: province.map(|p| p.trim().to_string()),
            city: city.map(|c| c.trim().to_string()),
            address_detail: address_detail.map(|a| a.trim().to_string()),
            iban: iban.map(|i| i.trim().to_uppercase()),
            is_active: true,
            created_at: now,
            updated_at: now,
        })
    }
}
