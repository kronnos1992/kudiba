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

        let code = match req
            .code
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            Some(c) => {
                let code_upper = c.to_uppercase();
                if let Some(existing) = self
                    .product_repo
                    .find_by_code(session.as_mut(), tenant_id, &code_upper)
                    .await?
                {
                    return Err(InventoryError::DuplicateProductCode(existing.code));
                }
                code_upper
            }
            None => {
                let prefix = match p_type {
                    ProductType::Goods => "PRD",
                    ProductType::Service => "SERV",
                    ProductType::Other => "OUT",
                    ProductType::Excise => "IEC",
                    ProductType::Tax => "TAX",
                };
                let mut candidate = self
                    .product_repo
                    .next_product_code(session.as_mut(), tenant_id, prefix)
                    .await?;
                while self
                    .product_repo
                    .find_by_code(session.as_mut(), tenant_id, &candidate)
                    .await?
                    .is_some()
                {
                    let rand_suffix = uuid::Uuid::new_v4().simple().to_string()[..4].to_uppercase();
                    candidate = format!("{}-{}", prefix, rand_suffix);
                }
                candidate
            }
        };

        let mut product = Product::new(
            tenant_id,
            code,
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

        if let Some(ref_id) = req.ref_id {
            product = product.with_ref_id(Some(ref_id));
        }

        self.product_repo.save(session.as_mut(), &product).await?;
        Ok(ProductResponse::from(product))
    }
}
