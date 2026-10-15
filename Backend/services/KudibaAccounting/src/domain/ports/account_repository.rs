use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::Account;
use crate::domain::error::DomainError;

#[async_trait]
pub trait AccountRepository: Send + Sync {
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<Account>, DomainError>;
    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<Account>, DomainError>;
    async fn save(&self, account: &Account) -> Result<(), DomainError>;
    async fn save_batch(&self, accounts: &[Account]) -> Result<(), DomainError>;
}
