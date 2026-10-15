use async_trait::async_trait;
use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::domain::error::InventoryError;

#[async_trait]
pub trait InventoryEventPublisher: Send + Sync {
    async fn publish_stock_dispatch(
        &self,
        tenant_id: Uuid,
        document_number: &str,
        movement_date: NaiveDate,
        total_cmp_cost: Decimal,
    ) -> Result<(), InventoryError>;
}
