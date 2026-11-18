use std::sync::Arc;

use kudiba_gateway_signature::{canonical_json_bytes, compute_payload_signature};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::application::commands::issue_invoice::IssueInvoiceUseCase;
use crate::application::dto::{is_cash_payment_method, IssueInvoiceCommand, IssueInvoiceResult};
use crate::domain::entities::pos_checkout::{
    CheckoutEventType, CheckoutOutboxEvent, CheckoutState, PosCheckoutIntent,
};
use crate::domain::error::DomainError;
use crate::domain::ports::pos_checkout_repository::{InsertCheckoutOutcome, PosCheckoutRepository};

/// As chaves derivadas (`pos-checkout:{key}:stock`) juntam 19 caracteres e o
/// destino (Tesouraria) aceita no máximo 160 caracteres.
pub const MAX_POS_IDEMPOTENCY_KEY_CHARS: usize = 141;

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
    pub print_job: Option<Value>,
    pub error: Option<String>,
}

pub struct CoordinateCheckoutUseCase {
    repository: Arc<dyn PosCheckoutRepository>,
    issue_invoice: Arc<IssueInvoiceUseCase>,
    print_signing_secret: String,
}

enum ExistingCheckout {
    Replay(PosCheckoutIntent),
    Reissue(PosCheckoutIntent),
}

impl CoordinateCheckoutUseCase {
    pub fn new(
        repository: Arc<dyn PosCheckoutRepository>,
        issue_invoice: Arc<IssueInvoiceUseCase>,
        print_signing_secret: String,
    ) -> Self {
        Self {
            repository,
            issue_invoice,
            print_signing_secret,
        }
    }

