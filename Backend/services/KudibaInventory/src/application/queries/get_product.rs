use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::ProductResponse;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::ProductRepository;

pub struct GetProductQuery {
    session_factory: Arc<dyn DbSessionFactory>,
    product_repo: Arc<dyn ProductRepository>,
}

impl GetProductQuery {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        product_repo: Arc<dyn ProductRepository>,
    ) -> Self {
        Self {
            session_factory,
            product_repo,
        }
    }

    pub async fn get_by_id(
        &self,
        tenant_id: Uuid,
        id: Uuid,
    ) -> Result<Option<ProductResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let opt = self
            .product_repo
            .find_by_id(session.as_mut(), tenant_id, id)
            .await?;
        Ok(opt.map(ProductResponse::from))
    }

    pub async fn get_by_code(
        &self,
        tenant_id: Uuid,
        code: &str,
    ) -> Result<Option<ProductResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let opt = self
            .product_repo
            .find_by_code(session.as_mut(), tenant_id, code)
            .await?;
        Ok(opt.map(ProductResponse::from))
    }

    pub async fn list(
        &self,
        tenant_id: Uuid,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<ProductResponse>, InventoryError> {
        let mut session = self.session_factory.open().await?;
        let list = self
            .product_repo
            .list(session.as_mut(), tenant_id, limit, offset)
            .await?;
        Ok(list.into_iter().map(ProductResponse::from).collect())
    }
}
