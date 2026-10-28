use std::sync::Arc;

use chrono::NaiveDate;
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
    pub from_date: Option<NaiveDate>,
    pub to_date: Option<NaiveDate>,
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
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
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

        let (period_start, period_end) = match (query.from_date, query.to_date) {
            (Some(start), Some(end)) if start <= end => (start, end),
            (Some(_), Some(_)) => {
                return Err(DomainError::invalid(
                    "A data de início não pode ser posterior à data de fim.",
                ));
            }
            (Some(date), None) | (None, Some(date)) => (date, date),
            (None, None) => {
                let month = query.fiscal_month.unwrap_or(1);
                let start = NaiveDate::from_ymd_opt(query.fiscal_year, month, 1)
                    .ok_or_else(|| DomainError::invalid("Período fiscal inválido."))?;
                let next_month = if month == 12 {
                    NaiveDate::from_ymd_opt(query.fiscal_year + 1, 1, 1)
                } else {
                    NaiveDate::from_ymd_opt(query.fiscal_year, month + 1, 1)
                }
                .ok_or_else(|| DomainError::invalid("Período fiscal inválido."))?;
                if query.fiscal_month.is_some() {
                    (start, next_month.pred_opt().unwrap_or(start))
                } else {
                    (
                        NaiveDate::from_ymd_opt(query.fiscal_year, 1, 1).unwrap_or(start),
                        NaiveDate::from_ymd_opt(query.fiscal_year, 12, 31).unwrap_or(start),
                    )
                }
            }
        };

        let mut session = self.session_factory.open().await?;
        let vat_rows = sqlx::query(
            "SELECT l.tax_rate, \
             SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                 (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount)) AS taxable_base, \
             SUM(CASE WHEN i.document_type = 'NC' THEN -1 ELSE 1 END * \
                 (l.line_total - (ROUND(l.quantity * l.unit_price, 2) - l.discount_amount))) AS tax_amount \
             FROM kudiba_core.invoices i \
             JOIN kudiba_core.invoice_lines l ON l.invoice_id = i.id \
             WHERE i.tenant_id = $1 AND i.issued_at >= $2::date \
               AND i.issued_at < ($3::date + INTERVAL '1 day') \
             GROUP BY l.tax_rate ORDER BY l.tax_rate",
        )
        .bind(query.tenant_id)
        .bind(period_start)
        .bind(period_end)
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
             WHERE tenant_id = $1 AND issued_at >= $2::date \
               AND issued_at < ($3::date + INTERVAL '1 day')",
        )
        .bind(query.tenant_id)
        .bind(period_start)
        .bind(period_end)
        .fetch_one(&mut *session.connection())
        .await
        .map_err(|err| DomainError::Persistence(err.to_string()))?;

        Ok(FiscalReportResult {
            tenant_id: query.tenant_id,
            fiscal_year: query.fiscal_year,
            fiscal_month: query.fiscal_month,
            period_start,
            period_end,
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
