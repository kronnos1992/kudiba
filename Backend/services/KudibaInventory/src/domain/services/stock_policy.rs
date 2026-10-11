use crate::domain::entities::Product;
use crate::domain::error::InventoryError;
use crate::domain::value_objects::ProductType;

pub struct StockPolicy;

impl StockPolicy {
    pub fn ensure_can_move_stock(product: &Product) -> Result<(), InventoryError> {
        if !product.is_stockable || product.product_type == ProductType::Service {
            return Err(InventoryError::IntangibleCannotMoveStock(
                product.name.clone(),
            ));
        }
        Ok(())
    }

    pub fn ensure_can_issue_cargo_document(product: &Product) -> Result<(), InventoryError> {
        if !product.product_type.allows_cargo_movement() || !product.is_stockable {
            return Err(InventoryError::IntangibleCannotHaveCargoDocument(
                product.name.clone(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    #[test]
    fn bloqueia_movimento_de_stock_para_servicos() {
        let service = Product::new(
            Uuid::new_v4(),
            "SRV-001".to_string(),
            None,
            "Consultoria Fiscal AGT".to_string(),
            None,
            ProductType::Service,
            None, // is_stockable padrão false
            false,
            "HORA".to_string(),
            dec!(25000),
            dec!(0),
            dec!(14),
            None,
            None,
            None,
        )
        .unwrap();

        assert!(StockPolicy::ensure_can_move_stock(&service).is_err());
        assert!(StockPolicy::ensure_can_issue_cargo_document(&service).is_err());
    }

    #[test]
    fn autoriza_movimento_de_stock_para_produtos_fisicos() {
        let goods = Product::new(
            Uuid::new_v4(),
            "PRD-001".to_string(),
            Some("5601234567890".to_string()),
            "Caixa de Papel A4".to_string(),
            None,
            ProductType::Goods,
            Some(true),
            false,
            "UN".to_string(),
            dec!(5000),
            dec!(3500),
            dec!(14),
            None,
            None,
            None,
        )
        .unwrap();

        assert!(StockPolicy::ensure_can_move_stock(&goods).is_ok());
        assert!(StockPolicy::ensure_can_issue_cargo_document(&goods).is_ok());
    }
}
