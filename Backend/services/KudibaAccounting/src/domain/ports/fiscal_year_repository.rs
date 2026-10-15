use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::FiscalYear;
use crate::domain::error::DomainError;

#[async_trait]
pub trait FiscalYearRepository: Send + Sync {
    async fn find_by_year(
        &self,
        tenant_id: Uuid,
        year: i32,
    ) -> Result<Option<FiscalYear>, DomainError>;
    async fn find_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<FiscalYear>, DomainError>;
    async fn list_all(&self, tenant_id: Uuid) -> Result<Vec<FiscalYear>, DomainError>;
    async fn save(&self, fiscal_year: &FiscalYear) -> Result<(), DomainError>;
    async fn update(&self, fiscal_year: &FiscalYear) -> Result<(), DomainError>;
}
