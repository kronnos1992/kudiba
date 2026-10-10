use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::CreateFiscalSeriesCommand;
use crate::domain::entities::fiscal_series::FiscalSeries;
use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};
use crate::domain::ports::series_repository::FiscalSeriesRepository;
use crate::domain::value_objects::document_type::DocumentType;

/// Caso de uso de abertura de série fiscal.
///
/// Devolve a série existente (idempotente) ou cria a série na primeira emissão.
pub struct CreateFiscalSeriesUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    series_repository: Arc<dyn FiscalSeriesRepository>,
}

impl CreateFiscalSeriesUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        series_repository: Arc<dyn FiscalSeriesRepository>,
    ) -> Self {
        Self {
            session_factory,
            series_repository,
        }
    }

    pub async fn execute(&self, command: CreateFiscalSeriesCommand) -> Result<Uuid, DomainError> {
        DocumentType::parse(&command.document_type)?;
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        let existing = self
            .series_repository
            .get_by_code(
                session.as_mut(),
                command.tenant_id,
                &command.document_type,
                &command.series_code,
                command.fiscal_year,
            )
            .await
            .map_err(persistence_error)?;

        if let Some(series) = existing {
            return Ok(series.id);
        }

        let series = FiscalSeries::new(
            Uuid::new_v4(),
            command.tenant_id,
            &command.document_type,
            &command.series_code,
            command.fiscal_year,
        );

        self.series_repository
            .create(session.as_mut(), &series)
            .await
            .map_err(persistence_error)?;

        tracing::info!(
            document_type = %series.document_type,
            series_code = %series.series_code,
            fiscal_year = series.fiscal_year,
            "Série fiscal criada"
        );

        Ok(series.id)
    }
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(message) => DomainError::ConcurrencyConflict(message),
        RepositoryError::Database(message) => DomainError::Persistence(message),
    }
}
