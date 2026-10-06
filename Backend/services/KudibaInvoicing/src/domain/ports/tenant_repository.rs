use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::tenant::Tenant;
use crate::domain::ports::db_session::{DbSession, RepositoryError};

/// Repositório de organizações e dados fiscais do sujeito passivo
#[async_trait]
pub trait TenantRepository: Send + Sync {
    /// Localiza o tenant pelo seu UUID
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        id: Uuid,
    ) -> Result<Option<Tenant>, RepositoryError>;

    /// Localiza o tenant pelo slug de subdomínio
    #[allow(dead_code)]
    async fn find_by_slug(
        &self,
        session: &mut dyn DbSession,
        slug: &str,
    ) -> Result<Option<Tenant>, RepositoryError>;
}
