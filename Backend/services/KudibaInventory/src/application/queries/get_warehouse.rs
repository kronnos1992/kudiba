use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::WarehouseResponse;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::WarehouseRepository;

pub struct GetWarehouseQuery {
    session_factory: Arc<dyn DbSessionFactory>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
}

impl GetWarehouseQuery {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
    ) -> Self {
        Self {
            session_factory,
            warehouse_repo,
        }
    }

    pub async fn get_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<WarehouseResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let opt = self
            .warehouse_repo
            .find_by_id(session.as_mut(), tenant_id, id)
            .await?;
        Ok(opt.map(WarehouseResponse::from))
    }

    pub async fn list_by_branch(
        &self,
        tenant_id: Uuid,
        branch_id: Uuid,
    ) -> Result<Vec<WarehouseResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .warehouse_repo
            .list_by_branch(session.as_mut(), tenant_id, branch_id)
            .await?;
        Ok(list.into_iter().map(WarehouseResponse::from).collect())
    }

    pub async fn list_all(
        &self,
        tenant_id: Uuid,
    ) -> Result<Vec<WarehouseResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .warehouse_repo
            .list_all(session.as_mut(), tenant_id)
            .await?;
        Ok(list.into_iter().map(WarehouseResponse::from).collect())
    }
}