    pub async fn execute(
        &self,
        request: PosCheckoutRequest,
        raw_payload: &str,
    ) -> Result<PosCheckoutResult, DomainError> {
        let key = validate_idempotency_key(&request.idempotency_key)?;
        let tenant_id = request.invoice.tenant_id;
        let payload_hash = canonical_payload_hash(raw_payload)?;

        let decision = match self.repository.find_by_key(tenant_id, &key).await? {
            Some(existing) => Some(resolve_existing(existing, &payload_hash)?),
            None => None,
        };

        let intent = match decision {
            Some(ExistingCheckout::Replay(existing)) => return Ok(replay(&existing, true)),
            Some(ExistingCheckout::Reissue(existing)) => self.prepare_retry(existing).await?,
            None => {
                let created = PosCheckoutIntent::new(
                    tenant_id,
                    key.clone(),
                    request.terminal_id,
                    payload_hash.clone(),
                );
                match self.repository.insert_new(&created).await? {
                    InsertCheckoutOutcome::Created => created,
                    InsertCheckoutOutcome::Existing(existing) => {
                        match resolve_existing(*existing, &payload_hash)? {
                            ExistingCheckout::Replay(existing) => {
                                return Ok(replay(&existing, true))
                            }
                            ExistingCheckout::Reissue(existing) => {
                                self.prepare_retry(existing).await?
                            }
                        }
                    }
                }
            }
        };

        let issued = match self.issue_invoice.execute(request.invoice.clone()).await {
            Ok(issued) => issued,
            Err(err) => {
                let message = err.to_string();
                let retry_count = intent.retry_count();
                let stored = json!({
                    "invoice": null,
                    "pendingEvents": [],
                    "error": message,
                    "retryCount": retry_count,
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

        let events = build_events(
            &key,
            intent.id,
            &request,
            &issued,
            &self.print_signing_secret,
        )?;
        let invoice_value = serde_json::to_value(&issued)
            .map_err(|err| DomainError::Persistence(err.to_string()))?;
        let print_job = events
            .iter()
            .find(|event| event.event_type == CheckoutEventType::PrintJob)
            .map(|event| event.payload.clone());
        let stored = json!({
            "invoice": invoice_value,
            "pendingEvents": events.iter().map(|event| event.event_type.as_str()).collect::<Vec<_>>(),
            "printJob": print_job,
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

    async fn prepare_retry(
        &self,
        existing: PosCheckoutIntent,
    ) -> Result<PosCheckoutIntent, DomainError> {
        let mut retrying = existing;
        retrying.retry_from_reconciling()?;
        self.repository
            .reset_to_fiscal_pending(retrying.tenant_id, retrying.id, retrying.retry_count())
            .await?;
        Ok(retrying)
    }
}

fn validate_idempotency_key(raw: &str) -> Result<String, DomainError> {
    let key = raw.trim().to_string();
    if key.is_empty() {
        return Err(DomainError::invalid("idempotencyKey é obrigatória"));
    }
    if key.chars().count() > MAX_POS_IDEMPOTENCY_KEY_CHARS {
        return Err(DomainError::invalid(format!(
            "idempotencyKey excede {} caracteres; as chaves derivadas de checkout não podem ultrapassar 160.",
            MAX_POS_IDEMPOTENCY_KEY_CHARS
        )));
    }
    Ok(key)
}

fn canonical_payload_hash(raw_payload: &str) -> Result<String, DomainError> {
    let value: Value = serde_json::from_str(raw_payload)
        .map_err(|err| DomainError::invalid(format!("payload POS inválido: {err}")))?;
    let bytes =
        canonical_json_bytes(&value).map_err(|err| DomainError::Persistence(err.to_string()))?;
    let digest = Sha256::digest(&bytes);
    Ok(digest
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>())
}

fn resolve_existing(
    existing: PosCheckoutIntent,
    payload_hash: &str,
) -> Result<ExistingCheckout, DomainError> {
    if existing.payload_hash != payload_hash {
        return Err(DomainError::ConcurrencyConflict(
            "chave de idempotência reutilizada com um payload diferente".to_string(),
        ));
    }

    if existing.state == CheckoutState::Reconciling {
        if existing.can_retry() {
            return Ok(ExistingCheckout::Reissue(existing));
        }
        return Err(DomainError::ConcurrencyConflict(
            "checkout em reconciliação esgotou o número de tentativas; contacte o administrador"
                .to_string(),
        ));
    }

    if !existing.is_replayable() {
        return Err(DomainError::ConcurrencyConflict(
            "checkout ainda em curso; repita com a mesma chave".to_string(),
        ));
    }

    Ok(ExistingCheckout::Replay(existing))
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
    let print_job = stored
        .get("printJob")
        .filter(|value| !value.is_null())
        .cloned();
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
        print_job,
        error,
    }
}

#[allow(clippy::too_many_arguments)]
fn build_events(
    key: &str,
    checkout_id: Uuid,
    request: &PosCheckoutRequest,
    issued: &IssueInvoiceResult,
    print_signing_secret: &str,
) -> Result<Vec<CheckoutOutboxEvent>, DomainError> {
    let tenant_id = request.invoice.tenant_id;
    let mut events = Vec::new();

    let amount_due = issued.gross_total + issued.stamp_duty_total - issued.withholding_total;
    let cash_allocations = request
        .invoice
        .payment_amounts
        .iter()
        .filter(|allocation| is_cash_payment_method(&allocation.payment_method))
        .collect::<Vec<_>>();
    let cash_amount = if request.invoice.payment_amounts.is_empty() {
        if request
            .invoice
            .payment_methods
            .iter()
            .any(|method| is_cash_payment_method(method))
        {
            amount_due
        } else {
            Decimal::ZERO
        }
    } else {
        cash_allocations
            .iter()
            .fold(Decimal::ZERO, |total, allocation| total + allocation.amount)
    };

    if cash_amount > Decimal::ZERO {
        if let Some(session_id) = issued.cash_session_id.or(request.invoice.cash_session_id) {
            events.push(CheckoutOutboxEvent {
                event_type: CheckoutEventType::CashMovement,
                payload: json!({
                    "tenantId": tenant_id,
                    "checkoutId": checkout_id,
                    "invoiceId": issued.invoice_id,
                    "cashSessionId": session_id,
                    "amount": cash_amount,
                    "totalAmount": amount_due,
                    "paymentAmounts": cash_allocations.iter().map(|allocation| json!({
                        "paymentMethod": allocation.payment_method,
                        "amount": allocation.amount,
                    })).collect::<Vec<_>>(),
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

    let print_job_id = format!("pos-checkout:{}:print", key);
    let amount_due_display = format!("{:.2}", amount_due);
    let envelope_lines = request
        .invoice
        .lines
        .iter()
        .enumerate()
        .map(|(index, line)| {
            json!({
                "lineNumber": index + 1,
                "description": line.description,
                "quantity": line.quantity,
                "unitPrice": format!("{:.2}", line.unit_price),
            })
        })
        .collect::<Vec<_>>();

    let authorization_object = json!({
        "printJobId": print_job_id,
        "tenantId": tenant_id,
        "terminalId": request.terminal_id,
        "documentNumber": issued.document_number,
        "jobClass": "FISCAL_ENVELOPE",
        "copyType": "ORIGINAL",
        "payloadHash": issued.hash_sha256,
        "envelope": {
            "documentType": request.invoice.document_type,
            "documentNumber": issued.document_number,
            "customerName": request.invoice.customer_name,
            "customerNif": request.invoice.customer_nif,
            "hash": issued.hash_sha256,
            "validationChars": issued.validation_chars,
            "totalAmount": amount_due_display,
            "lines": envelope_lines,
        },
    });
    let authorization_bytes = canonical_json_bytes(&authorization_object)
        .map_err(|err| DomainError::Persistence(err.to_string()))?;
    let print_authorization = compute_payload_signature(print_signing_secret, &authorization_bytes);

    events.push(CheckoutOutboxEvent {
        event_type: CheckoutEventType::PrintJob,
        payload: json!({
            "tenantId": tenant_id,
            "checkoutId": checkout_id,
            "printJobId": print_job_id,
            "terminalId": request.terminal_id,
            "invoiceId": issued.invoice_id,
            "documentNumber": issued.document_number,
            "jobClass": "FISCAL_ENVELOPE",
            "copyType": "ORIGINAL",
            "payloadHash": issued.hash_sha256,
            "signature": issued.signature_rsa_base64,
            "printAuthorization": print_authorization,
            "validationChars": issued.validation_chars,
            "totalAmount": amount_due_display,
            "paymentAmounts": request.invoice.payment_amounts.iter().map(|allocation| json!({
                "paymentMethod": allocation.payment_method,
                "amount": allocation.amount,
            })).collect::<Vec<_>>(),
            "envelope": {
                "documentNumber": issued.document_number,
                "documentType": request.invoice.document_type,
                "customerName": request.invoice.customer_name,
                "customerNif": request.invoice.customer_nif,
                "hash": issued.hash_sha256,
                "signature": issued.signature_rsa_base64,
                "validationChars": issued.validation_chars,
                "lines": envelope_lines,
                "totalAmount": amount_due_display,
            },
        }),
        idempotency_key: print_job_id,
    });

    Ok(events)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::dto::PaymentAmountInput;
    use crate::domain::entities::pos_checkout::MAX_CHECKOUT_RETRIES;
    use kudiba_gateway_signature::verify_payload_signature;

    const SECRET: &str = "print-secret";

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
                customer_nif: Some("123456789".into()),
                source_document_number: None,
                payment_methods: methods.into_iter().map(str::to_string).collect(),
                payment_amounts: Vec::new(),
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

    fn events(request: &PosCheckoutRequest) -> Vec<CheckoutOutboxEvent> {
        build_events("sale-1", Uuid::from_u128(2), request, &issued(), SECRET).unwrap()
    }

    #[test]
    fn cash_payment_creates_a_separate_drawer_cause() {
        let events = events(&request(vec!["NUMERARIO"]));
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
        let events = events(&request(vec!["MBWAY"]));
        let types = events
            .iter()
            .map(|event| event.event_type)
            .collect::<Vec<_>>();

        assert!(!types.contains(&CheckoutEventType::CashMovement));
        assert!(types.contains(&CheckoutEventType::StockDispatch));
        assert!(types.contains(&CheckoutEventType::PrintJob));
    }

    #[test]
    fn only_the_cash_component_reaches_the_drawer_event() {
        let mut request = request(vec![" EFETIVO ", "MBWAY"]);
        request.invoice.payment_amounts = vec![
            PaymentAmountInput {
                payment_method: " EFETIVO ".into(),
                amount: Decimal::from(40),
            },
            PaymentAmountInput {
                payment_method: "MBWAY".into(),
                amount: Decimal::from(76),
            },
        ];
        let events = events(&request);
        let cash = events
            .iter()
            .find(|event| event.event_type == CheckoutEventType::CashMovement)
            .expect("cash movement");

        assert_eq!(cash.payload["amount"], json!("40"));
        assert_eq!(cash.payload["totalAmount"], json!("116"));
        assert_eq!(cash.payload["paymentAmounts"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn print_event_carries_no_drawer_instruction() {
        let events = events(&request(vec!["NUMERARIO"]));
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
        for event in events(&request(vec!["NUMERARIO"])) {
            assert!(event.idempotency_key.starts_with("pos-checkout:sale-1:"));
        }
    }

    #[test]
    fn idempotency_key_is_bounded_by_the_derived_key_limit() {
        assert!(validate_idempotency_key(&"x".repeat(141)).is_ok());
        let err = validate_idempotency_key(&"x".repeat(142)).unwrap_err();
        assert!(err.to_string().contains("141"));
        assert!(validate_idempotency_key("  ").is_err());
    }

    #[test]
    fn payload_hash_uses_canonical_json() {
        let first = canonical_payload_hash(r#"{"b":1,"a":{"y":2,"x":3}}"#).unwrap();
        let reordered = canonical_payload_hash(r#"{"a":{"x":3,"y":2},"b":1}"#).unwrap();
        let different = canonical_payload_hash(r#"{"a":1,"b":2}"#).unwrap();

        assert_eq!(first, reordered);
        assert_ne!(first, different);
        assert!(canonical_payload_hash("not-json").is_err());
    }

    #[test]
    fn payload_mismatch_is_a_conflict_on_every_replay_path() {
        let mut issued_intent = PosCheckoutIntent::new(
            Uuid::from_u128(1),
            "sale-1".into(),
            None,
            "right-hash".into(),
        );
        issued_intent
            .mark_fiscal_issued(Uuid::new_v4(), "FT/1".into(), json!({}))
            .unwrap();
        assert!(matches!(
            resolve_existing(issued_intent, "wrong-hash"),
            Err(DomainError::ConcurrencyConflict(_))
        ));

        let mut reconciling = PosCheckoutIntent::new(
            Uuid::from_u128(1),
            "sale-1".into(),
            None,
            "right-hash".into(),
        );
        reconciling
            .mark_reconciling("erro", json!({ "retryCount": 1 }))
            .unwrap();
        assert!(matches!(
            resolve_existing(reconciling, "wrong-hash"),
            Err(DomainError::ConcurrencyConflict(_))
        ));
    }

    #[test]
    fn reconciling_intents_retry_until_the_cap() {
        let mut reconciling = PosCheckoutIntent::new(
            Uuid::from_u128(1),
            "sale-1".into(),
            None,
            "same-hash".into(),
        );
        reconciling
            .mark_reconciling("erro", json!({ "retryCount": MAX_CHECKOUT_RETRIES - 1 }))
            .unwrap();
        assert!(matches!(
            resolve_existing(reconciling, "same-hash"),
            Ok(ExistingCheckout::Reissue(_))
        ));

        let mut exhausted = PosCheckoutIntent::new(
            Uuid::from_u128(1),
            "sale-1".into(),
            None,
            "same-hash".into(),
        );
        exhausted
            .mark_reconciling("erro", json!({ "retryCount": MAX_CHECKOUT_RETRIES }))
            .unwrap();
        assert!(matches!(
            resolve_existing(exhausted, "same-hash"),
            Err(DomainError::ConcurrencyConflict(_))
        ));
    }

    #[test]
    fn pending_intents_remain_non_replayable() {
        let pending = PosCheckoutIntent::new(
            Uuid::from_u128(1),
            "sale-1".into(),
            None,
            "same-hash".into(),
        );
        assert!(matches!(
            resolve_existing(pending, "same-hash"),
            Err(DomainError::ConcurrencyConflict(_))
        ));
    }

    #[test]
    fn print_authorization_uses_the_agreed_canonical_object() {
        let receipt = request(vec!["NUMERARIO"]);
        let mut receipt = receipt;
        receipt.invoice.lines = vec![crate::application::dto::InvoiceLineInput {
            product_code: "P1".into(),
            description: "Artigo".into(),
            quantity: Decimal::from(2),
            unit_price: Decimal::new(123455, 2),
            discount_amount: None,
            tax_rate: Decimal::from(14),
            tax_exemption_code: None,
            is_service: None,
        }];
        let result = issued();
        let print = build_events("sale-1", Uuid::from_u128(2), &receipt, &result, SECRET)
            .unwrap()
            .into_iter()
            .find(|event| event.event_type == CheckoutEventType::PrintJob)
            .unwrap();

        let authorization = print.payload["printAuthorization"]
            .as_str()
            .expect("printAuthorization");
        let expected_object = json!({
            "printJobId": "pos-checkout:sale-1:print",
            "tenantId": receipt.invoice.tenant_id,
            "terminalId": receipt.terminal_id,
            "documentNumber": result.document_number,
            "jobClass": "FISCAL_ENVELOPE",
            "copyType": "ORIGINAL",
            "payloadHash": result.hash_sha256,
            "envelope": {
                "documentType": receipt.invoice.document_type,
                "documentNumber": result.document_number,
                "customerName": receipt.invoice.customer_name,
                "customerNif": receipt.invoice.customer_nif,
                "hash": result.hash_sha256,
                "validationChars": result.validation_chars,
                "totalAmount": "116.00",
                "lines": [{
                    "lineNumber": 1,
                    "description": "Artigo",
                    "quantity": "2",
                    "unitPrice": "1234.55",
                }],
            },
        });
        assert!(expected_object.get("signature").is_none());
        assert!(expected_object["envelope"].get("signature").is_none());
        let bytes = canonical_json_bytes(&expected_object).unwrap();
        assert!(verify_payload_signature(SECRET, &bytes, authorization));
        assert!(!verify_payload_signature(
            "outro-segredo",
            &bytes,
            authorization
        ));

        assert_eq!(print.payload["envelope"]["totalAmount"], "116.00");
        assert_eq!(
            print.payload["envelope"]["lines"][0]["unitPrice"],
            "1234.55"
        );
        assert_eq!(print.payload["envelope"]["lines"][0]["lineNumber"], 1);
        assert_eq!(print.payload["envelope"]["customerNif"], json!("123456789"));
        assert_eq!(print.payload["totalAmount"], "116.00");
    }
}
