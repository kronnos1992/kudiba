use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::error::InventoryError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StockBalance {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub warehouse_id: Uuid,
    pub product_id: Uuid,
    pub quantity_on_hand: Decimal,
    pub quantity_reserved: Decimal,
    pub reorder_point: Decimal,
    pub updated_at: DateTime<Utc>,
}

impl StockBalance {
    pub fn new(
        tenant_id: Uuid,
        warehouse_id: Uuid,
        product_id: Uuid,
        reorder_point: Option<Decimal>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            tenant_id,
            warehouse_id,
            product_id,
            quantity_on_hand: Decimal::ZERO,
            quantity_reserved: Decimal::ZERO,
            reorder_point: reorder_point.unwrap_or(Decimal::ZERO),
            updated_at: Utc::now(),
        }
    }

    pub fn available_quantity(&self) -> Decimal {
        self.quantity_on_hand - self.quantity_reserved
    }

    pub fn reserve(&mut self, qty: Decimal) -> Result<(), InventoryError> {
        if qty <= Decimal::ZERO {
            return Err(InventoryError::InvalidQuantity(
                "Quantidade a reservar deve ser positiva".to_string(),
            ));
        }

        let available = self.available_quantity();
        if available < qty {
            return Err(InventoryError::InsufficientStock {
                product_id: self.product_id,
                available,
                requested: qty,
            });
        }

        self.quantity_reserved += qty;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn release_reservation(&mut self, qty: Decimal) {
        if qty > Decimal::ZERO {
            self.quantity_reserved = (self.quantity_reserved - qty).max(Decimal::ZERO);
            self.updated_at = Utc::now();
        }
    }

    pub fn apply_addition(&mut self, qty: Decimal) -> Result<(), InventoryError> {
        if qty <= Decimal::ZERO {
            return Err(InventoryError::InvalidQuantity(
                "Quantidade a adicionar deve ser positiva".to_string(),
            ));
        }
        self.quantity_on_hand += qty;
        self.updated_at = Utc::now();
        Ok(())
    }

    pub fn apply_deduction(
        &mut self,
        qty: Decimal,
        is_reserved: bool,
    ) -> Result<(), InventoryError> {
        if qty <= Decimal::ZERO {
            return Err(InventoryError::InvalidQuantity(
                "Quantidade a deduzir deve ser positiva".to_string(),
            ));
        }

        if self.quantity_on_hand < qty {
            return Err(InventoryError::InsufficientStock {
                product_id: self.product_id,
                available: self.quantity_on_hand,
                requested: qty,
            });
        }

        self.quantity_on_hand -= qty;
        if is_reserved {
            self.quantity_reserved = (self.quantity_reserved - qty).max(Decimal::ZERO);
        }
        self.updated_at = Utc::now();
        Ok(())
    }
}
