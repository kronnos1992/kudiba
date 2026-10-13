use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{UpdateWarehouseRequest, WarehouseResponse};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::WarehouseRepository;

pub struct UpdateWarehouseCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    warehouse_repo: Arc<dyn WarehouseRepository>,
}

impl UpdateWarehouseCommand {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        warehouse_repo: Arc<dyn WarehouseRepository>,
    ) -> Self {
        Self {
            uow_factory,
            warehouse_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        req: UpdateWarehouseRequest,
    ) -> Result<WarehouseResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self
            .update(uow.as_mut(), tenant_id, warehouse_id, req)
            .await
        {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de atualização de armazém: {}",
                        rollback_err
                    );
                }
                Err(err)
            }
        }
    }

    async fn update(
        &self,
        session: &mut dyn DbSession,
        tenant_id: Uuid,
        warehouse_id: Uuid,
        req: UpdateWarehouseRequest,
    ) -> Result<WarehouseResponse, InventoryError> {
        let mut warehouse = self
            .warehouse_repo
            .find_by_id(session, tenant_id, warehouse_id)
            .await?
            .ok_or(InventoryError::WarehouseNotFound(warehouse_id))?;

        warehouse.update(req.name, req.is_default, req.address_detail, req.is_active)?;

        self.warehouse_repo.update(session, &warehouse).await?;

        Ok(WarehouseResponse::from(warehouse))
    }
}
