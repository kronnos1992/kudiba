use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{CreateWarehouseRequest, WarehouseResponse};
use crate::domain::entities::Warehouse;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::WarehouseRepository;

pub struct CreateWarehouseCommand {
    session_factory: Arc<dyn DbSessionFactory>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
}

impl CreateWarehouseCommand {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
    ) -> Self {
        Self {
            session_factory,
            warehouse_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateWarehouseRequest,
    ) -> Result<WarehouseResponse, InventoryError> {
        let mut session = self.session_factory.open().await?;

        if let Some(existing) = self
            .warehouse_repo
            .find_by_code(session.as_mut(), tenant_id, &req.code)
            .await?
        {
            return Err(InventoryError::DuplicateWarehouseCode(existing.code));
        }

        let warehouse = Warehouse::new(
            tenant_id,
            req.branch_id,
            req.code,
            req.name,
            req.is_default.unwrap_or(false),
            req.address_detail,
        )?;

        self.warehouse_repo
            .save(session.as_mut(), &warehouse)
            .await?;
        Ok(WarehouseResponse::from(warehouse))
    }
}
