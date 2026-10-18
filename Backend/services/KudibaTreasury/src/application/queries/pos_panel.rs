use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::domain::error::DomainError;

#[derive(Debug, Clone, Serialize)]
pub struct PosSessionSummary {
    pub id: Uuid,
    pub opened_by: String,
    pub opened_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CashSessionSummary {
    pub id: Uuid,
    pub operator_user_id: String,
    pub opened_at: DateTime<Utc>,
    #[serde(with = "rust_decimal::serde::float")]
    pub opening_balance: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct PosRegisterPanel {
    pub register_id: Uuid,
    pub register_code: String,
    pub register_name: String,
    pub is_active: bool,
    pub pos_session: Option<PosSessionSummary>,
    pub cash_session: Option<CashSessionSummary>,
    pub sales_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub sales_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub supplies_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub bleeds_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub expenses_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub expected_cash: Decimal,
    pub last_movement_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PosOperatorPanel {
    pub operator_user_id: String,
    pub sales_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub sales_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub supplies_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub bleeds_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub expenses_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub net_cash_total: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct PosPanelTotals {
    pub total_registers: i64,
    pub active_registers: i64,
    pub open_pos_sessions: i64,
    pub open_cash_sessions: i64,
    pub sales_count: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub sales_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub supplies_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub bleeds_total: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub expenses_total: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct PosPanelResponse {
    pub tenant_id: Uuid,
    pub date: NaiveDate,
    pub generated_at: DateTime<Utc>,
    pub totals: PosPanelTotals,
    pub registers: Vec<PosRegisterPanel>,
    pub operators: Vec<PosOperatorPanel>,
}

pub async fn fetch(
    pool: &PgPool,
    tenant_id: Uuid,
    register_id: Option<Uuid>,
    date: NaiveDate,
) -> Result<PosPanelResponse, DomainError> {
    let mut registers = fetch_registers(pool, tenant_id, register_id).await?;
    let aggregates = fetch_movement_aggregates(pool, tenant_id, date).await?;
    let operators = fetch_operator_aggregates(pool, tenant_id, date).await?;
    let cash_sessions = fetch_open_cash_sessions(pool, tenant_id).await?;
    let pos_sessions = fetch_open_pos_sessions(pool, tenant_id).await?;

    let total_registers = registers.len() as i64;
    let active_registers = registers.iter().filter(|r| r.is_active).count() as i64;
    let open_pos_sessions = pos_sessions.len() as i64;
    let open_cash_sessions = cash_sessions.len() as i64;

    for panel in registers.iter_mut() {
        if let Some(agg) = aggregates
            .iter()
            .find(|a| a.register_id == panel.register_id)
        {
            panel.sales_count = agg.sales_count;
            panel.sales_total = agg.sales_total;
            panel.supplies_total = agg.supplies_total;
            panel.bleeds_total = agg.bleeds_total;
            panel.expenses_total = agg.expenses_total;
            panel.last_movement_at = agg.last_movement_at;
        }

        if let Some(pos) = pos_sessions
            .iter()
            .find(|p| p.register_id == panel.register_id)
        {
            panel.pos_session = Some(PosSessionSummary {
                id: pos.id,
                opened_by: pos.opened_by.clone(),
                opened_at: pos.opened_at,
            });
        }

        if let Some(cash) = cash_sessions
            .iter()
            .find(|c| c.register_id == panel.register_id)
        {
            panel.cash_session = Some(CashSessionSummary {
                id: cash.id,
                operator_user_id: cash.operator_user_id.clone(),
                opened_at: cash.opened_at,
                opening_balance: cash.opening_balance,
            });
            panel.expected_cash = cash.opening_balance + panel.sales_total + panel.supplies_total
                - panel.bleeds_total
                - panel.expenses_total;
        }
    }

    let totals = PosPanelTotals {
        total_registers,
        active_registers,
        open_pos_sessions,
        open_cash_sessions,
        sales_count: registers.iter().map(|r| r.sales_count).sum(),
        sales_total: registers.iter().map(|r| r.sales_total).sum(),
        supplies_total: registers.iter().map(|r| r.supplies_total).sum(),
        bleeds_total: registers.iter().map(|r| r.bleeds_total).sum(),
        expenses_total: registers.iter().map(|r| r.expenses_total).sum(),
    };

    Ok(PosPanelResponse {
        tenant_id,
        date,
        generated_at: Utc::now(),
        totals,
        registers,
        operators,
    })
}

struct RegisterRow {
    id: Uuid,
    code: String,
    name: String,
    is_active: bool,
}

struct MovementAggregate {
    register_id: Uuid,
    sales_count: i64,
    sales_total: Decimal,
    supplies_total: Decimal,
    bleeds_total: Decimal,
    expenses_total: Decimal,
    last_movement_at: Option<DateTime<Utc>>,
}

struct OpenCashSessionRow {
    id: Uuid,
    register_id: Uuid,
    operator_user_id: String,
    opened_at: DateTime<Utc>,
    opening_balance: Decimal,
}

struct OpenPosSessionRow {
    id: Uuid,
    register_id: Uuid,
    opened_by: String,
    opened_at: DateTime<Utc>,
}

fn db_error(err: sqlx::Error) -> DomainError {
    DomainError::DatabaseError(err.to_string())
}

async fn fetch_registers(
    pool: &PgPool,
    tenant_id: Uuid,
    register_id: Option<Uuid>,
) -> Result<Vec<PosRegisterPanel>, DomainError> {
    let rows = sqlx::query(
        "SELECT id, code, name, is_active \
         FROM kudiba_treasury.cash_registers \
         WHERE tenant_id = $1 AND ($2::uuid IS NULL OR id = $2) \
         ORDER BY code",
    )
    .bind(tenant_id)
    .bind(register_id)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    let mut registers = Vec::with_capacity(rows.len());
    for row in rows {
        let reg = RegisterRow {
            id: row.try_get("id").map_err(db_error)?,
            code: row.try_get("code").map_err(db_error)?,
            name: row.try_get("name").map_err(db_error)?,
            is_active: row.try_get("is_active").map_err(db_error)?,
        };
        registers.push(PosRegisterPanel {
            register_id: reg.id,
            register_code: reg.code,
            register_name: reg.name,
            is_active: reg.is_active,
            pos_session: None,
            cash_session: None,
            sales_count: 0,
            sales_total: Decimal::ZERO,
            supplies_total: Decimal::ZERO,
            bleeds_total: Decimal::ZERO,
            expenses_total: Decimal::ZERO,
            expected_cash: Decimal::ZERO,
            last_movement_at: None,
        });
    }

    Ok(registers)
}

async fn fetch_movement_aggregates(
    pool: &PgPool,
    tenant_id: Uuid,
    date: NaiveDate,
) -> Result<Vec<MovementAggregate>, DomainError> {
    let rows = sqlx::query(
        "SELECT m.register_id, \
            COUNT(*) FILTER (WHERE m.movement_type = 'SALE_RECEIPT') AS sales_count, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'SALE_RECEIPT'), 0) AS sales_total, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'SUPPLY'), 0) AS supplies_total, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'BLEED'), 0) AS bleeds_total, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'EXPENSE'), 0) AS expenses_total, \
            MAX(m.created_at) AS last_movement_at \
         FROM kudiba_treasury.cash_movements m \
         WHERE m.tenant_id = $1 \
           AND m.created_at >= $2::date \
           AND m.created_at < ($2::date + INTERVAL '1 day') \
         GROUP BY m.register_id",
    )
    .bind(tenant_id)
    .bind(date)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    rows.into_iter()
        .map(|row| {
            Ok(MovementAggregate {
                register_id: row.try_get("register_id").map_err(db_error)?,
                sales_count: row.try_get("sales_count").map_err(db_error)?,
                sales_total: row.try_get("sales_total").map_err(db_error)?,
                supplies_total: row.try_get("supplies_total").map_err(db_error)?,
                bleeds_total: row.try_get("bleeds_total").map_err(db_error)?,
                expenses_total: row.try_get("expenses_total").map_err(db_error)?,
                last_movement_at: row.try_get("last_movement_at").map_err(db_error)?,
            })
        })
        .collect()
}

async fn fetch_open_cash_sessions(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<OpenCashSessionRow>, DomainError> {
    let rows = sqlx::query(
        "SELECT id, register_id, operator_user_id, opened_at, opening_balance \
         FROM kudiba_treasury.cash_sessions \
         WHERE tenant_id = $1 AND status = 'OPEN'",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    rows.into_iter()
        .map(|row| {
            Ok(OpenCashSessionRow {
                id: row.try_get("id").map_err(db_error)?,
                register_id: row.try_get("register_id").map_err(db_error)?,
                operator_user_id: row.try_get("operator_user_id").map_err(db_error)?,
                opened_at: row.try_get("opened_at").map_err(db_error)?,
                opening_balance: row.try_get("opening_balance").map_err(db_error)?,
            })
        })
        .collect()
}

async fn fetch_operator_aggregates(
    pool: &PgPool,
    tenant_id: Uuid,
    date: NaiveDate,
) -> Result<Vec<PosOperatorPanel>, DomainError> {
    let rows = sqlx::query(
        "SELECT m.operator_user_id, \
            COUNT(*) FILTER (WHERE m.movement_type = 'SALE_RECEIPT') AS sales_count, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'SALE_RECEIPT'), 0) AS sales_total, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'SUPPLY'), 0) AS supplies_total, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'BLEED'), 0) AS bleeds_total, \
            COALESCE(SUM(m.amount) FILTER (WHERE m.movement_type = 'EXPENSE'), 0) AS expenses_total \
         FROM kudiba_treasury.cash_movements m \
         WHERE m.tenant_id = $1 \
           AND m.created_at >= $2::date \
           AND m.created_at < ($2::date + INTERVAL '1 day') \
         GROUP BY m.operator_user_id \
         ORDER BY sales_total DESC",
    )
    .bind(tenant_id)
    .bind(date)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    rows.into_iter()
        .map(|row| {
            let sales_total: Decimal = row.try_get("sales_total").map_err(db_error)?;
            let supplies_total: Decimal = row.try_get("supplies_total").map_err(db_error)?;
            let bleeds_total: Decimal = row.try_get("bleeds_total").map_err(db_error)?;
            let expenses_total: Decimal = row.try_get("expenses_total").map_err(db_error)?;

            Ok(PosOperatorPanel {
                operator_user_id: row.try_get("operator_user_id").map_err(db_error)?,
                sales_count: row.try_get("sales_count").map_err(db_error)?,
                sales_total,
                supplies_total,
                bleeds_total,
                expenses_total,
                net_cash_total: sales_total + supplies_total - bleeds_total - expenses_total,
            })
        })
        .collect()
}

async fn fetch_open_pos_sessions(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<Vec<OpenPosSessionRow>, DomainError> {
    let rows = sqlx::query(
        "SELECT id, register_id, opened_by, opened_at \
         FROM kudiba_treasury.pos_sessions \
         WHERE tenant_id = $1 AND status = 'OPEN'",
    )
    .bind(tenant_id)
    .fetch_all(pool)
    .await
    .map_err(db_error)?;

    rows.into_iter()
        .map(|row| {
            Ok(OpenPosSessionRow {
                id: row.try_get("id").map_err(db_error)?,
                register_id: row.try_get("register_id").map_err(db_error)?,
                opened_by: row.try_get("opened_by").map_err(db_error)?,
                opened_at: row.try_get("opened_at").map_err(db_error)?,
            })
        })
        .collect()
}
