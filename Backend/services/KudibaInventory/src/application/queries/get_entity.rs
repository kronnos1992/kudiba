use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::EntityResponse;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::EntityRepository;

pub struct GetEntityQuery {
    session_factory: Arc<dyn DbSessionFactory>,
    entity_repo: Arc<dyn EntityRepository>,
}

impl GetEntityQuery {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        entity_repo: Arc<dyn EntityRepository>,
    ) -> Self {
        Self {
            session_factory,
            entity_repo,
        }
    }

    pub async fn get_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<EntityResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let opt = self
            .entity_repo
            .find_by_id(session.as_mut(), tenant_id, id)
            .await?;
        Ok(opt.map(EntityResponse::from))
    }

    pub async fn get_by_tax_id(
        &self,
        tenant_id: Uuid,
        tax_id: &str,
    ) -> Result<Option<EntityResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let opt = self
            .entity_repo
            .find_by_tax_id(session.as_mut(), tenant_id, tax_id)
            .await?;
        Ok(opt.map(EntityResponse::from))
    }

    pub async fn list(
        &self,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<EntityResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .entity_repo
            .list(session.as_mut(), tenant_id, limit, offset)
            .await?;
        Ok(list.into_iter().map(EntityResponse::from).collect())
    }
}
