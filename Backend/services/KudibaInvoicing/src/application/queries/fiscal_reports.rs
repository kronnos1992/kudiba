use std::sync::Arc;

use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::error::DomainError;
use crate::domain::ports::db_session::DbSessionFactory;

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FiscalReportQuery {
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    pub fiscal_month: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VatReportLine {
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_rate: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub taxable_base: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax_amount: Decimal,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FiscalReportResult {
    pub tenant_id: Uuid,
    pub fiscal_year: i32,
    pub fiscal_month: Option<u32>,
    pub vat: Vec<VatReportLine>,
    #[serde(with = "rust_decimal::serde::float")]
    pub withholding_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub stamp_duty_total: Decimal,
}

pub struct FiscalReportsUseCase {
    session_factory: Arc<dyn DbSessionFactory>,
}

impl FiscalReportsUseCase {
    pub fn new(session_factory: Arc<dyn DbSessionFactory>) -> Self {
        Self { session_factory }
    }

    pub async fn execute(
        &self,
        query: FiscalReportQuery,
    ) -> Result<FiscalReportResult, DomainError> {
        if !(2000..=9999).contains(&query.fiscal_year) {
            return Err(DomainError::invalid("Ano fiscal inválido."));
        }
        if query
            .fiscal_month
            .is_some_and(|month| !(1..=12).contains(&month))
        {
            return Err(DomainError::invalid("Mês fiscal deve estar entre 1 e 12."));
        }

        let mut session = self.session_factory.open().await?;
        let vat_rows = sqlx::query(
            "SELECT l.tax_rate, \
             SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                 (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount)) AS taxable_base, \
             SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                 (l.line_total - (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount))) AS tax_amount \
             FROM kudiba_core.invoices i \
             JOIN kudiba_core.invoice_lines l ON l.invoice_id = i.id \
             WHERE i.tenant_id = $1 AND EXTRACT(YEAR FROM i.issued_at)::INT = $2 \
               AND ($3::INT IS NULL OR EXTRACT(MONTH FROM i.issued_at)::INT = $3) \
             GROUP BY l.tax_rate ORDER BY l.tax_rate",
        )
        .bind(query.tenant_id)
        .bind(query.fiscal_year)
        .bind(query.fiscal_month.map(|month| month as i32))
        .fetch_all(&mut *session.connection())
        .await
        .map_err(|err| DomainError::Persistence(err.to_string()))?;

        let vat = vat_rows
            .iter()
            .map(|row| {
                Ok(VatReportLine {
                    tax_rate: row
                        .try_get("tax_rate")
                        .map_err(|err| DomainError::Persistence(err.to_string()))?,
                    taxable_base: row
                        .try_get("taxable_base")
                        .map_err(|err| DomainError::Persistence(err.to_string()))?,
                    tax_amount: row
                        .try_get("tax_amount")
                        .map_err(|err| DomainError::Persistence(err.to_string()))?,
                })
            })
            .collect::<Result<Vec<_>, DomainError>>()?;

        let totals = sqlx::query(
            "SELECT COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -withholding_total ELSE withholding_total END), 0) AS withholding_total, \
             COALESCE(SUM(CASE WHEN document_type = 'NC' THEN -stamp_duty_total ELSE stamp_duty_total END), 0) AS stamp_duty_total \
             FROM kudiba_core.invoices \
             WHERE tenant_id = $1 AND EXTRACT(YEAR FROM issued_at)::INT = $2 \
               AND ($3::INT IS NULL OR EXTRACT(MONTH FROM issued_at)::INT = $3)",
        )
        .bind(query.tenant_id)
        .bind(query.fiscal_year)
        .bind(query.fiscal_month.map(|month| month as i32))
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|err| DomainError::Persistence(err.to_string()))?;

        Ok(FiscalReportResult {
            tenant_id: query.tenant_id,
            fiscal_year: query.fiscal_year,
            fiscal_month: query.fiscal_month,
            vat,
            withholding_total: totals
                .try_get("withholding_total")
                .map_err(|err| DomainError::Persistence(err.to_string()))?,
            stamp_duty_total: totals
                .try_get("stamp_duty_total")
                .map_err(|err| DomainError::Persistence(err.to_string()))?,
        })
    }
}
