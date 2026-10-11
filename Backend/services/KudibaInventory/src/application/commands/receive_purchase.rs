use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{ReceivePurchaseRequest, StockMovementResponse};
use crate::domain::entities::{StockBalance, StockMovement, StockMovementType};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::{
    BatchRepository, ProductRepository, StockRepository, WarehouseRepository,
};
use crate::domain::services::{CmpCalculator, StockPolicy};

pub struct ReceivePurchaseCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
    stock_repo: Arc<dyn StockRepository>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl ReceivePurchaseCommand {
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
        req: ReceivePurchaseRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self.receive(uow.as_mut(), tenant_id, user_id, &req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de entrada de stock: {}",
                        rollback_err
                    );
                }
                Err(err)
            }
        }
    }

    async fn receive(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        user_id: Uuid,
        req: &ReceivePurchaseRequest,
    ) -> Result<StockMovementResponse, InventoryError> {
        let mut product = self
            .product_repo
            .lock_by_id(session, tenant_id, req.product_id)
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

        // O CMP é um custo médio ponderado por artigo (global ao tenant),
        // pelo que a base de ponderação é o total em stock de todos os armazéns.
        let total_on_hand = self
            .stock_repo
            .total_on_hand(session, tenant_id, req.product_id)
            .await?;

        let new_cmp = CmpCalculator::calculate_new_cmp(
            total_on_hand,
            product.current_cmp,
            req.quantity,
            req.unit_cost,
        )?;

        product.set_cmp(new_cmp);
        product.cost_price = req.unit_cost;
        self.product_repo
            .update_prices_and_cmp(session, &product)
            .await?;

        let mut balance = match self
            .stock_repo
            .find_balance_for_update(session, tenant_id, req.warehouse_id, req.product_id)
            .await?
        {
            Some(b) => b,
            None => StockBalance::new(tenant_id, req.warehouse_id, req.product_id, None),
        };
        balance.apply_addition(req.quantity)?;
        self.stock_repo.save_balance(session, &balance).await?;

        let movement = StockMovement::new(
            tenant_id,
            req.warehouse_id,
            req.product_id,
            req.batch_id,
            StockMovementType::InPurchase,
            req.quantity,
            req.unit_cost,
            new_cmp,
            req.document_ref.clone(),
            req.notes.clone(),
            user_id,
        )?;

        self.stock_repo.record_movement(session, &movement).await?;
        Ok(StockMovementResponse::from(movement))
    }
}
