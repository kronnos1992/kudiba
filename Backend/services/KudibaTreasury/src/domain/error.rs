use thiserror::Error;

#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Registo não encontrado: {0}")]
    NotFound(String),

    #[error("Conflito de unicidade: {0}")]
    AlreadyExists(String),

    #[error("Validação de negócio inválida: {0}")]
    ValidationError(String),

    #[error("Estado de sessão inválido: {0}")]
    InvalidSessionState(String),

    #[error("Saldo insuficiente: {0}")]
    InsufficientFunds(String),

    #[error("Erro de persistência de dados: {0}")]
    DatabaseError(String),
}
