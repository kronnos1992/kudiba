use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{BatchResponse, CreateBatchRequest};
use crate::domain::entities::ProductBatch;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::{BatchRepository, ProductRepository};

pub struct CreateBatchCommand {
    session_factory: Arc<dyn DbSessionFactory>,
    product_repo: Arc<dyn ProductRepository>,
    batch_repo: Arc<dyn BatchRepository>,
}

impl CreateBatchCommand {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        product_repo: Arc<dyn ProductRepository>,
        batch_repo: Arc<dyn BatchRepository>,
    ) -> Self {
        Self {
            session_factory,
            product_repo,
            batch_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateBatchRequest,
    ) -> Result<BatchResponse, InventoryError> {
        let mut session = self.session_factory.open().await?;

        let product = self
            .product_repo
            .find_by_id(session.as_mut(), tenant_id, req.product_id)
            .await?
            .ok_or(InventoryError::ProductNotFound(req.product_id))?;

        if !product.is_stockable {
            return Err(InventoryError::ValidationError(
                "Artigos intangíveis/serviços não admitem criação de lotes".to_string(),
            ));
        }

        if !product.track_lots {
            return Err(InventoryError::BatchNotAllowed(product.name));
        }

        if self
            .batch_repo
            .find_by_number(
                session.as_mut(),
                tenant_id,
                req.product_id,
                req.batch_number.trim(),
            )
            .await?
            .is_some()
        {
            return Err(InventoryError::DuplicateBatchNumber(req.batch_number));
        }

        let batch = ProductBatch::new(
            tenant_id,
            req.product_id,
            req.batch_number,
            req.manufacture_date,
            req.expiry_date,
        )?;

        self.batch_repo.save(session.as_mut(), &batch).await?;

        Ok(BatchResponse::from(batch))
    }
}
