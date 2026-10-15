use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq)]
pub enum DomainError {
    #[error("Validação falhou: {0}")]
    ValidationError(String),

    #[error("Recurso não encontrado: {0}")]
    NotFound(String),

    #[error("Conflito de unicidade: {0}")]
    Conflict(String),

    #[error("Exercício fiscal inválido ou fechado: {0}")]
    InvalidFiscalYear(String),

    #[error("Partidas dobradas desequilibradas: Débitos ({0}) != Créditos ({1})")]
    UnbalancedEntry(rust_decimal::Decimal, rust_decimal::Decimal),

    #[error("Linha de lançamento inválida: {0}")]
    InvalidLine(String),

    #[error("Conta sintética/agregadora não admite lançamentos directos: {0}")]
    NonAnalyticalAccount(String),

    #[error("Erro de persistência de base de dados: {0}")]
    DatabaseError(String),
}
