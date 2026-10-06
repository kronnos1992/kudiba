use thiserror::Error;

/// Erros de domínio independentes de infraestrutura (traduzidos em HTTP/gRPC na camada de apresentação)
#[derive(Debug, Error)]
pub enum DomainError {
    /// Regra de negócio violada ou payload inválido (HTTP 400 / gRPC INVALID_ARGUMENT)
    #[error("{0}")]
    InvalidArgument(String),

    /// Documento fiscal inexistente (HTTP 404)
    #[error("Fatura não encontrada.")]
    InvoiceNotFound,

    /// Falha criptográfica na assinatura ou verificação RSA
    #[error("Falha criptográfica: {0}")]
    Crypto(String),

    /// Falha na camada de persistência transacional (PostgreSQL)
    #[error("Falha de persistência fiscal: {0}")]
    Persistence(String),

    /// Conflito de concorrência na raiz de agregação da série fiscal
    #[error("Conflito de concorrência na série fiscal: {0}")]
    ConcurrencyConflict(String),
}

impl DomainError {
    pub fn invalid(message: impl Into<String>) -> Self {
        DomainError::InvalidArgument(message.into())
    }
}

impl From<crate::domain::ports::db_session::RepositoryError> for DomainError {
    fn from(err: crate::domain::ports::db_session::RepositoryError) -> Self {
        DomainError::Persistence(err.to_string())
    }
}

