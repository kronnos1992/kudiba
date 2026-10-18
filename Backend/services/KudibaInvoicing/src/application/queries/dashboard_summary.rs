//! Painel Executivo de Faturação — agregação server-side para o dashboard.
//!
//! Disponibiliza uma fotografia fiscal do exercício (totais, tendência mensal,
//! principais clientes, desdobramento de IVA e monitorização AGT) num único
//! pedido, evitando que o cliente tenha de paginar documentos para os somar.

use chrono::{DateTime, Datelike, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummaryQuery {
    pub tenant_id: Uuid,
    pub year: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardTotals {
    pub invoices_count: i64,
    pub credit_notes_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub stamp_duty_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount_due: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyPoint {
    pub month: i32,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_total: Decimal,
    pub invoices_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TopCustomer {
    pub customer_name: String,
    pub customer_nif: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub gross_total: Decimal,
    pub invoices_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxBucket {
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub taxable_base: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_amount: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgtMonitor {
    pub last_document_number: Option<String>,
    pub last_validation_chars: Option<String>,
    pub last_issued_at: Option<DateTime<Utc>>,
    pub documents_this_month: i64,
    pub current_month: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummaryResult {
    pub tenant_id: Uuid,
    pub year: i32,
    pub generated_at: DateTime<Utc>,
    pub totals: DashboardTotals,
    pub monthly_trend: Vec<MonthlyPoint>,
    pub top_customers: Vec<TopCustomer>,
    pub tax_breakdown: Vec<TaxBucket>,
    pub agt: AgtMonitor,
}

pub struct DashboardSummaryUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
}

impl DashboardSummaryUseCase {
    pub fn new(session_factory: Arc<dyn DbSessionFactory>) -> Self {
        Self { session_factory }
    }

    pub async fn execute(
        &self,
        query: DashboardSummaryQuery,
    ) -> Result<DashboardSummaryResult, DomainError> {
        let mut session = self
            .session_factory
            .open()
            .await
            .map_err(persistence_error)?;

        let totals_row = sqlx::query(
            "SELECT \
                COUNT(*) FILTER (WHERE document_type != 'NC') AS invoices_count, \
                COUNT(*) FILTER (WHERE document_type = 'NC') AS credit_notes_count, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -gross_total ELSE gross_total END), 0) AS gross_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -net_total ELSE net_total END), 0) AS net_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -tax_total ELSE tax_total END), 0) AS tax_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -withholding_total ELSE withholding_total END), 0) AS withholding_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -stamp_duty_total ELSE stamp_duty_total END), 0) AS stamp_duty_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -(gross_total + stamp_duty_total - withholding_total) ELSE (gross_total + stamp_duty_total - withholding_total) END), 0) AS amount_due \
             FROM kudiba_core.invoices \
             WHERE tenant_id = $1 AND EXTRACT(YEAR FROM issued_at)::INT = $2",
        )
        .bind(query.tenant_id)
        .bind(query.year)
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let totals = DashboardTotals {
            invoices_count: get_i64(&totals_row, "invoices_count")?,
            credit_notes_count: get_i64(&totals_row, "credit_notes_count")?,
            gross_total: get_decimal(&totals_row, "gross_total")?,
            net_total: get_decimal(&totals_row, "net_total")?,
            tax_total: get_decimal(&totals_row, "tax_total")?,
            withholding_total: get_decimal(&totals_row, "withholding_total")?,
            stamp_duty_total: get_decimal(&totals_row, "stamp_duty_total")?,
            amount_due: get_decimal(&totals_row, "amount_due")?,
        };

        let trend_rows = sqlx::query(
            "SELECT EXTRACT(MONTH FROM issued_at)::INT AS month, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -gross_total ELSE gross_total END), 0) AS gross_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -net_total ELSE net_total END), 0) AS net_total, \
                COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -tax_total ELSE tax_total END), 0) AS tax_total, \
                COUNT(*) FILTER (WHERE document_type != 'NC') AS invoices_count \
             FROM kudiba_core.invoices \
             WHERE tenant_id = $1 AND EXTRACT(YEAR FROM issued_at)::INT = $2 \
             GROUP BY 1 ORDER BY 1",
        )
        .bind(query.tenant_id)
        .bind(query.year)
        .fetch_all(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let monthly_trend = trend_rows
            .into_iter()
            .map(|row| {
                Ok(MonthlyPoint {
                    month: get_i32(&row, "month")?,
                    gross_total: get_decimal(&row, "gross_total")?,
                    net_total: get_decimal(&row, "net_total")?,
                    tax_total: get_decimal(&row, "tax_total")?,
                    invoices_count: get_i64(&row, "invoices_count")?,
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?;

        let customer_rows = sqlx::query(
            "SELECT customer_name, customer_nif, \
                COALESCE(SUM(gross_total), 0) AS gross_total, COUNT(*) AS invoices_count \
             FROM kudiba_core.invoices \
             WHERE tenant_id = $1 AND EXTRACT(YEAR FROM issued_at)::INT = $2 AND document_type != 'NC' \
             GROUP BY customer_name, customer_nif \
             ORDER BY gross_total DESC LIMIT 5",
        )
        .bind(query.tenant_id)
        .bind(query.year)
        .fetch_all(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let top_customers = customer_rows
            .into_iter()
            .map(|row| {
                Ok(TopCustomer {
                    customer_name: row
                        .try_get("customer_name")
                        .map_err(|e| DomainError::Persistence(e.to_string()))?,
                    customer_nif: row
                        .try_get("customer_nif")
                        .map_err(|e| DomainError::Persistence(e.to_string()))?,
                    gross_total: get_decimal(&row, "gross_total")?,
                    invoices_count: get_i64(&row, "invoices_count")?,
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?;

        // Desdobramento de IVA por taxa (base tributável e imposto), coerente com a Leitura X
        let tax_rows = sqlx::query(
            "SELECT l.tax_rate, \
                    COALESCE(SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                        (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount)), 0) AS taxable_base, \
                    COALESCE(SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                        (l.line_total - (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount))), 0) AS tax_amount \
             FROM kudiba_core.invoices i \
             JOIN kudiba_core.invoice_lines l ON l.invoice_id = i.id \
             WHERE i.tenant_id = $1 AND EXTRACT(YEAR FROM i.issued_at)::INT = $2 \
             GROUP BY l.tax_rate ORDER BY l.tax_rate DESC",
        )
        .bind(query.tenant_id)
        .bind(query.year)
        .fetch_all(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let tax_breakdown = tax_rows
            .into_iter()
            .map(|row| {
                Ok(TaxBucket {
                    tax_rate: get_decimal(&row, "tax_rate")?,
                    taxable_base: get_decimal(&row, "taxable_base")?,
                    tax_amount: get_decimal(&row, "tax_amount")?,
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?;

        let agt_row = sqlx::query(
            "SELECT document_number, validation_chars, issued_at \
             FROM kudiba_core.invoices \
             WHERE tenant_id = $1 \
             ORDER BY issued_at DESC, sequence_number DESC LIMIT 1",
        )
        .bind(query.tenant_id)
        .fetch_optional(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;

        let (last_document_number, last_validation_chars, last_issued_at) = match agt_row {
            Some(row) => (
                row.try_get("document_number").ok(),
                row.try_get("validation_chars").ok(),
                row.try_get::<DateTime<Utc>, _>("issued_at").ok(),
            ),
            None => (None, None, None),
        };

        let current_month: i32 = Utc::now().month() as i32;
        let this_month_row = sqlx::query(
            "SELECT COUNT(*) AS total FROM kudiba_core.invoices \
             WHERE tenant_id = $1 AND date_trunc('month', issued_at) = date_trunc('month', now())",
        )
        .bind(query.tenant_id)
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|e| DomainError::Persistence(e.to_string()))?;
        let documents_this_month = get_i64(&this_month_row, "total")?;

        Ok(DashboardSummaryResult {
            tenant_id: query.tenant_id,
            year: query.year,
            generated_at: Utc::now(),
            totals,
            monthly_trend,
            top_customers,
            tax_breakdown,
            agt: AgtMonitor {
                last_document_number,
                last_validation_chars,
                last_issued_at,
                documents_this_month,
                current_month,
            },
        })
    }
}

fn get_i64(row: &sqlx::postgres::PgRow, column: &str) -> Result<i64, DomainError> {
    row.try_get(column)
        .map_err(|e| DomainError::Persistence(e.to_string()))
}

fn get_i32(row: &sqlx::postgres::PgRow, column: &str) -> Result<i32, DomainError> {
    row.try_get(column)
        .map_err(|e| DomainError::Persistence(e.to_string()))
}

fn get_decimal(row: &sqlx::postgres::PgRow, column: &str) -> Result<Decimal, DomainError> {
    row.try_get(column)
        .map_err(|e| DomainError::Persistence(e.to_string()))
}

fn persistence_error(err: RepositoryError) -> DomainError {
    match err {
        RepositoryError::ConcurrencyConflict(msg) => DomainError::ConcurrencyConflict(msg),
        RepositoryError::Database(msg) => DomainError::Persistence(msg),
    }
}
