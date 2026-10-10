use std::sync::Arc;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::invoice_repository::InvoiceRepository;
use crate::domain::ports::tenant_repository::TenantRepository;
use crate::infrastructure::saft::{SaftExportMetadata, SaftXmlGenerator};

/// Parâmetros de consulta para a exportação do ficheiro SAF-T (AO)
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSaftQuery {
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    #[serde(default)]
    pub fiscal_month: Option<u32>,
}

/// Resultado da exportação do ficheiro SAF-T (AO)
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSaftResult {
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    pub fiscal_month: Option<u32>,
    pub invoice_count: usize,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_gross: Decimal,
    pub xml_content: String,
    pub filename: String,
}

/// Caso de Uso: Geração e exportação do ficheiro SAF-T (AO) mensal
pub struct ExportSaftUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
    tenant_repository: Arc<dyn TenantRepository>,
    invoice_repository: Arc<dyn InvoiceRepository>,
    software_version: &'static str,
}

impl ExportSaftUseCase {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        tenant_repository: Arc<dyn TenantRepository>,
        invoice_repository: Arc<dyn InvoiceRepository>,
        software_version: &'static str,
    ) -> Self {
        Self {
            session_factory,
            tenant_repository,
            invoice_repository,
            software_version,
        }
    }

    pub async fn execute(&self, query: ExportSaftQuery) -> Result<ExportSaftResult, DomainError> {
        let mut session = self.session_factory.open().await?;

        // 1. Obter os dados da organização (Tenant)
        let tenant = self
            .tenant_repository
            .find_by_id(&mut *session, query.tenant_id)
            .await?
            .ok_or_else(|| {
                DomainError::invalid(format!("Organização (Tenant) '{}' não encontrada.", query.tenant_id))
            })?;

        // 2. Obter as facturas e linhas do período fiscal solicitado em lotes paginados (O(1) buffer)
        let mut invoices = Vec::new();
        let batch_size = 200i64;
        let mut offset = 0i64;
        loop {
            let chunk = self
                .invoice_repository
                .find_by_period_paginated(
                    &mut *session,
                    query.tenant_id,
                    query.fiscal_year,
                    query.fiscal_month,
                    offset,
                    batch_size,
                )
                .await?;
            let count = chunk.len();
            invoices.extend(chunk);
            if (count as i64) < batch_size {
                break;
            }
            offset += batch_size;
        }

        let total_gross: Decimal = invoices.iter().map(|inv| inv.gross_total).sum();
        let invoice_count = invoices.len();

        // 3. Montar os metadados e gerar o XML oficial através de stream
        let metadata = SaftExportMetadata {
            tenant: &tenant,
            fiscal_year: query.fiscal_year,
            fiscal_month: query.fiscal_month,
            software_version: self.software_version,
        };

        let mut xml_bytes = Vec::with_capacity(16 * 1024 + invoice_count * 1024);
        SaftXmlGenerator::write_xml_stream(&mut xml_bytes, &metadata, &invoices)?;
        let xml_content = String::from_utf8(xml_bytes).map_err(|e| DomainError::invalid(e.to_string()))?;

        crate::infrastructure::saft::SaftValidator::validate_xml(&xml_content)?;

        let filename = match query.fiscal_month {
            Some(m) => format!("SAFT_AO_{}_{}_{:02}.xml", tenant.nif, query.fiscal_year, m),
            None => format!("SAFT_AO_{}_{}_ANUAL.xml", tenant.nif, query.fiscal_year),
        };

        Ok(ExportSaftResult {
            tenant_id: query.tenant_id,
            fiscal_year: query.fiscal_year,
            fiscal_month: query.fiscal_month,
            invoice_count,
            total_gross,
            xml_content,
            filename,
        })
    }
}
