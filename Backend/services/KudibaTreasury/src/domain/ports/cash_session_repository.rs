use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::CashSession;
use crate::domain::error::DomainError;

#[async_trait]
pub trait CashSessionRepository: Send + Sync {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashSession>, DomainError>;
    async fn find_open_session_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
    ) -> Result<Option<CashSession>, DomainError>;
    async fn list_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
        limit: i64,
    ) -> Result<Vec<CashSession>, DomainError>;
    async fn count_open_by_pos_session(
        &self,
        tenant_id: Uuid,
        pos_session_id: Uuid,
    ) -> Result<i64, DomainError>;
    async fn save(&self, session: &CashSession) -> Result<(), DomainError>;
    async fn update(&self, session: &CashSession) -> Result<(), DomainError>;
}
