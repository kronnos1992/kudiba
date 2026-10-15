use async_trait::async_trait;

use crate::domain::entities::TreasuryReceipt;
use crate::domain::error::DomainError;

#[async_trait]
pub trait TreasuryEventPublisher: Send + Sync {
    async fn publish_receipt_issued(&self, receipt: &TreasuryReceipt) -> Result<(), DomainError>;
}
