use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::invoice::Invoice;
use crate::domain::ports::db_session::{DbSession, RepositoryError};

/// Repositório de documentos fiscais (escrita e leitura)
#[async_trait]
pub trait InvoiceRepository: Send + Sync {
    /// Grava o cabeçalho da fatura e todas as suas linhas dentro da transação activa
    async fn save(
        &self,
        session: &mut dyn DbSession,
        invoice: &Invoice,
    ) -> Result<(), RepositoryError>;

    /// Localiza a fatura pelo identificador interno
    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        id: Uuid,
    ) -> Result<Option<Invoice>, RepositoryError>;

    /// Localiza a fatura pelo tenant e número de documento legal
    async fn find_by_document_number(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_number: &str,
    ) -> Result<Option<Invoice>, RepositoryError>;

    /// Localiza todas as faturas de um tenant num dado período fiscal (ano ou mês) para o SAF-T (AO)
    async fn find_by_period(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        fiscal_year: i32,
        fiscal_month: Option<u32>,
    ) -> Result<Vec<Invoice>, RepositoryError>;
}
