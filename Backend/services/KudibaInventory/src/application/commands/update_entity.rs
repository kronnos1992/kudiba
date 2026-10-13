use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{EntityResponse, UpdateEntityRequest};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::EntityRepository;

pub struct UpdateEntityCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    entity_repo: Arc<dyn EntityRepository>,
}

impl UpdateEntityCommand {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        entity_repo: Arc<dyn EntityRepository>,
    ) -> Self {
        Self {
            uow_factory,
            entity_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        entity_id: Uuid,
        req: UpdateEntityRequest,
    ) -> Result<EntityResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self.update(uow.as_mut(), tenant_id, entity_id, req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de atualização de entidade: {}",
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
        entity_id: Uuid,
        req: UpdateEntityRequest,
    ) -> Result<EntityResponse, InventoryError> {
        let mut entity = self
            .entity_repo
            .find_by_id(session, tenant_id, entity_id)
            .await?
            .ok_or(InventoryError::EntityNotFound(entity_id))?;

        entity.update(
            req.name,
            req.trade_name,
            req.email,
            req.phone,
            req.is_withholding_agent,
            req.country_code,
            req.province,
            req.city,
            req.address_detail,
            req.iban,
            req.is_active,
        )?;

        self.entity_repo.update(session, &entity).await?;

        Ok(EntityResponse::from(entity))
    }
}
