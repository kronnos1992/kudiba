use std::sync::Arc;

use crate::application::dto::GetInvoiceQuery;
use crate::domain::entities::invoice::Invoice;
use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};
use crate::domain::ports::invoice_repository::InvoiceRepository;

/// Consulta de documentos fiscais por identificador interno ou número legal
pub struct GetInvoiceUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    invoice_repository: Arc<dyn InvoiceRepository>,
}

impl GetInvoiceUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        invoice_repository: Arc<dyn InvoiceRepository>,
    ) -> Self {
        Self {
            session_factory,
            invoice_repository,
        }
    }

    pub async fn execute(&self, query: GetInvoiceQuery) -> Result<Invoice, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        if let Some(invoice_id) = query.invoice_id {
            return self
                .invoice_repository
                .find_by_id(session.as_mut(), invoice_id)
                .await
                .map_err(persistence_error)?
                .ok_or(DomainError::InvoiceNotFound);
        }

        if let Some(document_number) = query.document_number.filter(|value| !value.is_empty()) {
            let tenant_id = query.tenant_id.ok_or_else(|| {
                DomainError::invalid(
                    "tenantId é obrigatório para procurar por número de documento.",
                )
            })?;

            return self
                .invoice_repository
                .find_by_document_number(session.as_mut(), tenant_id, &document_number)
                .await
                .map_err(persistence_error)?
                .ok_or(DomainError::InvoiceNotFound);
        }

        Err(DomainError::invalid(
            "Indique invoiceId ou documentNumber para consultar o documento fiscal.",
        ))
    }
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(message) => DomainError::ConcurrencyConflict(message),
        RepositoryError::Database(message) => DomainError::Persistence(message),
    }
}
