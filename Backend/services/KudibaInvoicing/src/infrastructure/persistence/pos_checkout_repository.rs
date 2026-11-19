use async_trait::async_trait;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::entities::pos_checkout::{
    CheckoutOutboxEvent, CheckoutState, PosCheckoutIntent,
};
use crate::domain::error::DomainError;
use crate::domain::ports::pos_checkout_repository::{InsertCheckoutOutcome, PosCheckoutRepository};

const PRINT_JOB_QUERY: &str = "SELECT payload FROM kudiba_core.pos_checkout_events \
     WHERE tenant_id = $1 AND idempotency_key = $2 AND event_type = 'PRINT_JOB'";

pub struct PgPosCheckoutRepository {
    pool: PgPool,
}

fn map_print_job_payload(print_job_id: &str, payload: Value) -> Result<Value, DomainError> {
    if payload.get("printJobId").and_then(Value::as_str) != Some(print_job_id) {
        return Err(DomainError::Persistence(
            "PRINT_JOB com printJobId divergente".to_string(),
        ));
    }
    Ok(payload)
}

impl PgPosCheckoutRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    fn map_row(row: &sqlx::postgres::PgRow) -> Result<PosCheckoutIntent, DomainError> {
        let state: String = row
            .try_get("state")
            .map_err(|e| DomainError::Persistence(e.to_string()))?;
        let intent = PosCheckoutIntent {
            id: row
                .try_get("id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            tenant_id: row
                .try_get("tenant_id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            idempotency_key: row
                .try_get("idempotency_key")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            terminal_id: row
                .try_get("terminal_id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            state: CheckoutState::parse(&state)?,
            payload_hash: row
                .try_get("payload_hash")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            invoice_id: row
                .try_get("invoice_id")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            document_number: row
                .try_get("document_number")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            result: row
                .try_get("result")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            last_error: row
                .try_get("last_error")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            created_at: row
                .try_get("created_at")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
            updated_at: row
                .try_get("updated_at")
                .map_err(|e| DomainError::Persistence(e.to_string()))?,
        };
        Ok(intent)
    }
}

#[async_trait]
impl PosCheckoutRepository for PgPosCheckoutRepository {
    async fn insert_new(
        &self,
        intent: &PosCheckoutIntent,
    ) -> Result<InsertCheckoutOutcome, DomainError> {
        let inserted = sqlx::query(
            "INSERT INTO kudiba_core.pos_checkout_intents
                (id, tenant_id, idempotency_key, terminal_id, state, payload_hash, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
             RETURNING *",
        )
        .bind(intent.id)
        .bind(intent.tenant_id)
        .bind(&intent.idempotency_key)
        .bind(intent.terminal_id)
        .bind(intent.state.as_str())
        .bind(&intent.payload_hash)
        .bind(intent.created_at)
        .bind(intent.updated_at)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        match inserted {
            Some(_) => Ok(InsertCheckoutOutcome::Created),
            None => {
                let existing = self
                    .find_by_key(intent.tenant_id, &intent.idempotency_key)
                    .await?
                    .ok_or_else(|| {
                        DomainError::Persistence(
                            "intenção de checkout concorrente desapareceu".to_string(),
                        )
                    })?;
                Ok(InsertCheckoutOutcome::Existing(Box::new(existing)))
            }
        }
    }

    async fn find_by_key(
        &self,
        tenant_id: Uuid,
        idempotency_key: &str,
    ) -> Result<Option<PosCheckoutIntent>, DomainError> {
        let row = sqlx::query(
            "SELECT * FROM kudiba_core.pos_checkout_intents
             WHERE tenant_id = $1 AND idempotency_key = $2",
        )
        .bind(tenant_id)
        .bind(idempotency_key)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        match row {
            Some(row) => Ok(Some(Self::map_row(&row)?)),
            None => Ok(None),
        }
    }

    async fn find_print_job(
        &self,
        tenant_id: Uuid,
        print_job_id: &str,
    ) -> Result<Option<Value>, DomainError> {
        let row = sqlx::query(PRINT_JOB_QUERY)
            .bind(tenant_id)
            .bind(print_job_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))?;

        match row {
            Some(row) => {
                let payload: Value = row
                    .try_get("payload")
                    .map_err(|e| DomainError::Persistence(e.to_string()))?;
                map_print_job_payload(print_job_id, payload).map(Some)
            }
            None => Ok(None),
        }
    }

    async fn mark_fiscal_issued(
        &self,
        tenant_id: Uuid,
        checkout_id: Uuid,
        invoice_id: Uuid,
        document_number: &str,
        result: &Value,
        events: &[CheckoutOutboxEvent],
    ) -> Result<(), DomainError> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))?;

