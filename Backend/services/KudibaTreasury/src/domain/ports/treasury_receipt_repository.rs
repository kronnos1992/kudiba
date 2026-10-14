use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::TreasuryReceipt;
use crate::domain::error::DomainError;

#[async_trait]
pub trait TreasuryReceiptRepository: Send + Sync {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<TreasuryReceipt>, DomainError>;
    async fn find_by_number(
        &self,
        tenant_id: Uuid,
        number: &str,
    ) -> Result<Option<TreasuryReceipt>, DomainError>;
    async fn list(
        &self,
        tenant_id: Uuid,
        customer_id: Option<&str>,
        limit: i64,
    ) -> Result<Vec<TreasuryReceipt>, DomainError>;
    async fn next_receipt_number(&self, tenant_id: Uuid, year: i32) -> Result<String, DomainError>;
    async fn save(&self, receipt: &TreasuryReceipt) -> Result<(), DomainError>;
}
