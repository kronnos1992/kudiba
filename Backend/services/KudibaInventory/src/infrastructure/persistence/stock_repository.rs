use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::{StockBalance, StockMovement};
use crate::domain::ports::db_session::{DbSession, RepositoryError};
use crate::domain::ports::StockRepository;
use crate::infrastructure::persistence::models::{StockBalanceRow, StockMovementRow};

pub struct PostgresStockRepository;

impl PostgresStockRepository {
    pub fn new() -> Self {
        Self
    }
}

impl Default for PostgresStockRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl StockRepository for PostgresStockRepository {
    async fn find_balance(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
    ) -> Result<Option<StockBalance>, RepositoryError> {
        let opt: Option<StockBalanceRow> = sqlx::query_as(
            "SELECT id, tenant_id, warehouse_id, product_id, \
             quantity_on_hand, quantity_reserved, reorder_point, updated_at \
             FROM kudiba_inventory.stock_balances \
             WHERE tenant_id = $1 AND warehouse_id = $2 AND product_id = $3",
        )
        .bind(tenant_id)
        .bind(warehouse_id)
        .bind(product_id)
        .fetch_optional(&mut *session.connection())
        .await?;

        Ok(opt.map(StockBalance::from))
    }

    async fn find_balance_for_update(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
    ) -> Result<Option<StockBalance>, RepositoryError> {
        let opt: Option<StockBalanceRow> = sqlx::query_as(
            "SELECT id, tenant_id, warehouse_id, product_id, \
             quantity_on_hand, quantity_reserved, reorder_point, updated_at \
             FROM kudiba_inventory.stock_balances \
             WHERE tenant_id = $1 AND warehouse_id = $2 AND product_id = $3 FOR UPDATE",
        )
        .bind(tenant_id)
        .bind(warehouse_id)
        .bind(product_id)
        .fetch_optional(&mut *session.connection())
        .await?;

        Ok(opt.map(StockBalance::from))
    }

    async fn total_on_hand(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<rust_decimal::Decimal, RepositoryError> {
        let total: rust_decimal::Decimal = sqlx::query_scalar(
            "SELECT COALESCE(SUM(quantity_on_hand), 0) FROM kudiba_inventory.stock_balances \
             WHERE tenant_id = $1 AND product_id = $2",
        )
        .bind(tenant_id)
        .bind(product_id)
        .fetch_one(&mut *session.connection())
        .await?;

        Ok(total)
    }

    async fn save_balance(
        &self,
        session: &mut dyn DbSession,
        b: &StockBalance,
    ) -> Result<(), RepositoryError> {
        sqlx::query(
            r#"
            INSERT INTO kudiba_inventory.stock_balances (
                id, tenant_id, warehouse_id, product_id, quantity_on_hand, quantity_reserved, reorder_point, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            )
            ON CONFLICT (product_id, warehouse_id) DO UPDATE SET
                quantity_on_hand = EXCLUDED.quantity_on_hand,
                quantity_reserved = EXCLUDED.quantity_reserved,
                reorder_point = EXCLUDED.reorder_point,
                updated_at = EXCLUDED.updated_at
            "#,
        )
        .bind(b.id)
        .bind(b.tenant_id)
        .bind(b.warehouse_id)
        .bind(b.product_id)
        .bind(b.quantity_on_hand)
        .bind(b.quantity_reserved)
        .bind(b.reorder_point)
        .bind(b.updated_at)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn record_movement(
        &self,
        session: &mut dyn DbSession,
        m: &StockMovement,
    ) -> Result<(), RepositoryError> {
        let movement_type_str = match m.movement_type {
            crate::domain::entities::StockMovementType::InPurchase => "IN_PURCHASE",
            crate::domain::entities::StockMovementType::InTransfer => "IN_TRANSFER",
            crate::domain::entities::StockMovementType::InAdjustment => "IN_ADJUSTMENT",
            crate::domain::entities::StockMovementType::OutSale => "OUT_SALE",
            crate::domain::entities::StockMovementType::OutTransfer => "OUT_TRANSFER",
            crate::domain::entities::StockMovementType::OutWaste => "OUT_WASTE",
            crate::domain::entities::StockMovementType::OutAdjustment => "OUT_ADJUSTMENT",
        };

        sqlx::query(
            r#"
            INSERT INTO kudiba_inventory.stock_movements (
                id, tenant_id, warehouse_id, product_id, batch_id, movement_type,
                quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
                created_by, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6::kudiba_inventory.stock_movement_kind,
                $7, $8, $9, $10, $11, $12,
                $13, $14
            )
            "#,
        )
        .bind(m.id)
        .bind(m.tenant_id)
        .bind(m.warehouse_id)
        .bind(m.product_id)
        .bind(m.batch_id)
        .bind(movement_type_str)
        .bind(m.quantity)
        .bind(m.unit_cost)
        .bind(m.total_cost)
        .bind(m.resulting_cmp)
        .bind(&m.document_ref)
        .bind(&m.notes)
        .bind(m.created_by)
        .bind(m.created_at)
        .execute(&mut *session.connection())
        .await?;

        Ok(())
    }

    async fn list_balances_by_product(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<Vec<StockBalance>, RepositoryError> {
        let rows: Vec<StockBalanceRow> = sqlx::query_as(
            "SELECT id, tenant_id, warehouse_id, product_id, \
             quantity_on_hand, quantity_reserved, reorder_point, updated_at \
             FROM kudiba_inventory.stock_balances \
             WHERE tenant_id = $1 AND product_id = $2 ORDER BY warehouse_id ASC",
        )
        .bind(tenant_id)
        .bind(product_id)
        .fetch_all(&mut *session.connection())
        .await?;

        Ok(rows.into_iter().map(StockBalance::from).collect())
    }

    async fn list_movements(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        product_id: Option<Uuid>,
        warehouse_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<StockMovement>, RepositoryError> {
        let rows: Vec<StockMovementRow> = sqlx::query_as(
            r#"
            SELECT id, tenant_id, warehouse_id, product_id, batch_id, movement_type::text,
                   quantity, unit_cost, total_cost, resulting_cmp, document_ref, notes,
                   created_by, created_at
            FROM kudiba_inventory.stock_movements
            WHERE tenant_id = $1
              AND ($2::uuid IS NULL OR product_id = $2)
              AND ($3::uuid IS NULL OR warehouse_id = $3)
            ORDER BY created_at DESC
            LIMIT $4
            "#,
        )
        .bind(tenant_id)
        .bind(product_id)
        .bind(warehouse_id)
        .bind(limit)
        .fetch_all(&mut *session.connection())
        .await?;

        Ok(rows.into_iter().map(StockMovement::from).collect())
    }
}
