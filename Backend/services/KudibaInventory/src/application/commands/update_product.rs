use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{ProductResponse, UpdateProductRequest};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::ProductRepository;

pub struct UpdateProductCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
}

impl UpdateProductCommand {
    pub fn new(
        uow_factory: Arc<dyn UnitOfWorkFactory>,
        product_repo: Arc<dyn ProductRepository>,
    ) -> Self {
        Self {
            uow_factory,
            product_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        product_id: Uuid,
        req: UpdateProductRequest,
    ) -> Result<ProductResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self.update(uow.as_mut(), tenant_id, product_id, req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de atualização de produto: {}",
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
        product_id: Uuid,
        req: UpdateProductRequest,
    ) -> Result<ProductResponse, InventoryError> {
        let mut product = self
            .product_repo
            .lock_by_id(session, tenant_id, product_id)
            .await?
            .ok_or(InventoryError::ProductNotFound(product_id))?;

        product.update_details(
            req.name,
            req.description,
            req.barcode,
            req.unit_of_measure,
            req.sale_price,
            req.cost_price,
            req.tax_percentage,
            req.exemption_reason_code,
            req.exemption_reason_text,
            req.has_withholding_tax,
            req.is_active,
        )?;

        self.product_repo.update(session, &product).await?;

        Ok(ProductResponse::from(product))
    }
}
