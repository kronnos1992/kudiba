use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{StockMovementResponse, TransferStockRequest};
use crate::domain::entities::{StockBalance, StockMovement, StockMovementType};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::{
    BatchRepository, ProductRepository, StockRepository, WarehouseRepository,
};
use crate::domain::services::StockPolicy;

pub struct TransferStockCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
    stock_repo: Arc<dyn StockRepository>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl TransferStockCommand {
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
        req: TransferStockRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self.transfer(uow.as_mut(), tenant_id, user_id, &req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de transferência de stock: {}",
                        rollback_err
                    );
                }
                Err(err)
            }
        }
    }

    async fn transfer(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        user_id: Uuid,
        req: &TransferStockRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        if req.from_warehouse_id == req.to_warehouse_id {
            return Err(InventoryError::ValidationError(
                "Armazém de origem e destino devem ser diferentes".to_string(),
            ));
        }

        let product = self
            .product_repo
            .lock_by_id(session, tenant_id, req.product_id)
            .await?
            .ok_or(InventoryError::ProductNotFound(req.product_id))?;

        StockPolicy::ensure_can_move_stock(&product)?;
        StockPolicy::ensure_can_issue_cargo_document(&product)?;

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
            .find_by_id(session, tenant_id, req.from_warehouse_id)
            .await?
            .ok_or(InventoryError::WarehouseNotFound(req.from_warehouse_id))?;
        self.warehouse_repo
            .find_by_id(session, tenant_id, req.to_warehouse_id)
            .await?
            .ok_or(InventoryError::WarehouseNotFound(req.to_warehouse_id))?;

        let mut from_balance = self
            .stock_repo
            .find_balance_for_update(session, tenant_id, req.from_warehouse_id, req.product_id)
            .await?
            .ok_or(InventoryError::InsufficientStock {
                product_id: req.product_id,
                available: rust_decimal::Decimal::ZERO,
                requested: req.quantity,
            })?;

        from_balance.apply_deduction(req.quantity, false)?;
        self.stock_repo.save_balance(session, &from_balance).await?;

        let mut to_balance = match self
            .stock_repo
            .find_balance_for_update(session, tenant_id, req.to_warehouse_id, req.product_id)
            .await?
        {
            Some(b) => b,
            None => StockBalance::new(tenant_id, req.to_warehouse_id, req.product_id, None),
        };
        to_balance.apply_addition(req.quantity)?;
        self.stock_repo.save_balance(session, &to_balance).await?;

        let out_movement = StockMovement::new(
            tenant_id,
            req.from_warehouse_id,
            req.product_id,
            req.batch_id,
            StockMovementType::OutTransfer,
            req.quantity,
            product.current_cmp,
            product.current_cmp,
            None,
            req.notes.clone(),
            user_id,
        )?;
        self.stock_repo
            .record_movement(session, &out_movement)
            .await?;

        let in_movement = StockMovement::new(
            tenant_id,
            req.to_warehouse_id,
            req.product_id,
            req.batch_id,
            StockMovementType::InTransfer,
            req.quantity,
            product.current_cmp,
            product.current_cmp,
            None,
            req.notes.clone(),
            user_id,
        )?;
        self.stock_repo
            .record_movement(session, &in_movement)
            .await?;

        Ok(StockMovementResponse::from(out_movement))
    }
}
