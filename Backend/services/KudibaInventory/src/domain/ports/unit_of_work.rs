use async_trait::async_trait;

use crate::domain::ports::db_session::{DbSession, RepositoryError};

#[async_trait]
pub trait UnitOfWork: DbSession {
    async fn commit(&mut self) -> Result<(), RepositoryError>;

    async fn rollback(&mut self) -> Result<(), RepositoryError>;
}

#[async_trait]
pub trait UnitOfWorkFactory: Send + Sync {
    async fn begin(&self) -> Result<Box<dyn UnitOfWork>, RepositoryError>;
}
