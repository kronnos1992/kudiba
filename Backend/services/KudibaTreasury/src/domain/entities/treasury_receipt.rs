use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::value_objects::{Currency, PaymentMethod};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryReceiptLine {
    pub id: Uuid,
    pub receipt_id: Uuid,
    pub invoice_id: String,
    pub invoice_number: String,
    pub amount_settled: Decimal,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl TreasuryReceiptLine {
    pub fn new(
        receipt_id: Uuid,
        invoice_id: String,
        invoice_number: String,
        amount_settled: Decimal,
        notes: Option<String>,
    ) -> Result<Self, DomainError> {
        let invoice_id = invoice_id.trim().to_string();
        if invoice_id.is_empty() {
            return Err(DomainError::ValidationError(
                "O ID da fatura liquidada não pode ser vazio".to_string(),
            ));
        }

        let invoice_number = invoice_number.trim().to_string();
        if invoice_number.is_empty() {
            return Err(DomainError::ValidationError(
                "O número da fatura liquidada não pode ser vazio".to_string(),
            ));
        }

        if amount_settled <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O montante liquidado na linha deve ser estritamente positivo".to_string(),
            ));
        }

        Ok(Self {
            id: Uuid::new_v4(),
            receipt_id,
            invoice_id,
            invoice_number,
            amount_settled,
            notes,
            created_at: Utc::now(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreasuryReceipt {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub receipt_number: String,
    pub customer_id: String,
    pub customer_name: String,
    pub customer_nif: Option<String>,
    pub session_id: Option<Uuid>,
    pub bank_account_id: Option<Uuid>,
    pub payment_method: PaymentMethod,
    pub total_amount: Decimal,
    pub currency: Currency,
    pub notes: Option<String>,
    pub issued_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub lines: Vec<TreasuryReceiptLine>,
}

impl TreasuryReceipt {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tenant_id: Uuid,
        receipt_number: String,
        customer_id: String,
        customer_name: String,
        customer_nif: Option<String>,
        session_id: Option<Uuid>,
        bank_account_id: Option<Uuid>,
        payment_method: PaymentMethod,
        total_amount: Decimal,
        currency: Currency,
        notes: Option<String>,
        lines: Vec<TreasuryReceiptLine>,
    ) -> Result<Self, DomainError> {
        let receipt_number = receipt_number.trim().to_string();
        if receipt_number.is_empty() {
            return Err(DomainError::ValidationError(
                "O número do recibo não pode ser vazio".to_string(),
            ));
        }

        let customer_id = customer_id.trim().to_string();
        if customer_id.is_empty() {
            return Err(DomainError::ValidationError(
                "O ID do cliente não pode ser vazio".to_string(),
            ));
        }

        let customer_name = customer_name.trim().to_string();
        if customer_name.is_empty() {
            return Err(DomainError::ValidationError(
                "O nome do cliente não pode ser vazio".to_string(),
            ));
        }

        if total_amount <= Decimal::ZERO {
            return Err(DomainError::ValidationError(
                "O montante total do recibo deve ser estritamente positivo".to_string(),
            ));
        }

        if lines.is_empty() {
            return Err(DomainError::ValidationError(
                "O recibo deve conter pelo menos uma linha de fatura liquidada".to_string(),
            ));
        }

        let lines_sum: Decimal = lines.iter().map(|l| l.amount_settled).sum();
        if lines_sum != total_amount {
            return Err(DomainError::ValidationError(format!(
                "O somatório das linhas ({}) não coincide com o total do recibo ({})",
                lines_sum, total_amount
            )));
        }

        let now = Utc::now();
        Ok(Self {
            id: Uuid::new_v4(),
            tenant_id,
            receipt_number,
            customer_id,
            customer_name,
            customer_nif: customer_nif.map(|n| n.trim().to_string()),
            session_id,
            bank_account_id,
            payment_method,
            total_amount,
            currency,
            notes,
            issued_at: now,
            created_at: now,
            lines,
        })
    }
}
