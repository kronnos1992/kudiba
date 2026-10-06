use async_trait::async_trait;
use sqlx::postgres::PgRow;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::entities::invoice::Invoice;
use crate::domain::entities::invoice_line::InvoiceLine;
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::invoice_repository::InvoiceRepository;

const SELECT_INVOICE_BY_ID: &str =
    "SELECT id, tenant_id, series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at \
     FROM kudiba_core.invoices WHERE id = $1";

const SELECT_INVOICE_BY_DOCUMENT: &str =
    "SELECT id, tenant_id, series_id, document_number, sequence_number, document_type, \
     customer_name, customer_nif, currency, net_total, tax_total, gross_total, hash_sha256, \
     signature_rsa_base64, validation_chars, key_version, is_contingency, tax_regime_code, \
     issued_at, system_entry_date, created_at \
     FROM kudiba_core.invoices WHERE tenant_id = $1 AND document_number = $2";

const SELECT_INVOICE_LINES: &str =
    "SELECT id, invoice_id, line_number, product_code, description, \
    quantity, unit_price, tax_rate, tax_exemption_code, line_total \
    FROM kudiba_core.invoice_lines WHERE invoice_id = $1 ORDER BY line_number ASC";

/// Repositório PostgreSQL de documentos fiscais e das respetivas linhas
#[derive(Debug, Default, Clone, Copy)]
pub struct PgInvoiceRepository;

impl PgInvoiceRepository {
    pub const fn new() -> Self {
        Self
    }

    fn map_line(row: &PgRow) -> Result<InvoiceLine, RepositoryError> {
        Ok(InvoiceLine::restore(
            row.try_get("id")?,
            row.try_get("invoice_id")?,
            row.try_get("line_number")?,
            row.try_get("product_code")?,
            row.try_get("description")?,
            row.try_get("quantity")?,
            row.try_get("unit_price")?,
            row.try_get("tax_rate")?,
            row.try_get("tax_exemption_code")?,
            row.try_get("line_total")?,
        ))
    }

    fn map_invoice(row: &PgRow, lines: Vec<InvoiceLine>) -> Result<Invoice, RepositoryError> {
        let invoice = Invoice {
            id: row.try_get("id")?,
            tenant_id: row.try_get("tenant_id")?,
            series_id: row.try_get("series_id")?,
            document_number: row.try_get("document_number")?,
            sequence_number: row.try_get("sequence_number")?,
            document_type: row.try_get("document_type")?,
            customer_name: row.try_get("customer_name")?,
            customer_nif: row.try_get("customer_nif")?,
            currency: row.try_get("currency")?,
            net_total: row.try_get("net_total")?,
            tax_total: row.try_get("tax_total")?,
            gross_total: row.try_get("gross_total")?,
            hash_sha256: row.try_get("hash_sha256")?,
            signature_rsa_base64: row.try_get("signature_rsa_base64")?,
            validation_chars: row.try_get("validation_chars")?,
            key_version: row.try_get("key_version")?,
            is_contingency: row.try_get("is_contingency")?,
            tax_regime_code: row.try_get("tax_regime_code")?,
            issued_at: row.try_get("issued_at")?,
            system_entry_date: row.try_get("system_entry_date")?,
            created_at: row.try_get("created_at")?,
            lines,
        };

        // Invariantes do agregado: totais coerentes e linhas conformes ao regime
        invoice
            .verify_totals()
            .map_err(|err| RepositoryError::Database(err.to_string()))?;

        Ok(invoice)
    }

    async fn load_lines(
        session: &mut dyn DbSession,
        invoice_id: Uuid,
    ) -> Result<Vec<InvoiceLine>, RepositoryError> {
        let rows = sqlx::query(SELECT_INVOICE_LINES)
            .bind(invoice_id)
            .fetch_all(&mut *session.connection())
            .await?;

        rows.iter().map(Self::map_line).collect()
    }
}

#[async_trait]
impl InvoiceRepository for PgInvoiceRepository {
    async fn save(
        &self,
        session: &mut dyn DbSession,
        invoice: &Invoice,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            "INSERT INTO kudiba_core.invoices (id, tenant_id, series_id, document_number, \
             sequence_number, document_type, customer_name, customer_nif, currency, net_total, \
             tax_total, gross_total, hash_sha256, signature_rsa_base64, validation_chars, \
             key_version, is_contingency, tax_regime_code, issued_at, system_entry_date, \
             created_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, \
             $18, $19, $20, $21)",
        )
        .bind(invoice.id)
        .bind(invoice.tenant_id)
        .bind(invoice.series_id)
        .bind(&invoice.document_number)
        .bind(invoice.sequence_number)
        .bind(&invoice.document_type)
        .bind(&invoice.customer_name)
        .bind(&invoice.customer_nif)
        .bind(&invoice.currency)
        .bind(invoice.net_total)
        .bind(invoice.tax_total)
        .bind(invoice.gross_total)
        .bind(&invoice.hash_sha256)
        .bind(&invoice.signature_rsa_base64)
        .bind(&invoice.validation_chars)
        .bind(&invoice.key_version)
        .bind(invoice.is_contingency)
        .bind(&invoice.tax_regime_code)
        .bind(invoice.issued_at)
        .bind(invoice.system_entry_date)
        .bind(invoice.created_at)
        .execute(&mut *session.connection())
        .await?;

        for line in &invoice.lines {
            sqlx::query(
                "INSERT INTO kudiba_core.invoice_lines (id, invoice_id, line_number, product_code, \
                 description, quantity, unit_price, tax_rate, tax_exemption_code, line_total) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            )
            .bind(line.id)
            .bind(line.invoice_id)
            .bind(line.line_number)
            .bind(&line.product_code)
            .bind(&line.description)
            .bind(line.quantity)
            .bind(line.unit_price)
            .bind(line.tax_rate)
            .bind(&line.tax_exemption_code)
            .bind(line.line_total)
            .execute(&mut *session.connection())
            .await?;
        }

        Ok(())
    }

    async fn find_by_id(
        &self,
        session: &mut dyn DbSession,
        id: Uuid,
    ) -> Result<Option<Invoice>, RepositoryError> {
        let row = sqlx::query(SELECT_INVOICE_BY_ID)
            .bind(id)
            .fetch_optional(&mut *session.connection())
            .await?;

        match row {
            Some(row) => {
                let lines = Self::load_lines(session, id).await?;
                Self::map_invoice(&row, lines).map(Some)
            }
            None => Ok(None),
        }
    }

    async fn find_by_document_number(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        document_number: &str,
    ) -> Result<Option<Invoice>, RepositoryError> {
        let row = sqlx::query(SELECT_INVOICE_BY_DOCUMENT)
            .bind(tenant_id)
            .bind(document_number)
            .fetch_optional(&mut *session.connection())
            .await?;

        match row {
            Some(row) => {
                let invoice_id: Uuid = row.try_get("id")?;
                let lines = Self::load_lines(session, invoice_id).await?;
                Self::map_invoice(&row, lines).map(Some)
            }
            None => Ok(None),
        }
    }
}
