use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReceivableStatus {
    Outstanding,
    Settled,
}

impl ReceivableStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReceivableStatus::Outstanding => "OUTSTANDING",
            ReceivableStatus::Settled => "SETTLED",
        }
    }

    pub fn from_db(value: &str) -> Self {
        match value.trim().to_uppercase().as_str() {
            "SETTLED" => ReceivableStatus::Settled,
            _ => ReceivableStatus::Outstanding,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvoiceReceivable {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: String,
    pub document_number: String,
    pub document_type: String,
    pub payment_mechanism: Option<String>,
    pub gross_total: Decimal,
    pub status: ReceivableStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl InvoiceReceivable {
    pub fn new(
        tenant_id: Uuid,
        invoice_id: String,
        document_number: String,
        document_type: String,
        payment_mechanism: Option<String>,
        gross_total: Decimal,
    ) -> Result<Self, DomainError> {
        let invoice_id = invoice_id.trim().to_string();
        if invoice_id.is_empty() {
            return Err(DomainError::ValidationError(
                "O ID da fatura não pode ser vazio".to_string(),
            ));
        }

        let document_number = document_number.trim().to_string();
        if document_number.is_empty() {
            return Err(DomainError::ValidationError(
                "O número do documento fiscal não pode ser vazio".to_string(),
            ));
        }

        let document_type = document_type.trim().to_uppercase();
        let status = if matches!(document_type.as_str(), "FR" | "VD" | "NC") {
            ReceivableStatus::Settled
        } else {
            ReceivableStatus::Outstanding
        };

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            invoice_id,
            document_number,
            document_type,
            payment_mechanism,
            gross_total,
            status,
            created_at: now,
            updated_at: now,
        })
    }
}
