use std::sync::Arc;
use std::time::Duration;

use serde_json::{json, Value};
use sqlx::Row;
use tokio::sync::watch;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::DbSessionFactory;

pub struct PosCheckoutEventWorker {
    session_factory: Arc<dyn DbSessionFactory>,
    client: reqwest::Client,
    treasury_url: Option<String>,
    inventory_url: Option<String>,
    internal_gateway_secret: String,
    poll_interval: Duration,
    batch_size: i64,
}

impl PosCheckoutEventWorker {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        client: reqwest::Client,
        treasury_url: Option<String>,
        inventory_url: Option<String>,
        internal_gateway_secret: String,
        poll_interval: Duration,
        batch_size: i64,
    ) -> Self {
        Self {
            session_factory,
            client,
            treasury_url,
            inventory_url,
            internal_gateway_secret,
            poll_interval,
            batch_size,
        }
    }

    pub async fn process_batch(&self) -> Result<usize, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))?;
        let tenant_ids = sqlx::query_scalar::<_, Uuid>("SELECT id FROM kudiba_core.tenants")
            .fetch_all(session.connection())
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))?;
        drop(session);

        let mut published_count = 0;
        for tenant_id in tenant_ids {
            published_count += crate::config::with_tenant_context(
                Some(tenant_id),
                self.process_tenant_batch(tenant_id),
            )
            .await?;
        }

        Ok(published_count)
    }

    async fn process_tenant_batch(&self, tenant_id: Uuid) -> Result<usize, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))?;
        let rows = sqlx::query(
            "SELECT id, event_type, payload, idempotency_key \
             FROM kudiba_core.pos_checkout_events \
             WHERE tenant_id = $1 AND published_at IS NULL \
               AND event_type IN ('CASH_MOVEMENT', 'STOCK_DISPATCH') \
             ORDER BY created_at ASC \
             LIMIT $2",
        )
        .bind(tenant_id)
        .bind(self.batch_size)
        .fetch_all(session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;
        drop(session);

        let mut published_ids = Vec::new();
        for row in rows {
            let event_id: Uuid = row
                .try_get("id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let event_type: String = row
                .try_get("event_type")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let payload: Value = row
                .try_get("payload")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            let idempotency_key: String = row
                .try_get("idempotency_key")
                .map_err(|e| DomainError::Persistence(e.to_string()))?;

            let result = match event_type.as_str() {
                "CASH_MOVEMENT" => {
                    self.publish_cash_movement(tenant_id, &payload, &idempotency_key)
                        .await
                }
                "STOCK_DISPATCH" => self.publish_stock_dispatch(tenant_id, &payload).await,
                other => Err(DomainError::Persistence(format!(
                    "evento de checkout não suportado: {}",
                    other
                ))),
            };

            match result {
                Ok(()) => published_ids.push(event_id),
                Err(err) => tracing::error!(
                    event_id = %event_id,
                    event_type = %event_type,
                    error = %err,
                    "falha ao entregar evento de checkout; será tentado na próxima iteração"
                ),
            }
        }

        let published_count = published_ids.len();
        if !published_ids.is_empty() {
            let mut update_session = self
                .session_factory
                .open()
                .await
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            for event_id in &published_ids {
                sqlx::query(
                    "UPDATE kudiba_core.pos_checkout_events \
                     SET published_at = NOW() \
                     WHERE tenant_id = $1 AND id = $2 AND published_at IS NULL",
                )
                .bind(tenant_id)
                .bind(*event_id)
                .execute(update_session.connection())
                .await
                .map_err(|e| DomainError::Persistence(e.to_string()))?;
            }
        }

        Ok(published_count)
    }

    async fn publish_cash_movement(
        &self,
        tenant_id: Uuid,
        payload: &Value,
        idempotency_key: &str,
    ) -> Result<(), DomainError> {
        let body = cash_movement_body(payload, idempotency_key)?;
        let base = self.treasury_url.as_ref().ok_or_else(|| {
            DomainError::Persistence("TREASURY_SERVICE_URL não configurada".to_string())
        })?;
        let endpoint = format!(
            "{}/api/v1/treasury/internal/cash-movements",
            base.trim_end_matches('/')
        );
        let timestamp = chrono::Utc::now().timestamp().to_string();
        let signature = internal_signature(
            &self.internal_gateway_secret,
            &timestamp,
            "POST",
            "/api/v1/treasury/internal/cash-movements",
        );

        let response = self
            .client
            .post(&endpoint)
            .header("X-Resolved-Tenant-ID", tenant_id.to_string())
            .header("X-Resolved-User-ID", "pos-checkout")
            .header("X-Gateway-Timestamp", timestamp)
            .header("X-Gateway-Signature", signature)
            .json(&body)
            .send()
            .await
            .map_err(|e| DomainError::Persistence(format!("falha ao chamar Tesouraria: {}", e)))?;

        ensure_success(response, "Tesouraria").await
    }

    async fn publish_stock_dispatch(
        &self,
        tenant_id: Uuid,
        payload: &Value,
    ) -> Result<(), DomainError> {
        let base = self.inventory_url.as_ref().ok_or_else(|| {
            DomainError::Persistence("INVENTORY_SERVICE_URL não configurada".to_string())
        })?;
        let endpoint = format!(
            "{}/api/v1/inventory/events/invoice-issued",
            base.trim_end_matches('/')
        );

        let response = self
            .client
            .post(&endpoint)
            .header("X-Resolved-Tenant-ID", tenant_id.to_string())
            .header("X-Resolved-User-ID", "pos-checkout")
            .json(payload)
            .send()
            .await
            .map_err(|e| DomainError::Persistence(format!("falha ao chamar Inventário: {}", e)))?;

        ensure_success(response, "Inventário").await
    }

    pub async fn run_loop(&self, mut shutdown: watch::Receiver<bool>) {
        tracing::info!(
            interval_ms = self.poll_interval.as_millis(),
            batch_size = self.batch_size,
            "POS Checkout Event Worker iniciado em segundo plano"
        );

        while !*shutdown.borrow() {
            match self.process_batch().await {
                Ok(count) => {
                    if count > 0 {
                        tracing::debug!(count, "eventos de checkout entregues");
                    }
                }
                Err(err) => {
                    tracing::warn!(error = %err, "erro ao processar eventos de checkout");
                }
            }

            tokio::select! {
                _ = tokio::time::sleep(self.poll_interval) => {},
                _ = shutdown.changed() => break,
            }
        }

        tracing::info!("POS Checkout Event Worker encerrado graciosamente.");
    }
}

