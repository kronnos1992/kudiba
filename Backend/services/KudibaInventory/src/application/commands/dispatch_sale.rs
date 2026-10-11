use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{DispatchSaleRequest, StockMovementResponse};
use crate::domain::entities::{StockMovement, StockMovementType};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::{
    BatchRepository, ProductRepository, StockRepository, WarehouseRepository,
};
use crate::domain::services::StockPolicy;

pub struct DispatchSaleCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
    stock_repo: Arc<dyn StockRepository>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl DispatchSaleCommand {
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
        req: DispatchSaleRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self.dispatch(uow.as_mut(), tenant_id, user_id, &req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de saída de stock por venda: {}",
                        rollback_err
                    );
                }
                Err(err)
            }
        }
    }

    async fn dispatch(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        user_id: Uuid,
        req: &DispatchSaleRequest,
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
            if batch.is_expired(chrono::Utc::now().date_naive()) {
                return Err(InventoryError::BatchExpired(batch.batch_number));
            }
        } else if req.batch_id.is_some() {
            return Err(InventoryError::BatchNotAllowed(product.name.clone()));
        }

        self.warehouse_repo
            .find_by_id(session, tenant_id, req.warehouse_id)
            .await?
            .ok_or(InventoryError::WarehouseNotFound(req.warehouse_id))?;

        let mut balance = self
            .stock_repo
            .find_balance_for_update(session, tenant_id, req.warehouse_id, req.product_id)
            .await?
            .ok_or(InventoryError::InsufficientStock {
                product_id: req.product_id,
                available: rust_decimal::Decimal::ZERO,
                requested: req.quantity,
            })?;

        balance.apply_deduction(req.quantity, req.is_reserved.unwrap_or(false))?;
        self.stock_repo.save_balance(session, &balance).await?;

        let movement = StockMovement::new(
            tenant_id,
            req.warehouse_id,
            req.product_id,
            req.batch_id,
            StockMovementType::OutSale,
            req.quantity,
            product.current_cmp,
            product.current_cmp,
            Some(req.document_ref.clone()),
            req.notes.clone(),
            user_id,
        )?;

        self.stock_repo.record_movement(session, &movement).await?;
        Ok(StockMovementResponse::from(movement))
    }
}
