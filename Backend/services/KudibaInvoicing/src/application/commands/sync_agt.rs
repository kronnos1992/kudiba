use std::sync::Arc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::invoice_repository::InvoiceRepository;
use crate::domain::ports::tenant_repository::TenantRepository;
use crate::infrastructure::agt::{AgtClient, AgtSubmissionResult};

/// Comando para disparar sincronização/despacho de facturas para a AGT
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncAgtCommand {
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    #[serde(default)]
    pub fiscal_month: Option<u32>,
}

/// Caso de Uso: Despacho de lote de documentos fiscais para a plataforma AGT
pub struct SyncAgtUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    tenant_repository: Arc<dyn TenantRepository>,
    invoice_repository: Arc<dyn InvoiceRepository>,
    agt_client: Arc<AgtClient>,
}

impl SyncAgtUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        tenant_repository: Arc<dyn TenantRepository>,
        invoice_repository: Arc<dyn InvoiceRepository>,
        agt_client: Arc<AgtClient>,
    ) -> Self {
        Self {
            session_factory,
            tenant_repository,
            invoice_repository,
            agt_client,
        }
    }

    pub async fn execute(&self, command: SyncAgtCommand) -> Result<AgtSubmissionResult, DomainError> {
        let mut session = self.session_factory.open().await?;

        // 1. Obter os dados da organização (Tenant)
        let tenant = self
            .tenant_repository
            .find_by_id(&mut *session, command.tenant_id)
            .await?
            .ok_or_else(|| {
                DomainError::invalid(format!("Organização '{}' não encontrada.", command.tenant_id))
            })?;

        // 2. Obter as facturas a submeter
        let invoices = self
            .invoice_repository
            .find_by_period(
                &mut *session,
                command.tenant_id,
                command.fiscal_year,
                command.fiscal_month,
            )
            .await?;

        // 3. Submeter à AGT via conector
        self.agt_client
            .submit_invoice_batch(&tenant, &invoices)
            .await
            .map_err(|err| DomainError::invalid(format!("Falha na sincronização com a AGT: {err}")))
    }
}
