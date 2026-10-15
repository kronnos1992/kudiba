use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::BankAccount;
use crate::domain::error::DomainError;

#[async_trait]
pub trait BankAccountRepository: Send + Sync {
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<BankAccount>, DomainError>;
    async fn find_by_iban(
        &self,
        tenant_id: Uuid,
        iban: &str,
    ) -> Result<Option<BankAccount>, DomainError>;
    async fn list(&self, tenant_id: Uuid) -> Result<Vec<BankAccount>, DomainError>;
    async fn save(&self, account: &BankAccount) -> Result<(), DomainError>;
    async fn update(&self, account: &BankAccount) -> Result<(), DomainError>;
    async fn adjust_balance(
        &self,
        tenant_id: Uuid,
        id: Uuid,
        delta: rust_decimal::Decimal,
    ) -> Result<rust_decimal::Decimal, DomainError>;
}
