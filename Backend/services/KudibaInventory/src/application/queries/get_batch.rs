use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::BatchResponse;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::BatchRepository;

pub struct GetBatchQuery {
    session_factory: Arc<dyn DbSessionFactory>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl GetBatchQuery {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        batch_repo: Arc<dyn BatchRepository>,
    ) -> Self {
        Self {
            session_factory,
            batch_repo,
        }
    }

    pub async fn list_by_product(
        &self,
        tenant_id: Uuid,
        product_id: Uuid,
    ) -> Result<Vec<BatchResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let batches = self
            .batch_repo
            .list_by_product(session.as_mut(), tenant_id, product_id)
            .await?;

        Ok(batches.into_iter().map(BatchResponse::from).collect())
    }

    pub async fn get_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<BatchResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let batch = self
            .batch_repo
            .find_by_id(session.as_mut(), tenant_id, id)
            .await?;

        Ok(batch.map(BatchResponse::from))
    }
}
