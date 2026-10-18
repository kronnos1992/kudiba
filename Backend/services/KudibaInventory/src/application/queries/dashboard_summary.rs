use std::sync::Arc;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use sqlx::Row;
use uuid::Uuid;

use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::{DbSessionFactory, RepositoryError};

#[derive(Debug, Clone, Serialize)]
pub struct ProductStats {
    pub total: i64,
    pub active: i64,
    pub stockable: i64,
    pub services: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WarehouseStats {
    pub total: i64,
    pub active: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntityStats {
    pub total: i64,
    pub customers: i64,
    pub suppliers: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TopValueProduct {
    pub product_id: Uuid,
    pub code: String,
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity_on_hand: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub value_by_cost: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct LowStockItem {
    pub product_id: Uuid,
    pub code: String,
    pub name: String,
    pub warehouse_id: Uuid,
    pub warehouse_name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub quantity_on_hand: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub reorder_point: Decimal,
}

#[derive(Debug, Clone, Serialize)]
pub struct StockStats {
    pub tracked_positions: i64,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_quantity: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub value_by_cost: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub value_by_sale: Decimal,
    pub low_stock_count: i64,
    pub top_value_products: Vec<TopValueProduct>,
    pub low_stock_items: Vec<LowStockItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DashboardSummaryResult {
    pub tenant_id: Uuid,
    pub generated_at: DateTime<Utc>,
    pub products: ProductStats,
    pub warehouses: WarehouseStats,
    pub entities: EntityStats,
    pub stock: StockStats,
}

pub struct GetDashboardSummaryQuery {
    session_factory: Arc<dyn DbSessionFactory>,
}

impl GetDashboardSummaryQuery {
    pub fn new(session_factory: Arc<dyn DbSessionFactory>) -> Self {
        Self { session_factory }
    }

    pub async fn execute(&self, tenant_id: Uuid) -> Result<DashboardSummaryResult, InventoryError> {
        let mut session = self.session_factory.open().await.map_err(map_repo_error)?;
        let conn = session.connection();

        let product_row = sqlx::query(
            "SELECT COUNT(*) AS total, \
                    COUNT(*) FILTER (WHERE is_active) AS active, \
                    COUNT(*) FILTER (WHERE is_stockable) AS stockable \
             FROM kudiba_inventory.products WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(map_sqlx_error)?;

        let total_products = get_i64(&product_row, "total")?;
        let stockable = get_i64(&product_row, "stockable")?;
        let products = ProductStats {
            total: total_products,
            active: get_i64(&product_row, "active")?,
            stockable,
            services: total_products - stockable,
        };

        let warehouse_row = sqlx::query(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active) AS active \
             FROM kudiba_inventory.warehouses WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(map_sqlx_error)?;

        let warehouses = WarehouseStats {
            total: get_i64(&warehouse_row, "total")?,
            active: get_i64(&warehouse_row, "active")?,
        };

        let entity_row = sqlx::query(
            "SELECT COUNT(*) AS total, \
                    COUNT(*) FILTER (WHERE entity_type::text IN ('CUSTOMER', 'BOTH')) AS customers, \
                    COUNT(*) FILTER (WHERE entity_type::text IN ('SUPPLIER', 'BOTH')) AS suppliers \
             FROM kudiba_inventory.entities WHERE tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(map_sqlx_error)?;

        let entities = EntityStats {
            total: get_i64(&entity_row, "total")?,
            customers: get_i64(&entity_row, "customers")?,
            suppliers: get_i64(&entity_row, "suppliers")?,
        };

        let stock_row = sqlx::query(
            "SELECT COUNT(*) AS tracked_positions, \
                    COALESCE(SUM(sb.quantity_on_hand), 0) AS total_quantity, \
                    COALESCE(SUM(sb.quantity_on_hand * p.cost_price), 0) AS value_by_cost, \
                    COALESCE(SUM(sb.quantity_on_hand * p.sale_price), 0) AS value_by_sale, \
                    COUNT(*) FILTER (WHERE sb.reorder_point > 0 AND sb.quantity_on_hand <= sb.reorder_point) AS low_stock_count \
             FROM kudiba_inventory.stock_balances sb \
             JOIN kudiba_inventory.products p ON p.id = sb.product_id \
             WHERE sb.tenant_id = $1",
        )
        .bind(tenant_id)
        .fetch_one(&mut *conn)
        .await
        .map_err(map_sqlx_error)?;

        let top_rows = sqlx::query(
            "SELECT p.id AS product_id, p.code, p.name, \
                    SUM(sb.quantity_on_hand) AS quantity_on_hand, \
                    SUM(sb.quantity_on_hand * p.cost_price) AS value_by_cost \
             FROM kudiba_inventory.stock_balances sb \
             JOIN kudiba_inventory.products p ON p.id = sb.product_id \
             WHERE sb.tenant_id = $1 \
             GROUP BY p.id, p.code, p.name \
             ORDER BY value_by_cost DESC LIMIT 5",
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await
        .map_err(map_sqlx_error)?;

        let top_value_products = top_rows
            .into_iter()
            .map(|row| {
                Ok(TopValueProduct {
                    product_id: row.try_get("product_id").map_err(map_sqlx_error)?,
                    code: row.try_get("code").map_err(map_sqlx_error)?,
                    name: row.try_get("name").map_err(map_sqlx_error)?,
                    quantity_on_hand: get_decimal(&row, "quantity_on_hand")?,
                    value_by_cost: get_decimal(&row, "value_by_cost")?,
                })
            })
            .collect::<Result<Vec<_>, InventoryError>>()?;

        let low_rows = sqlx::query(
            "SELECT p.id AS product_id, p.code, p.name, sb.warehouse_id, w.name AS warehouse_name, \
                    sb.quantity_on_hand, sb.reorder_point \
             FROM kudiba_inventory.stock_balances sb \
             JOIN kudiba_inventory.products p ON p.id = sb.product_id \
             JOIN kudiba_inventory.warehouses w ON w.id = sb.warehouse_id \
             WHERE sb.tenant_id = $1 AND sb.reorder_point > 0 AND sb.quantity_on_hand <= sb.reorder_point \
             ORDER BY (sb.quantity_on_hand - sb.reorder_point) ASC LIMIT 10",
        )
        .bind(tenant_id)
        .fetch_all(&mut *conn)
        .await
        .map_err(map_sqlx_error)?;

        let low_stock_items = low_rows
            .into_iter()
            .map(|row| {
                Ok(LowStockItem {
                    product_id: row.try_get("product_id").map_err(map_sqlx_error)?,
                    code: row.try_get("code").map_err(map_sqlx_error)?,
                    name: row.try_get("name").map_err(map_sqlx_error)?,
                    warehouse_id: row.try_get("warehouse_id").map_err(map_sqlx_error)?,
                    warehouse_name: row.try_get("warehouse_name").map_err(map_sqlx_error)?,
                    quantity_on_hand: get_decimal(&row, "quantity_on_hand")?,
                    reorder_point: get_decimal(&row, "reorder_point")?,
                })
            })
            .collect::<Result<Vec<_>, InventoryError>>()?;

        let stock = StockStats {
            tracked_positions: get_i64(&stock_row, "tracked_positions")?,
            total_quantity: get_decimal(&stock_row, "total_quantity")?,
            value_by_cost: get_decimal(&stock_row, "value_by_cost")?,
            value_by_sale: get_decimal(&stock_row, "value_by_sale")?,
            low_stock_count: get_i64(&stock_row, "low_stock_count")?,
            top_value_products,
            low_stock_items,
        };

        Ok(DashboardSummaryResult {
            tenant_id,
            generated_at: Utc::now(),
            products,
            warehouses,
            entities,
            stock,
        })
    }
}

fn get_i64(row: &sqlx::postgres::PgRow, column: &str) -> Result<i64, InventoryError> {
    row.try_get(column).map_err(map_sqlx_error)
}

fn get_decimal(row: &sqlx::postgres::PgRow, column: &str) -> Result<Decimal, InventoryError> {
    row.try_get(column).map_err(map_sqlx_error)
}

fn map_sqlx_error(err: sqlx::Error) -> InventoryError {
    InventoryError::DatabaseError(err.to_string())
}

fn map_repo_error(err: RepositoryError) -> InventoryError {
    InventoryError::DatabaseError(err.to_string())
}
