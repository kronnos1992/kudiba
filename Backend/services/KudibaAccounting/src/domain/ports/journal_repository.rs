use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::Journal;
use crate::domain::error::DomainError;

#[async_trait]
pub trait JournalRepository: Send + Sync {
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Journal>, DomainError>;
    async fn find_by_id(&self, tenant_id: Uuid, id: Uuid) -> Result<Option<Journal>, DomainError>;
    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<Journal>, DomainError>;
    async fn save(&self, journal: &Journal) -> Result<(), DomainError>;
    async fn next_entry_number(
        &self,
        tenant_id: Uuid,
        journal_code: &str,
        year: i32,
    ) -> Result<i64, DomainError>;
}
