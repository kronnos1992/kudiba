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

    /// Localiza a fatura apenas se pertencer ao tenant indicado
    async fn find_by_id_for_tenant(
        &self,
        session: &mut dyn DbSession,
        id: Uuid,
        tenant_id: Uuid,
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

    /// Localiza faturas por lotes paginados para permitir streaming em memória constante O(1)
    async fn find_by_period_paginated(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        fiscal_year: i32,
        fiscal_month: Option<u32>,
        offset: i64,
        limit: i64,
    ) -> Result<Vec<Invoice>, RepositoryError> {
        let all = self
            .find_by_period(session, tenant_id, fiscal_year, fiscal_month)
            .await?;
        let paginated = all
            .into_iter()
            .skip(offset as usize)
            .take(limit as usize)
            .collect();
        Ok(paginated)
    }

    /// Localiza se já existe uma Nota de Crédito (NC) que rectifique este documento de origem
    async fn find_credit_note_for_source(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        source_document_number: &str,
    ) -> Result<Option<Invoice>, RepositoryError>;
}