        sqlx::query(
            "UPDATE kudiba_core.pos_checkout_intents
             SET state = $1, invoice_id = $2, document_number = $3, result = $4,
                 last_error = NULL, updated_at = NOW()
             WHERE id = $5 AND tenant_id = $6 AND state = $7",
        )
        .bind(CheckoutState::FiscalIssued.as_str())
        .bind(invoice_id)
        .bind(document_number)
        .bind(result)
        .bind(checkout_id)
        .bind(tenant_id)
        .bind(CheckoutState::FiscalPending.as_str())
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        for event in events {
            sqlx::query(
                "INSERT INTO kudiba_core.pos_checkout_events
                    (tenant_id, checkout_id, event_type, payload, idempotency_key)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (tenant_id, idempotency_key) DO NOTHING",
            )
            .bind(tenant_id)
            .bind(checkout_id)
            .bind(event.event_type.as_str())
            .bind(&event.payload)
            .bind(&event.idempotency_key)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))?;
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::Persistence(e.to_string()))
    }

    async fn mark_reconciling(
        &self,
        tenant_id: Uuid,
        checkout_id: Uuid,
        error: &str,
        result: &Value,
    ) -> Result<(), DomainError> {
        sqlx::query(
            "UPDATE kudiba_core.pos_checkout_intents
             SET state = $1, last_error = $2, result = $3, updated_at = NOW()
             WHERE id = $4 AND tenant_id = $5 AND state = $6",
        )
        .bind(CheckoutState::Reconciling.as_str())
        .bind(error)
        .bind(result)
        .bind(checkout_id)
        .bind(tenant_id)
        .bind(CheckoutState::FiscalPending.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        Ok(())
    }

    async fn reset_to_fiscal_pending(
        &self,
        tenant_id: Uuid,
        checkout_id: Uuid,
        retry_count: u32,
    ) -> Result<(), DomainError> {
        let result = json!({ "retryCount": retry_count });
        let updated = sqlx::query(
            "UPDATE kudiba_core.pos_checkout_intents
             SET state = $1, result = $2, last_error = NULL, updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4 AND state = $5",
        )
        .bind(CheckoutState::FiscalPending.as_str())
        .bind(&result)
        .bind(checkout_id)
        .bind(tenant_id)
        .bind(CheckoutState::Reconciling.as_str())
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        if updated.rows_affected() != 1 {
            return Err(DomainError::ConcurrencyConflict(
                "checkout não está mais em reconciliação; repita com a mesma chave".to_string(),
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consulta_de_print_job_e_escopada_por_tenant_e_tipo() {
        assert!(PRINT_JOB_QUERY.contains("SELECT payload FROM kudiba_core.pos_checkout_events"));
        assert!(PRINT_JOB_QUERY.contains("tenant_id = $1"));
        assert!(PRINT_JOB_QUERY.contains("idempotency_key = $2"));
        assert!(PRINT_JOB_QUERY.contains("event_type = 'PRINT_JOB'"));
    }

    #[test]
    fn mapeamento_devolve_o_envelope_gravado_sem_recalcular_assinatura() {
        let print_job_id = "pos-checkout:sale-1:print";
        let stored = json!({
            "printJobId": print_job_id,
            "tenantId": "a0000000-0000-0000-0000-000000000001",
            "jobClass": "FISCAL_ENVELOPE",
            "copyType": "ORIGINAL",
            "payloadHash": "hash-abc",
            "printAuthorization": "authorization-abc",
            "envelope": { "hash": "hash-abc", "totalAmount": "116.00" },
        });

        let mapped = map_print_job_payload(print_job_id, stored.clone()).unwrap();

        assert_eq!(mapped, stored);
        assert_eq!(mapped["printAuthorization"], "authorization-abc");
        assert_eq!(mapped["envelope"]["totalAmount"], "116.00");
    }

    #[test]
    fn mapeamento_rejeita_print_job_divergente() {
        let payload = json!({ "printJobId": "pos-checkout:outro:print" });
        assert!(map_print_job_payload("pos-checkout:sale-1:print", payload).is_err());
    }
}
