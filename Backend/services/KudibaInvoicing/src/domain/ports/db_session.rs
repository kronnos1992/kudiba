use async_trait::async_trait;
use sqlx::PgConnection;
use thiserror::Error;

/// Falhas originadas na camada de persistência transacional
#[derive(Debug, Error)]
pub enum RepositoryError {
    #[error("Erro de persistência de base de dados: {0}")]
    Database(String),

    #[error("Conflito de concorrência na série fiscal: {0}")]
    ConcurrencyConflict(String),
}

impl From<sqlx::Error> for RepositoryError {
    fn from(err: sqlx::Error) -> Self {
        match &err {
            sqlx::Error::RowNotFound => RepositoryError::Database("registo não encontrado".into()),
            sqlx::Error::Database(db) if db.code().as_deref() == Some("40001") => {
                RepositoryError::ConcurrencyConflict(db.message().to_string())
            }
            other => RepositoryError::Database(other.to_string()),
        }
    }
}

/// Sessão de base de dados (ligação ou transação activa) entregue ao domínio.
///
/// É o "executor" ambiente que garante que todos os comandos de SQL executados
/// dentro de um caso de uso participam da mesma transação ACID.
#[async_trait]
pub trait DbSession: Send {
    fn connection(&mut self) -> &mut PgConnection;
}

/// Fábrica de sessões de leitura (auto-commit) para a QUERY STACK do CQRS
#[async_trait]
pub trait DbSessionFactory: Send + Sync {
    async fn open(&self) -> Result<Box<dyn DbSession>, RepositoryError>;
}
