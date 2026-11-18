use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CheckoutState {
    FiscalPending,
    FiscalIssued,
    Reconciling,
}

impl CheckoutState {
    pub fn as_str(&self) -> &'static str {
        match self {
            CheckoutState::FiscalPending => "FISCAL_PENDING",
            CheckoutState::FiscalIssued => "FISCAL_ISSUED",
            CheckoutState::Reconciling => "RECONCILING",
        }
    }

    pub fn parse(value: &str) -> Result<Self, DomainError> {
        match value {
            "FISCAL_PENDING" => Ok(CheckoutState::FiscalPending),
            "FISCAL_ISSUED" => Ok(CheckoutState::FiscalIssued),
            "RECONCILING" => Ok(CheckoutState::Reconciling),
            other => Err(DomainError::Persistence(format!(
                "estado de checkout desconhecido: {}",
                other
            ))),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CheckoutEventType {
    CashMovement,
    StockDispatch,
    PrintJob,
}

impl CheckoutEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            CheckoutEventType::CashMovement => "CASH_MOVEMENT",
            CheckoutEventType::StockDispatch => "STOCK_DISPATCH",
            CheckoutEventType::PrintJob => "PRINT_JOB",
        }
    }
}

#[derive(Debug, Clone)]
pub struct CheckoutOutboxEvent {
    pub event_type: CheckoutEventType,
    pub payload: Value,
    pub idempotency_key: String,
}

#[derive(Debug, Clone)]
pub struct PosCheckoutIntent {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub idempotency_key: String,
    pub terminal_id: Option<Uuid>,
    pub state: CheckoutState,
    pub payload_hash: String,
    pub invoice_id: Option<Uuid>,
    pub document_number: Option<String>,
    pub result: Option<Value>,
    pub last_error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl PosCheckoutIntent {
    pub fn new(
        tenant_id: Uuid,
        idempotency_key: String,
        terminal_id: Option<Uuid>,
        payload_hash: String,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            tenant_id,
            idempotency_key,
            terminal_id,
            state: CheckoutState::FiscalPending,
            payload_hash,
            invoice_id: None,
            document_number: None,
            result: None,
            last_error: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn is_replayable(&self) -> bool {
        self.state != CheckoutState::FiscalPending
    }

    pub fn mark_fiscal_issued(
        &mut self,
        invoice_id: Uuid,
        document_number: String,
        result: Value,
    ) -> Result<(), DomainError> {
        if self.state != CheckoutState::FiscalPending {
            return Err(DomainError::ConcurrencyConflict(format!(
                "checkout {} já está no estado {}",
                self.id,
                self.state.as_str()
            )));
        }
        self.state = CheckoutState::FiscalIssued;
        self.invoice_id = Some(invoice_id);
        self.document_number = Some(document_number);
        self.result = Some(result);
        self.last_error = None;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn mark_reconciling(&mut self, error: &str, result: Value) -> Result<(), DomainError> {
        if self.state != CheckoutState::FiscalPending {
            return Err(DomainError::ConcurrencyConflict(format!(
                "checkout {} já está no estado {}",
                self.id,
                self.state.as_str()
            )));
        }
        self.state = CheckoutState::Reconciling;
        self.last_error = Some(error.to_string());
        self.result = Some(result);
        self.updated_at = Utc::now();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intent() -> PosCheckoutIntent {
        PosCheckoutIntent::new(
            Uuid::from_u128(1),
            "sale-1".into(),
            None,
            "sha256:abc".into(),
        )
    }

    #[test]
    fn pending_intent_is_not_replayable() {
        assert!(!intent().is_replayable());
    }

    #[test]
    fn fiscal_issued_intent_can_be_replayed() {
        let mut intent = intent();
        intent
            .mark_fiscal_issued(Uuid::new_v4(), "FT/1".into(), serde_json::json!({}))
            .unwrap();

        assert!(intent.is_replayable());
        assert_eq!(intent.state, CheckoutState::FiscalIssued);
        assert_eq!(intent.document_number.as_deref(), Some("FT/1"));
    }

    #[test]
    fn a_terminal_state_cannot_be_changed_twice() {
        let mut intent = intent();
        intent
            .mark_fiscal_issued(Uuid::new_v4(), "FT/1".into(), serde_json::json!({}))
            .unwrap();

        assert!(matches!(
            intent.mark_reconciling("erro", serde_json::json!({})),
            Err(DomainError::ConcurrencyConflict(_))
        ));
    }

    #[test]
    fn failure_moves_to_reconciling_and_keeps_the_error() {
        let mut intent = intent();
        intent
            .mark_reconciling(
                "fatura não emitida",
                serde_json::json!({ "state": "FAILED" }),
            )
            .unwrap();

        assert!(intent.is_replayable());
        assert_eq!(intent.state, CheckoutState::Reconciling);
        assert_eq!(intent.last_error.as_deref(), Some("fatura não emitida"));
    }

    #[test]
    fn states_round_trip() {
        for state in [
            CheckoutState::FiscalPending,
            CheckoutState::FiscalIssued,
            CheckoutState::Reconciling,
        ] {
            assert_eq!(CheckoutState::parse(state.as_str()).unwrap(), state);
        }
    }
}
