use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

use crate::domain::entities::pos_checkout::{CheckoutOutboxEvent, PosCheckoutIntent};
use crate::domain::error::DomainError;

#[derive(Debug)]
pub enum InsertCheckoutOutcome {
    Created,
    Existing(Box<PosCheckoutIntent>),
}

#[async_trait]
pub trait PosCheckoutRepository: Send + Sync {
    async fn insert_new(
        &self,
        intent: &PosCheckoutIntent,
    ) -> Result<InsertCheckoutOutcome, DomainError>;

    async fn find_by_key(
        &self,
        tenant_id: Uuid,
        idempotency_key: &str,
    ) -> Result<Option<PosCheckoutIntent>, DomainError>;

    async fn mark_fiscal_issued(
        &self,
        tenant_id: Uuid,
        checkout_id: Uuid,
        invoice_id: Uuid,
        document_number: &str,
        result: &Value,
        events: &[CheckoutOutboxEvent],
    ) -> Result<(), DomainError>;

    async fn mark_reconciling(
        &self,
        tenant_id: Uuid,
        checkout_id: Uuid,
        error: &str,
        result: &Value,
    ) -> Result<(), DomainError>;

    async fn reset_to_fiscal_pending(
        &self,
        tenant_id: Uuid,
        checkout_id: Uuid,
        retry_count: u32,
    ) -> Result<(), DomainError>;
}
