use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::InvoiceReceivable;
use crate::domain::error::DomainError;

#[async_trait]
pub trait InvoiceReceivableRepository: Send + Sync {
    async fn upsert(&self, receivable: &InvoiceReceivable) -> Result<(), DomainError>;
    async fn list(
        &self,
        tenant_id: Uuid,
        limit: i64,
    ) -> Result<Vec<InvoiceReceivable>, DomainError>;
}
