use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::fiscal_series::FiscalSeries;
use crate::domain::ports::db_session::{DbSession, RepositoryError};

/// Repositório da raiz de agregação de concorrência da série fiscal
#[async_trait]
pub trait FiscalSeriesRepository: Send + Sync {
    /// Obtém a série aplicando bloqueio pessimista (`SELECT ... FOR UPDATE`),
    /// serializando as emissões concorrentes da mesma série
    async fn get_and_lock(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_type: &str,
        series_code: &str,
        fiscal_year: i32,
    ) -> Result<Option<FiscalSeries>, RepositoryError>;

    /// Consulta a série sem lock (leitura)
    async fn get_by_code(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_type: &str,
        series_code: &str,
        fiscal_year: i32,
    ) -> Result<Option<FiscalSeries>, RepositoryError>;

    /// Cria uma nova série fiscal (primeira emissão da série)
    async fn create(
        &self,
        session: &mut dyn DbSession,
        series: &FiscalSeries,
    ) -> Result<(), RepositoryError>;

    /// Atualiza o ponteiro de sequência e o hash encadeado na mesma transação
    async fn update_sequence_and_hash(
        &self,
        session: &mut dyn DbSession,
        series_id: Uuid,
        new_sequence: i64,
        new_hash: &str,
    ) -> Result<(), RepositoryError>;
}
