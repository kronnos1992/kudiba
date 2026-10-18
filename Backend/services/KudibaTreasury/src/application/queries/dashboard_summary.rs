//! Painel Executivo de Tesouraria — agregação server-side.
//!
//! Consolida liquidez bancária, créditos por liquidar (com envelhecimento),
//! recibos emitidos e estado do caixa num único pedido.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize)]
pub struct BankAccountSummary {
    pub id: Uuid,
    pub bank_name: String,
    pub account_number: String,
    pub iban: String,
    pub currency: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub current_balance: Decimal,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct LiquiditySummary {
    #[serde(with = "rust_decimal::serde::float")]
    pub total_balance_aoa: Decimal,
    pub total_accounts: i64,
    pub active_accounts: i64,
    pub accounts: Vec<BankAccountSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AgingBucket {
    pub bucket: String,
    pub count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReceivablesSummary {
    pub outstanding_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub outstanding_total: Decimal,
    pub settled_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub settled_total: Decimal,
    pub aging: Vec<AgingBucket>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ReceiptsSummary {
    pub total_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_amount: Decimal,
    pub month_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub month_amount: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct CashSummary {
    pub open_sessions: i64,
    pub total_registers: i64,
    pub active_registers: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TreasuryDashboardSummary {
    pub tenant_id: Uuid,
    pub generated_at: DateTime<Utc>,
    pub liquidity: LiquiditySummary,
    pub receivables: ReceivablesSummary,
    pub receipts: ReceiptsSummary,
    pub cash: CashSummary,
}

const AGING_ORDER: [&str; 4] = ["0-30", "31-60", "61-90", "90+"];

pub async fn fetch(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<TreasuryDashboardSummary, DomainError> {
    let liquidity = fetch_liquidity(pool, tenant_id).await?;
    let receivables = fetch_receivables(pool, tenant_id).await?;
    let receipts = fetch_receipts(pool, tenant_id).await?;
    let cash = fetch_cash(pool, tenant_id).await?;

    Ok(TreasuryDashboardSummary {
        tenant_id,
        generated_at: Utc::now(),
        liquidity,
        receivables,
        receipts,
        cash,
    })
}

async fn fetch_liquidity(pool: &PgPool, tenant_id: Uuid) -> Result<LiquiditySummary, DomainError> {
    let rows = sqlx::query(
        "SELECT id, bank_name, account_number, iban, currency::text AS currency, \
                current_balance, is_active \
         FROM kudiba_treasury.bank_accounts \
         WHERE tenant_id = $1 ORDER BY bank_name, account_number",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    let mut accounts = Vec::with_capacity(rows.len());
    let mut total_balance_aoa = Decimal::ZERO;
    let mut active_accounts = 0i64;

    for row in rows {
        let currency: String = row.try_get("currency").map_err(db_error)?;
        let current_balance: Decimal = row.try_get("current_balance").map_err(db_error)?;
        let is_active: bool = row.try_get("is_active").map_err(db_error)?;
        if is_active {
            active_accounts += 1;
        }
        if currency == "AOA" {
            total_balance_aoa += current_balance;
        }
        accounts.push(BankAccountSummary {
            id: row.try_get("id").map_err(db_error)?,
            bank_name: row.try_get("bank_name").map_err(db_error)?,
            account_number: row.try_get("account_number").map_err(db_error)?,
            iban: row.try_get("iban").map_err(db_error)?,
            currency,
            current_balance,
            is_active,
        });
    }

    let total_accounts = accounts.len() as i64;

    Ok(LiquiditySummary {
        total_balance_aoa,
        total_accounts,
        active_accounts,
        accounts,
    })
}

async fn fetch_receivables(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<ReceivablesSummary, DomainError> {
    let totals = sqlx::query(
        "SELECT \
            COUNT(*) FILTER (WHERE status = 'OUTSTANDING') AS outstanding_count, \
            COALESCE(SUM(gross_total) FILTER (WHERE status = 'OUTSTANDING'), 0) AS outstanding_total, \
            COUNT(*) FILTER (WHERE status = 'SETTLED') AS settled_count, \
            COALESCE(SUM(gross_total) FILTER (WHERE status = 'SETTLED'), 0) AS settled_total \
         FROM kudiba_treasury.invoice_receivables WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(db_error)?;

    let aging_rows = sqlx::query(
        "SELECT CASE \
            WHEN NOW() - created_at <= INTERVAL '30 days' THEN '0-30' \
            WHEN NOW() - created_at <= INTERVAL '60 days' THEN '31-60' \
            WHEN NOW() - created_at <= INTERVAL '90 days' THEN '61-90' \
            ELSE '90+' END AS bucket, \
            COUNT(*) AS count, \
            COALESCE(SUM(gross_total), 0) AS amount \
         FROM kudiba_treasury.invoice_receivables \
         WHERE tenant_id = $1 AND status = 'OUTSTANDING' \
         GROUP BY bucket",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    let mut by_bucket: HashMap<String, (i64, Decimal)> = HashMap::new();
    for row in aging_rows {
        let bucket: String = row.try_get("bucket").map_err(db_error)?;
        let count: i64 = row.try_get("count").map_err(db_error)?;
        let amount: Decimal = row.try_get("amount").map_err(db_error)?;
        by_bucket.insert(bucket, (count, amount));
    }

    let aging = AGING_ORDER
        .iter()
        .map(|bucket| {
            let (count, amount) = by_bucket
                .get(*bucket)
                .copied()
                .unwrap_or((0, Decimal::ZERO));
            AgingBucket {
                bucket: (*bucket).to_string(),
                count,
                amount,
            }
        })
        .collect();

    Ok(ReceivablesSummary {
        outstanding_count: totals.try_get("outstanding_count").map_err(db_error)?,
        outstanding_total: totals.try_get("outstanding_total").map_err(db_error)?,
        settled_count: totals.try_get("settled_count").map_err(db_error)?,
        settled_total: totals.try_get("settled_total").map_err(db_error)?,
        aging,
    })
}

async fn fetch_receipts(pool: &PgPool, tenant_id: Uuid) -> Result<ReceiptsSummary, DomainError> {
    let row = sqlx::query(
        "SELECT \
            COUNT(*) AS total_count, \
            COALESCE(SUM(total_amount), 0) AS total_amount, \
            COUNT(*) FILTER (WHERE date_trunc('month', issued_at) = date_trunc('month', now())) AS month_count, \
            COALESCE(SUM(total_amount) FILTER (WHERE date_trunc('month', issued_at) = date_trunc('month', now())), 0) AS month_amount \
         FROM kudiba_treasury.treasury_receipts WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(db_error)?;

    Ok(ReceiptsSummary {
        total_count: row.try_get("total_count").map_err(db_error)?,
        total_amount: row.try_get("total_amount").map_err(db_error)?,
        month_count: row.try_get("month_count").map_err(db_error)?,
        month_amount: row.try_get("month_amount").map_err(db_error)?,
    })
}

async fn fetch_cash(pool: &PgPool, tenant_id: Uuid) -> Result<CashSummary, DomainError> {
    let sessions = sqlx::query(
        "SELECT COUNT(*) FILTER (WHERE status = 'OPEN') AS open_sessions \
         FROM kudiba_treasury.cash_sessions WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(db_error)?;

    let registers = sqlx::query(
        "SELECT COUNT(*) AS total_registers, COUNT(*) FILTER (WHERE is_active) AS active_registers \
         FROM kudiba_treasury.cash_registers WHERE tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await
    .map_err(db_error)?;

    Ok(CashSummary {
        open_sessions: sessions.try_get("open_sessions").map_err(db_error)?,
        total_registers: registers.try_get("total_registers").map_err(db_error)?,
        active_registers: registers.try_get("active_registers").map_err(db_error)?,
    })
}

fn db_error(err: sqlx::Error) -> DomainError {
    DomainError::DatabaseError(err.to_string())
}