fn internal_signature(secret: &str, timestamp: &str, method: &str, path: &str) -> String {
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    let canonical = format!("{}:{}:{}", timestamp, method, path);
    let tag = ring::hmac::sign(&key, canonical.as_bytes());
    tag.as_ref()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect()
}

fn cash_movement_body(payload: &Value, idempotency_key: &str) -> Result<Value, DomainError> {
    let session_id = payload
        .get("cashSessionId")
        .and_then(Value::as_str)
        .and_then(|value| Uuid::parse_str(value).ok())
        .ok_or_else(|| {
            DomainError::Persistence("evento CASH_MOVEMENT sem cashSessionId válido".to_string())
        })?;
    let amount = payload
        .get("amount")
        .and_then(Value::as_number)
        .map(ToString::to_string)
        .or_else(|| {
            payload
                .get("amount")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .ok_or_else(|| {
            DomainError::Persistence("evento CASH_MOVEMENT sem amount válido".to_string())
        })?;
    let reason = payload
        .get("reason")
        .and_then(Value::as_str)
        .unwrap_or("Venda POS")
        .to_string();

    Ok(json!({
        "session_id": session_id,
        "movement_type": "SALE_RECEIPT",
        "amount": amount,
        "reason": reason,
        "operator_user_id": "pos-checkout",
        "idempotency_key": idempotency_key,
    }))
}

async fn ensure_success(response: reqwest::Response, service: &str) -> Result<(), DomainError> {
    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let excerpt: String = body.chars().take(300).collect();
    Err(DomainError::Persistence(format!(
        "{} devolveu {} ao processar checkout: {}",
        service, status, excerpt
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cash_movement_uses_a_string_amount_and_the_event_key() {
        let payload = json!({
            "cashSessionId": "d6f2a1c8-8c99-4e0a-a0dc-4d52f2f4a1b1",
            "amount": 116.5,
            "reason": "Venda POS FT/1",
            "invoiceId": "00000000-0000-0000-0000-000000000001",
            "tenantId": "00000000-0000-0000-0000-000000000002"
        });

        let body = cash_movement_body(&payload, "pos-checkout:sale-1:cash").unwrap();

        assert_eq!(body["movement_type"], "SALE_RECEIPT");
        assert_eq!(body["amount"], "116.5");
        assert_eq!(body["idempotency_key"], "pos-checkout:sale-1:cash");
        assert_eq!(body["operator_user_id"], "pos-checkout");
    }

    #[test]
    fn cash_movement_rejects_a_payload_without_a_session() {
        let payload = json!({ "amount": 10 });
        assert!(cash_movement_body(&payload, "key").is_err());
    }

    #[test]
    fn internal_signature_matches_the_gateway_canonical_form() {
        let signature = internal_signature(
            "secret",
            "1700000000",
            "POST",
            "/api/v1/treasury/internal/cash-movements",
        );

        assert_eq!(signature.len(), 64);
        assert_ne!(
            signature,
            internal_signature(
                "secret",
                "1700000001",
                "POST",
                "/api/v1/treasury/internal/cash-movements"
            )
        );
    }
}
