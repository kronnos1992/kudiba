use async_trait::async_trait;

use crate::domain::ports::db_session::{DbSession, RepositoryError};

/// Unidade de Trabalho (Unit of Work) — delimita a fronteira transacional ACID
/// de um comando. Todos os repositórios acessados através desta sessão
/// participam da mesma transação, com commit ou rollback atómico.
#[async_trait]
pub trait UnitOfWork: DbSession {
    /// Confirma e persiste atomicamente todas as alterações da transação
    async fn commit(&mut self) -> Result<(), RepositoryError>;

    /// Reverte todas as alterações da transação
    async fn rollback(&mut self) -> Result<(), RepositoryError>;
}

/// Fábrica de Unidades de Trabalho (adaptador SQLx)
#[async_trait]
pub trait UnitOfWorkFactory: Send + Sync {
    async fn begin(&self) -> Result<Box<dyn UnitOfWork>, RepositoryError>;
}
