use std::sync::Arc;
use uuid::Uuid;

use crate::application::dto::{CreateProductRequest, ProductResponse};
use crate::domain::entities::Product;
use crate::domain::error::InventoryError;
use crate::domain::ports::db_session::DbSessionFactory;
use crate::domain::ports::ProductRepository;
use crate::domain::value_objects::ProductType;

pub struct CreateProductCommand {
    session_factory: Arc<dyn DbSessionFactory>,
    product_repo: Arc<dyn ProductRepository>,
}

impl CreateProductCommand {
    pub fn new(
        session_factory: Arc<dyn DbSessionFactory>,
        product_repo: Arc<dyn ProductRepository>,
    ) -> Self {
        Self {
            session_factory,
            product_repo,
        }
    }

    pub async fn execute(
        &self,
        tenant_id: Uuid,
        req: CreateProductRequest,
    ) -> Result<ProductResponse, InventoryError> {
        let p_type = match req.product_type.as_deref() {
            Some(t) => ProductType::from_saft_code(t).ok_or_else(|| {
                InventoryError::ValidationError(format!(
                    "Tipo de produto inválido: '{}'. Use 'P', 'S', 'O', 'E' ou 'I'.",
                    t
                ))
            })?,
            None => ProductType::Goods,
        };

        let mut session = self.session_factory.open().await?;

        if let Some(existing) = self
            .product_repo
            .find_by_code(session.as_mut(), tenant_id, &req.code)
            .await?
        {
            return Err(InventoryError::DuplicateProductCode(existing.code));
        }

        let product = Product::new(
            tenant_id,
            req.code,
            req.barcode,
            req.name,
            req.description,
            p_type,
            req.is_stockable,
            req.track_lots.unwrap_or(false),
            req.unit_of_measure.unwrap_or_else(|| "UN".to_string()),
            req.sale_price,
            req.cost_price.unwrap_or(rust_decimal::Decimal::ZERO),
            req.tax_percentage
                .unwrap_or(rust_decimal::Decimal::new(14, 0)),
            req.exemption_reason_code,
            req.exemption_reason_text,
            req.has_withholding_tax,
        )?;

        self.product_repo.save(session.as_mut(), &product).await?;
        Ok(ProductResponse::from(product))
    }
}
