use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{ProductResponse, UpdateProductPriceRequest};
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSession;
use crate::domain::ports::unit_of_work::UnitOfWorkFactory;
use crate::domain::ports::ProductRepository;

pub struct UpdateProductPriceCommand {
    uow_factory: Arc<dyn UnitOfWorkFactory>,
    product_repo: Arc<dyn ProductRepository>,
}

impl UpdateProductPriceCommand {
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
        req: UpdateProductPriceRequest,
    ) -> Result<ProductResponse, InventoryError> {
        let mut uow = self.uow_factory.begin().await?;

        match self.update(uow.as_mut(), tenant_id, product_id, &req).await {
            Ok(response) => {
                uow.commit().await?;
                Ok(response)
            }
            Err(err) => {
                if let Err(rollback_err) = uow.rollback().await {
                    tracing::error!(
                        "Falha ao reverter transação de atualização de preços: {}",
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
        req: &UpdateProductPriceRequest,
    ) -> Result<ProductResponse, InventoryError> {
        let mut product = self
            .product_repo
            .lock_by_id(session, tenant_id, product_id)
            .await?
            .ok_or(InventoryError::ProductNotFound(product_id))?;

        if req.sale_price < rust_decimal::Decimal::ZERO {
            return Err(InventoryError::InvalidPrice(
                "Preço de venda não pode ser negativo".to_string(),
            ));
        }
        if let Some(cost) = req.cost_price {
            if cost < rust_decimal::Decimal::ZERO {
                return Err(InventoryError::InvalidPrice(
                    "Preço de custo não pode ser negativo".to_string(),
                ));
            }
            product.cost_price = cost;
        }

        product.sale_price = req.sale_price;
        product.updated_at = chrono::Utc::now();

        self.product_repo
            .update_prices_and_cmp(session, &product)
            .await?;

        Ok(ProductResponse::from(product))
    }
}
