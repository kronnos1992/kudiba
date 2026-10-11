use rust_decimal::Decimal;
use thiserror::Error;
use uuid::Uuid;

use crate::domain::ports::db_session::RepositoryError;

#[derive(Debug, Error, PartialEq)]
pub enum InventoryError {
    #[error("NIF ou identificador fiscal inválido: {0}")]
    InvalidTaxId(String),

    #[error(
        "Artigo intangível/serviço ({0}) não permite controlo ou movimentação física de stock"
    )]
    IntangibleCannotMoveStock(String),

    #[error("Artigo intangível/serviço ({0}) não pode constar em Guias de Transporte ou Remessa (GT/GR)")]
    IntangibleCannotHaveCargoDocument(String),

    #[error("Stock insuficiente para o artigo {product_id}. Disponível: {available}, Solicitado: {requested}")]
    InsufficientStock {
        product_id: Uuid,
        available: Decimal,
        requested: Decimal,
    },

    #[error("Artigo com identificador {0} não encontrado")]
    ProductNotFound(Uuid),

    #[error("Artigo com código '{0}' não encontrado")]
    ProductCodeNotFound(String),

    #[error("Artigo com código '{0}' já existe")]
    DuplicateProductCode(String),

    #[error("Entidade com identificador fiscal '{0}' já cadastrada")]
    DuplicateTaxId(String),

    #[error("Entidade comercial com identificador {0} não encontrada")]
    EntityNotFound(Uuid),

    #[error("Armazém com identificador {0} não encontrado")]
    WarehouseNotFound(Uuid),

    #[error("Armazém com código '{0}' já existe")]
    DuplicateWarehouseCode(String),

    #[error("Lote com identificador {0} não encontrado")]
    BatchNotFound(Uuid),

    #[error("Lote '{0}' já existe para este artigo")]
    DuplicateBatchNumber(String),

    #[error("O lote '{0}' está expirado")]
    BatchExpired(String),

    #[error("O artigo '{0}' exige controlo de lotes")]
    BatchRequired(String),

    #[error("O artigo '{0}' não possui controlo de lotes")]
    BatchNotAllowed(String),

    #[error("Quantidade inválida: {0}")]
    InvalidQuantity(String),

    #[error("Preço ou custo inválido: {0}")]
    InvalidPrice(String),

    #[error("Erro de persistência de dados: {0}")]
    DatabaseError(String),

    #[error("Parâmetro inválido: {0}")]
    ValidationError(String),
}

impl From<RepositoryError> for InventoryError {
    fn from(err: RepositoryError) -> Self {
        InventoryError::DatabaseError(err.to_string())
    }
}
