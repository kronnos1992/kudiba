use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::application::commands::issue_invoice::IssueInvoiceUseCase;
use crate::application::dto::{IssueInvoiceCommand, IssueInvoiceResult};
use crate::domain::entities::pos_checkout::{
    CheckoutEventType, CheckoutOutboxEvent, CheckoutState, PosCheckoutIntent,
};
use crate::domain::error::DomainError;
use crate::domain::ports::pos_checkout_repository::{InsertCheckoutOutcome, PosCheckoutRepository};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PosCheckoutRequest {
    pub idempotency_key: String,
    #[serde(default)]
    pub terminal_id: Option<Uuid>,
    #[serde(flatten)]
    pub invoice: IssueInvoiceCommand,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PosCheckoutResult {
    pub checkout_id: Uuid,
    pub tenant_id: Uuid,
    pub state: CheckoutState,
    pub replay: bool,
    pub invoice_id: Option<Uuid>,
    pub document_number: Option<String>,
    pub invoice: Option<Value>,
    pub pending_events: Vec<String>,
    pub error: Option<String>,
}

pub struct CoordinateCheckoutUseCase {
    repository: Arc<dyn PosCheckoutRepository>,
    issue_invoice: Arc<IssueInvoiceUseCase>,
}

impl CoordinateCheckoutUseCase {
    pub fn new(
        repository: Arc<dyn PosCheckoutRepository>,
        issue_invoice: Arc<IssueInvoiceUseCase>,
    ) -> Self {
        Self {
            repository,
            issue_invoice,
        }
    }

    pub async fn execute(
        &self,
        request: PosCheckoutRequest,
        raw_payload: &str,
    ) -> Result<PosCheckoutResult, DomainError> {
        let key = request.idempotency_key.trim().to_string();
        if key.is_empty() {
            return Err(DomainError::invalid("idempotencyKey é obrigatória"));
        }

        let tenant_id = request.invoice.tenant_id;
        let digest = Sha256::digest(raw_payload.as_bytes());
        let payload_hash = digest
            .iter()
            .map(|byte| format!("{:02x}", byte))
            .collect::<String>();

        if let Some(existing) = self.repository.find_by_key(tenant_id, &key).await? {
            if !existing.is_replayable() {
                return Err(DomainError::ConcurrencyConflict(
                    "checkout ainda em curso; repita com a mesma chave".to_string(),
                ));
            }
            return Ok(replay(&existing, true));
        }

        let intent =
            PosCheckoutIntent::new(tenant_id, key.clone(), request.terminal_id, payload_hash);
        match self.repository.insert_new(&intent).await? {
            InsertCheckoutOutcome::Created => {}
            InsertCheckoutOutcome::Existing(existing) => return Ok(replay(&existing, true)),
        }

        let issued = match self.issue_invoice.execute(request.invoice.clone()).await {
            Ok(issued) => issued,
            Err(err) => {
                let message = err.to_string();
                let stored = json!({
                    "invoice": null,
                    "pendingEvents": [],
                    "error": message,
                });
                let mut failed = intent.clone();
                if failed.mark_reconciling(&message, stored.clone()).is_ok() {
                    if let Err(mark_err) = self
                        .repository
                        .mark_reconciling(tenant_id, intent.id, &message, &stored)
                        .await
                    {
                        tracing::error!(
                            checkout_id = %intent.id,
                            error = %mark_err,
                            "falha ao registar checkout em reconciliação"
                        );
                    }
                }
                return Err(err);
            }
        };

        let events = build_events(&key, intent.id, &request, &issued);
        let invoice_value = serde_json::to_value(&issued)
            .map_err(|err| DomainError::Persistence(err.to_string()))?;
        let stored = json!({
            "invoice": invoice_value,
            "pendingEvents": events.iter().map(|event| event.event_type.as_str()).collect::<Vec<_>>(),
            "error": null,
        });

        self.repository
            .mark_fiscal_issued(
                tenant_id,
                intent.id,
                issued.invoice_id,
                &issued.document_number,
                &stored,
                &events,
            )
            .await?;

        let mut done = intent;
        done.mark_fiscal_issued(
            issued.invoice_id,
            issued.document_number.clone(),
            stored.clone(),
        )?;
        Ok(replay(&done, false))
    }
}

fn replay(intent: &PosCheckoutIntent, is_replay: bool) -> PosCheckoutResult {
    let stored = intent.result.clone().unwrap_or_else(|| json!({}));
    let invoice = stored
        .get("invoice")
        .filter(|value| !value.is_null())
        .cloned();
    let pending_events = stored
        .get("pendingEvents")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();
    let error = stored
        .get("error")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| intent.last_error.clone());

    PosCheckoutResult {
        checkout_id: intent.id,
        tenant_id: intent.tenant_id,
        state: intent.state,
        replay: is_replay,
        invoice_id: intent.invoice_id,
        document_number: intent.document_number.clone(),
        invoice,
        pending_events,
        error,
    }
}

