use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{StockBalanceResponse, StockMovementResponse};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::StockRepository;

pub struct GetStockQuery {
    session_factory: Arc<dyn DbSessionFactory>,
    stock_repo: Arc<dyn StockRepository>,
}

impl GetStockQuery {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        stock_repo: Arc<dyn StockRepository>,
    ) -> Self {
        Self {
            session_factory,
            stock_repo,
        }
    }

    pub async fn get_balance(
        &self,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
    ) -> Result<Option<StockBalanceResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let opt = self
            .stock_repo
            .find_balance(session.as_mut(), tenant_id, warehouse_id, product_id)
            .await?;
        Ok(opt.map(StockBalanceResponse::from))
    }

    pub async fn list_balances_by_product(
        &self,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<Vec<StockBalanceResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .stock_repo
            .list_balances_by_product(session.as_mut(), tenant_id, product_id)
            .await?;
        Ok(list.into_iter().map(StockBalanceResponse::from).collect())
    }

    pub async fn list_all_balances(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<StockBalanceResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .stock_repo
            .list_all_balances(session.as_mut(), tenant_id)
            .await?;
        Ok(list.into_iter().map(StockBalanceResponse::from).collect())
    }

    pub async fn list_movements(
        &self,
        tenant_id: Uuid,
        product_id: Option<Uuid>,
        warehouse_id: Option<Uuid>,
        limit: i64,
    ) -> Result<Vec<StockMovementResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .stock_repo
            .list_movements(session.as_mut(), tenant_id, product_id, warehouse_id, limit)
            .await?;
        Ok(list.into_iter().map(StockMovementResponse::from).collect())
    }
}
