use async_trait::async_trait;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::domain::entities::InvoiceReceivable;
use crate::domain::error::DomainError;

#[async_trait]
pub trait InvoiceReceivableRepository: Send + Sync {
    async fn upsert(&self, receivable: &InvoiceReceivable) -> Result<(), DomainError>;
    async fn apply_payment(
        &self,
        tenant_id: Uuid,
        invoice_id: &str,
        payment_id: Uuid,
        amount: Decimal,
    ) -> Result<(), DomainError>;
    async fn list(
        &self,
        tenant_id: Uuid,
        limit: i64,
    ) -> Result<Vec<InvoiceReceivable>, DomainError>;
}
