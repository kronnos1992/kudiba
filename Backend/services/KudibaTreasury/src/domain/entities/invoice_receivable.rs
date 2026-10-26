use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReceivableStatus {
    Outstanding,
    Partial,
    Settled,
}

impl ReceivableStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ReceivableStatus::Outstanding => "OUTSTANDING",
            ReceivableStatus::Partial => "PARTIAL",
            ReceivableStatus::Settled => "SETTLED",
        }
    }

    pub fn from_db(value: &str) -> Self {
        match value.trim().to_uppercase().as_str() {
            "SETTLED" => ReceivableStatus::Settled,
            "PARTIAL" => ReceivableStatus::Partial,
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
    pub paid_amount: Decimal,
    pub remaining_amount: Decimal,
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
        let (status, paid_amount, remaining_amount) = if matches!(document_type.as_str(), "FR" | "VD" | "NC") {
            (ReceivableStatus::Settled, gross_total, Decimal::ZERO)
        } else {
            (ReceivableStatus::Outstanding, Decimal::ZERO, gross_total)
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
            paid_amount,
            remaining_amount,
            status,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply_payment(&mut self, amount: Decimal) -> Result<(), DomainError> {
        if amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O valor de liquidação deve ser positivo".to_string(),
            ));
        }
        self.paid_amount += amount;
        if self.paid_amount >= self.gross_total {
            self.remaining_amount = Decimal::ZERO;
            self.status = ReceivableStatus::Settled;
        } else {
            self.remaining_amount = self.gross_total - self.paid_amount;
            self.status = ReceivableStatus::Partial;
        }
        self.updated_at = Utc::now();
        Ok(())
    }
}
