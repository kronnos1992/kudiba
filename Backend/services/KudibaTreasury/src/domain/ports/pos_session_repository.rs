use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::PosSession;
use crate::domain::error::DomainError;

#[async_trait]
pub trait PosSessionRepository: Send + Sync {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<PosSession>, DomainError>;
    async fn find_open_session_by_register(
        &self,
        tenant_id: Uuid,
        register_id: Uuid,
    ) -> Result<Option<PosSession>, DomainError>;
    async fn list_by_tenant(
        &self,
        tenant_id: Uuid,
        limit: i64,
    ) -> Result<Vec<PosSession>, DomainError>;
    async fn save(&self, session: &PosSession) -> Result<(), DomainError>;
    async fn update(&self, session: &PosSession) -> Result<(), DomainError>;
}
