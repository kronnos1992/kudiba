use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{AdjustStockRequest, StockMovementResponse};
use crate::domain::entities::{StockBalance, StockMovement, StockMovementType};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::{
    BatchRepository, ProductRepository, StockRepository, WarehouseRepository,
};
use crate::domain::services::StockPolicy;

pub struct AdjustStockCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
    stock_repo: Arc<dyn StockRepository>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl AdjustStockCommand {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        product_repo: Arc<dyn ProductRepository>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
        stock_repo: Arc<dyn StockRepository>,
        batch_repo: Arc<dyn BatchRepository>,
    ) -> Self {
        Self {
            uow_factory,
            product_repo,
            warehouse_repo,
            stock_repo,
            batch_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        user_id: Uuid,
        req: AdjustStockRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        if req.quantity_delta == Decimal::ZERO {
            return Err(InventoryError::InvalidQuantity(
                "A variação de stock para acerto não pode ser zero.".to_string(),
            ));
        }

        let mut uow = self.uow_factory.begin().await?;

        match self.adjust(uow.as_mut(), tenant_id, user_id, &req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de acerto de stock: {}",
                        rollback_err
                    );
                }
                Err(err)
            }
        }
    }

    async fn adjust(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        user_id: Uuid,
        req: &AdjustStockRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        let product = self
            .product_repo
            .find_by_id(session, tenant_id, req.product_id)
            .await?
            .ok_or(InventoryError::ProductNotFound(req.product_id))?;

        StockPolicy::ensure_can_move_stock(&product)?;

        if product.track_lots {
            let batch_id = req
                .batch_id
                .ok_or_else(|| InventoryError::BatchRequired(product.name.clone()))?;
            let batch = self
                .batch_repo
                .find_by_id(session, tenant_id, batch_id)
                .await?
                .ok_or(InventoryError::BatchNotFound(batch_id))?;
            if batch.product_id != product.id {
                return Err(InventoryError::ValidationError(
                    "O lote indicado não pertence a este artigo".to_string(),
                ));
            }
        } else if req.batch_id.is_some() {
            return Err(InventoryError::BatchNotAllowed(product.name.clone()));
        }

        self.warehouse_repo
            .find_by_id(session, tenant_id, req.warehouse_id)
            .await?
            .ok_or(InventoryError::WarehouseNotFound(req.warehouse_id))?;

        let mut balance = match self
            .stock_repo
            .find_balance_for_update(session, tenant_id, req.warehouse_id, req.product_id)
            .await?
        {
            Some(b) => b,
            None => StockBalance::new(tenant_id, req.warehouse_id, req.product_id, None),
        };

        let (movement_type, quantity) = if req.quantity_delta > Decimal::ZERO {
            balance.apply_addition(req.quantity_delta)?;
            (StockMovementType::InAdjustment, req.quantity_delta)
        } else {
            let abs_qty = req.quantity_delta.abs();
            balance.apply_deduction(abs_qty, false)?;
            let m_type = if req.is_waste.unwrap_or(false) {
                StockMovementType::OutWaste
            } else {
                StockMovementType::OutAdjustment
            };
            (m_type, abs_qty)
        };

        self.stock_repo.save_balance(session, &balance).await?;

        let movement = StockMovement::new(
            tenant_id,
            req.warehouse_id,
            req.product_id,
            req.batch_id,
            movement_type,
            quantity,
            product.current_cmp,
            product.current_cmp,
            req.document_ref.clone(),
            req.notes.clone(),
            user_id,
        )?;

        self.stock_repo.record_movement(session, &movement).await?;
        Ok(StockMovementResponse::from(movement))
    }
}
