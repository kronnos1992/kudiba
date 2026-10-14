use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::CashMovement;
use crate::domain::error::DomainError;

#[async_trait]
pub trait CashMovementRepository: Send + Sync {
    async fn save(&self, movement: &CashMovement) -> Result<(), DomainError>;
    async fn list_by_session(
        &self,
        tenant_id: Uuid,
        session_id: Uuid,
    ) -> Result<Vec<CashMovement>, DomainError>;
}
