use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{ValidateSeriesSequenceQuery, ValidateSeriesSequenceResult};
use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};
use crate::domain::ports::series_repository::FiscalSeriesRepository;

/// Caso de uso de validação da consistência sequencial de uma série fiscal.
///
/// Detecta lacunas (*gaps*) na numeração fiscal, condição de suspensão legal da
/// série perante a AGT.
pub struct ValidateSeriesSequenceUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    series_repository: Arc<dyn FiscalSeriesRepository>,
}

impl ValidateSeriesSequenceUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        series_repository: Arc<dyn FiscalSeriesRepository>,
    ) -> Self {
        Self {
            session_factory,
            series_repository,
        }
    }

    pub async fn execute(
        &self,
        query: ValidateSeriesSequenceQuery,
    ) -> Result<ValidateSeriesSequenceResult, DomainError> {
        let tenant_id = match Uuid::parse_str(query.tenant_id.trim()) {
            Ok(tenant_id) => tenant_id,
            Err(_) => {
                return Ok(ValidateSeriesSequenceResult {
                    is_valid: false,
                    last_recorded_sequence: 0,
                    last_document_hash: String::new(),
                    is_gap_detected: true,
                });
            }
        };

        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        let series = self
            .series_repository
            .get_by_code(
                session.as_mut(),
                tenant_id,
                &query.document_type,
                &query.series_code,
                query.document_year,
            )
            .await
            .map_err(persistence_error)?;

        match series {
            // Série ainda inexistente: somente a sequência 1 é válida
            None => {
                let is_first = query.expected_sequence == 1;
                Ok(ValidateSeriesSequenceResult {
                    is_valid: is_first,
                    last_recorded_sequence: 0,
                    last_document_hash: String::new(),
                    is_gap_detected: !is_first,
                })
            }
            Some(series) => {
                let expected = series.next_sequence();
                Ok(ValidateSeriesSequenceResult {
                    is_valid: query.expected_sequence == expected,
                    last_recorded_sequence: series.current_sequence,
                    last_document_hash: series.last_hash,
                    is_gap_detected: query.expected_sequence > expected,
                })
            }
        }
    }
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(message) => DomainError::ConcurrencyConflict(message),
        RepositoryError::Database(message) => DomainError::Persistence(message),
    }
}