fn build_events(
    key: &str,
    checkout_id: Uuid,
    request: &PosCheckoutRequest,
    issued: &IssueInvoiceResult,
) -> Vec<CheckoutOutboxEvent> {
    let tenant_id = request.invoice.tenant_id;
    let mut events = Vec::new();

    let has_cash = request.invoice.payment_methods.iter().any(|method| {
        matches!(
            method.trim().to_ascii_uppercase().as_str(),
            "NUMERARIO" | "CASH" | "DINHEIRO"
        )
    });
    if has_cash {
        if let Some(session_id) = issued.cash_session_id.or(request.invoice.cash_session_id) {
            events.push(CheckoutOutboxEvent {
                event_type: CheckoutEventType::CashMovement,
                payload: json!({
                    "tenantId": tenant_id,
                    "checkoutId": checkout_id,
                    "invoiceId": issued.invoice_id,
                    "cashSessionId": session_id,
                    "amount": issued.gross_total,
                    "reason": format!("Venda POS {}", issued.document_number),
                }),
                idempotency_key: format!("pos-checkout:{}:cash", key),
            });
        }
    }

    events.push(CheckoutOutboxEvent {
        event_type: CheckoutEventType::StockDispatch,
        payload: json!({
            "tenantId": tenant_id,
            "checkoutId": checkout_id,
            "invoiceId": issued.invoice_id,
            "documentNumber": issued.document_number,
            "documentType": request.invoice.document_type,
            "lines": request
                .invoice
                .lines
                .iter()
                .enumerate()
                .map(|(index, line)| {
                    json!({
                        "lineNumber": index + 1,
                        "productCode": line.product_code,
                        "description": line.description,
                        "quantity": line.quantity,
                        "unitPrice": line.unit_price,
                    })
                })
                .collect::<Vec<_>>(),
        }),
        idempotency_key: format!("pos-checkout:{}:stock", key),
    });

    events.push(CheckoutOutboxEvent {
        event_type: CheckoutEventType::PrintJob,
        payload: json!({
            "tenantId": tenant_id,
            "checkoutId": checkout_id,
            "invoiceId": issued.invoice_id,
            "documentNumber": issued.document_number,
            "jobClass": "FISCAL_ENVELOPE",
            "copyType": "ORIGINAL",
            "payloadHash": issued.hash_sha256,
            "signature": issued.signature_rsa_base64,
            "validationChars": issued.validation_chars,
        }),
        idempotency_key: format!("pos-checkout:{}:print", key),
    });

    events
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn issued() -> IssueInvoiceResult {
        IssueInvoiceResult {
            invoice_id: Uuid::from_u128(10),
            document_number: "FT 2026A/000123".into(),
            sequence_number: 123,
            net_total: Decimal::from(100),
            tax_total: Decimal::from(16),
            gross_total: Decimal::from(116),
            withholding_total: Decimal::ZERO,
            stamp_duty_total: Decimal::ZERO,
            amount_due: Decimal::from(116),
            hash_sha256: "hash".into(),
            signature_rsa_base64: "signature".into(),
            validation_chars: "ABCD".into(),
            issued_at: chrono::Utc::now(),
            system_entry_date: chrono::Utc::now(),
            is_contingency: false,
            transport: None,
            cash_session_id: Some(Uuid::from_u128(20)),
        }
    }

    fn request(methods: Vec<&str>) -> PosCheckoutRequest {
        PosCheckoutRequest {
            idempotency_key: "sale-1".into(),
            terminal_id: Some(Uuid::from_u128(30)),
            invoice: IssueInvoiceCommand {
                actor_user_id: None,
                tenant_id: Uuid::from_u128(1),
                document_type: "FR".into(),
                series_code: "2026A".into(),
                fiscal_year: 2026,
                customer_name: "Consumidor Final".into(),
                customer_address: None,
                customer_city: None,
                customer_country: None,
                customer_nif: None,
                source_document_number: None,
                payment_methods: methods.into_iter().map(str::to_string).collect(),
                withholding_total: None,
                apply_withholding: None,
                withholding_rate: None,
                stamp_duty_total: None,
                apply_stamp_duty: None,
                stamp_duty_rate: None,
                currency: "AOA".into(),
                lines: Vec::new(),
                is_contingency: false,
                key_version: "v1".into(),
                transport: None,
                cash_session_id: Some(Uuid::from_u128(20)),
            },
        }
    }

    #[test]
    fn cash_payment_creates_a_separate_drawer_cause() {
        let events = build_events(
            "sale-1",
            Uuid::from_u128(2),
            &request(vec!["NUMERARIO"]),
            &issued(),
        );
        let types = events
            .iter()
            .map(|event| event.event_type)
            .collect::<Vec<_>>();

        assert!(types.contains(&CheckoutEventType::CashMovement));
        assert!(types.contains(&CheckoutEventType::StockDispatch));
        assert!(types.contains(&CheckoutEventType::PrintJob));
    }

    #[test]
    fn non_cash_payment_never_creates_a_drawer_event() {
        let events = build_events(
            "sale-1",
            Uuid::from_u128(2),
            &request(vec!["MBWAY"]),
            &issued(),
        );
        let types = events
            .iter()
            .map(|event| event.event_type)
            .collect::<Vec<_>>();

        assert!(!types.contains(&CheckoutEventType::CashMovement));
        assert!(types.contains(&CheckoutEventType::StockDispatch));
        assert!(types.contains(&CheckoutEventType::PrintJob));
    }

    #[test]
    fn print_event_carries_no_drawer_instruction() {
        let events = build_events(
            "sale-1",
            Uuid::from_u128(2),
            &request(vec!["NUMERARIO"]),
            &issued(),
        );
        let print = events
            .iter()
            .find(|event| event.event_type == CheckoutEventType::PrintJob)
            .unwrap();

        assert_eq!(print.payload["jobClass"], "FISCAL_ENVELOPE");
        assert_eq!(print.payload["copyType"], "ORIGINAL");
        assert!(print.payload.get("drawer").is_none());
    }

    #[test]
    fn event_keys_are_derived_from_the_checkout_key() {
        let events = build_events(
            "sale-1",
            Uuid::from_u128(2),
            &request(vec!["NUMERARIO"]),
            &issued(),
        );
        for event in events {
            assert!(event.idempotency_key.starts_with("pos-checkout:sale-1:"));
        }
    }
}
