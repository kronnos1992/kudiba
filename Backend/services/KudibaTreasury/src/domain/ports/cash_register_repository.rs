use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::CashRegister;
use crate::domain::error::DomainError;

#[async_trait]
pub trait CashRegisterRepository: Send + Sync {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<CashRegister>, DomainError>;
    async fn find_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<CashRegister>, DomainError>;
    async fn list(&self, tenant_id: Uuid) -> Result<Vec<CashRegister>, DomainError>;
    async fn save(&self, register: &CashRegister) -> Result<(), DomainError>;
    async fn update(&self, register: &CashRegister) -> Result<(), DomainError>;
}
